import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { migrate } from "../../hub/src/migrate.js";
import { getPool, closePool } from "../src/db.js";
import { DECK_ALLOCATION } from "../../hub/src/decks.js";
import { runForecast, runPublish } from "../src/pipeline.js";
import { loadDeckCardModel } from "../../src/deckData.js";
import { runExplode } from "../../src/commands/explode.js";
import { buildFixtureBundleSource } from "../../test/fixtures/deckCardFixture.js";
import { readModuleSource } from "../../src/parseBundle.js";
import { startFakeStabbur, shaOf } from "./helpers/fakeStabbur.js";

// An unrelated module alongside the deck/card pair, so task 5.1's
// byte-identical guarantee has something real to check against — not just
// the two modules builder is supposed to touch.
const OTHER_MODULE_ID = 102;
const otherModuleSource = () =>
  `__d(function (g, r, i, a, m, e, d) {\n  m.exports = function greet() { return "hi"; };\n}, ${OTHER_MODULE_ID}, []);\n`;

const DATABASE_URL = process.env.DATABASE_URL;
const describe = DATABASE_URL ? test : test.skip;

function wordNote(id, overrides = {}) {
  const audioText = `audio for ${id}`;
  return {
    id,
    created_at: "2026-10-01T00:00:00.000Z",
    capture_id: null,
    type: "word",
    source_lang: "no",
    text: `word-${id}`,
    translations: [{ lang: "en", text: `translation-${id}` }],
    transcription: "",
    pos: "substantiv",
    lemma: `word-${id}`,
    inflections: {},
    context_text: "",
    audio_blob: shaOf(audioText),
    audio_sel_ms: [0, 100],
    grammar_rule_id: null,
    status: "ready",
    _audioText: audioText,
    ...overrides,
  };
}

describe("builder pipeline: forecast + publish against a fixture stabbur and fixture bundle", async (t) => {
  const pool = getPool();
  await migrate();
  await pool.query("TRUNCATE card_slots, publications, build_jobs, minted_notes, decks CASCADE");
  for (const { code, title } of DECK_ALLOCATION) {
    await pool.query("INSERT INTO decks (code, title, category) VALUES ($1, $2, $3)", [code, title, code[0]]);
  }

  // The publish guards (tool/src/otaPublish.js) require the magic activation
  // prefix; the deck/card data-module fixture itself doesn't need one, but a
  // real bundle always has it first. No boot-ok companion is appended here —
  // this fixture is never fetched by a real device (ALLOW_NO_COMPANION is
  // exactly for this case, per otaPublish.js's own comment).
  process.env.ALLOW_NO_COMPANION = "1";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mjolnir-builder-pipeline-"));
  const bundlePath = path.join(tmpDir, "fixture.bundle");
  fs.writeFileSync(bundlePath, "var __BUNDLE_START_TIME__=1;\n" + buildFixtureBundleSource() + otherModuleSource());
  runExplode(bundlePath);
  const otherModuleBefore = readModuleSource(bundlePath, loadDeckCardModel(bundlePath).manifest[OTHER_MODULE_ID]);
  const dataDir = path.join(tmpDir, "data");

  const fake = startFakeStabbur();
  const stabburBaseUrl = await fake.listen();
  for (let i = 1; i <= 5; i++) fake.addBlob(shaOf(`audio for n${i}`), `audio for n${i}`);

  const config = { stabburBaseUrl, sourceLang: "no", bundlePath, dataDir, publicBase: "https://tun.example.test" };

  await t.test("forecast reports a held deck below the floor, without minting", async () => {
    fake.setNotes([wordNote("n1"), wordNote("n2"), wordNote("n3"), wordNote("n4")]);
    const forecast = await runForecast(pool, config);
    const c20 = forecast.decks.find((d) => d.deckCode === "C20");
    assert.equal(c20.newlyEligibleCount, 4);
    assert.equal(c20.crossed, false);

    const { rows } = await pool.query("SELECT count(*) FROM card_slots");
    assert.equal(Number(rows[0].count), 0, "forecast must not mint anything");
  });

  await t.test("a scheduled run with no deck crossing the floor writes nothing", async () => {
    const result = await runPublish(pool, config);
    assert.equal(result.published, false);
    const { rows } = await pool.query("SELECT count(*) FROM build_jobs");
    assert.equal(Number(rows[0].count), 0);
  });

  let firstBuildId;
  await t.test("crossing the floor mints, interleaves, saves, and publishes", async () => {
    fake.setNotes([wordNote("n1"), wordNote("n2"), wordNote("n3"), wordNote("n4"), wordNote("n5"), wordNote("n6")]);
    for (let i = 1; i <= 6; i++) fake.addBlob(shaOf(`audio for n${i}`), `audio for n${i}`);

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    firstBuildId = result.buildId;
    assert.equal(result.buildId, "b000001");
    assert.deepEqual(result.decksMinted, [{ deckCode: "C20", count: 6 }]);

    const model = loadDeckCardModel(bundlePath);
    const deck = model.decks.find((d) => d.Name === "C20");
    assert.ok(deck, "C20 deck should have been created in the bundle");
    // word -> occurrences ["A","E","N"], 6 cards -> 18 occurrences.
    assert.equal(deck.Cards.length, 18);
    assert.equal(model.cards.filter((c) => c.DECK_ID === "C20").length, 6);

    const { rows: pubs } = await pool.query("SELECT * FROM publications");
    assert.equal(pubs.length, 1);
    assert.equal(pubs[0].build_id, "b000001");
    assert.equal(pubs[0].data_rev, 1);

    assert.ok(fs.existsSync(path.join(dataDir, "ota", "bundle", "b000001.js")));
    assert.ok(fs.existsSync(path.join(dataDir, "ota", "b000001", "audio.json")));
    const audioManifest = JSON.parse(fs.readFileSync(path.join(dataDir, "ota", "b000001", "audio.json"), "utf8"));
    assert.equal(Object.keys(audioManifest).length, 6);

    const { rows: jobs } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobs[0].status, "succeeded");

    // Task 5.1: every module other than the two deck/card data modules must
    // be byte-identical to the pre-publish bundle.
    const otherModuleAfter = readModuleSource(bundlePath, model.manifest[OTHER_MODULE_ID]);
    assert.equal(otherModuleAfter, otherModuleBefore, "an unrelated module must be byte-identical after a builder publish");
  });

  await t.test("editing an already-minted note's content reaches the device on the next crossing publish, id/position unchanged", async () => {
    fake.setNotes([
      wordNote("n1", { text: "EDITED" }),
      wordNote("n2"),
      wordNote("n3"),
      wordNote("n4"),
      wordNote("n5"),
      wordNote("n6"),
      // A second deck (verb -> C22) crosses the floor this run, so a publish
      // actually happens and regeneration runs (no-crossing runs publish
      // nothing at all, by design — see the "no eligible decks" scenario).
      ...["v1", "v2", "v3", "v4", "v5", "v6"].map((id) => wordNote(id, { pos: "verb" })),
    ]);
    for (const id of ["v1", "v2", "v3", "v4", "v5", "v6"]) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);

    const before = loadDeckCardModel(bundlePath);
    const n1CardBefore = before.cards.find((c) => c.DECK_ID === "C20" && c.N.includes("word-n1"));
    assert.ok(n1CardBefore, "sanity: n1's card should exist before the edit");
    const n1Id = n1CardBefore.ID;
    const n1Position = before.decks.find((d) => d.Name === "C20").Cards.findIndex((ref) => ref.Card.startsWith(n1Id));

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.equal(result.buildId, "b000002");
    assert.deepEqual(result.decksMinted, [{ deckCode: "C22", count: 6 }]);

    const after = loadDeckCardModel(bundlePath);
    const n1CardAfter = after.cards.find((c) => c.ID === n1Id);
    assert.match(n1CardAfter.N, /EDITED/);
    assert.equal(n1CardAfter.DECK_ID, "C20");
    const n1PositionAfter = after.decks.find((d) => d.Name === "C20").Cards.findIndex((ref) => ref.Card.startsWith(n1Id));
    assert.equal(n1PositionAfter, n1Position, "an existing card's Cards[] position must never move");
    assert.equal(after.decks.find((d) => d.Name === "C20").Cards.length, 18, "C20's occurrences must not grow from a content-only regen");
  });

  t.after(async () => {
    await fake.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await closePool();
  });
});
