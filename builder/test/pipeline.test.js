import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { migrate } from "../../hub/src/migrate.js";
import { getPool, closePool } from "../src/db.js";
import { DECK_ALLOCATION } from "../../hub/src/decks.js";
import { runForecast, runPublish } from "../src/pipeline.js";
import { loadDeckCardModel, saveDeckCardModel } from "../../src/deckData.js";
import { createCard } from "../../src/injectDeck.js";
import { runExplode } from "../../src/commands/explode.js";
import { buildFixtureBundleSource } from "../../test/fixtures/deckCardFixture.js";
import { readModuleSource } from "../../src/parseBundle.js";
import { startFakeStabbur, shaOf } from "./helpers/fakeStabbur.js";
import { buildGrammarRuleLookup } from "../src/stabburClient.js";

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
  await pool.query("TRUNCATE card_slots, publications, build_jobs, minted_notes, decks, pending_occurrences CASCADE");
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

  const config = { stabburBaseUrl, sourceLang: "no", bundlePath, dataDir, publicBase: "https://tun.example.test" };

  async function pendingRows(deckCode) {
    const { rows } = await pool.query(
      "SELECT card_id, letter, remaining FROM pending_occurrences WHERE deck_code = $1 ORDER BY id",
      [deckCode]
    );
    return rows;
  }

  await t.test("a scheduled run with zero newly-eligible notes writes nothing (D91: no floor, just nothing to do)", async () => {
    fake.setNotes([]);
    const result = await runPublish(pool, config);
    assert.equal(result.published, false);
    const { rows } = await pool.query("SELECT count(*) FROM build_jobs");
    assert.equal(Number(rows[0].count), 0);
  });

  await t.test("forecast reports per-deck eligible counts and pending-queue depth, without minting (D91: no floor language)", async () => {
    fake.setNotes([wordNote("n1"), wordNote("n2"), wordNote("n3"), wordNote("n4")]);
    for (const id of ["n1", "n2", "n3", "n4"]) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);
    const forecast = await runForecast(pool, config);
    const c20 = forecast.decks.find((d) => d.deckCode === "C20");
    assert.equal(c20.newlyEligibleCount, 4);
    assert.equal(c20.pendingQueueDepth, 0);

    const { rows } = await pool.query("SELECT count(*) FROM card_slots");
    assert.equal(Number(rows[0].count), 0, "forecast must not mint anything");
  });

  let firstBuildId;
  await t.test("a single run with no floor to wait for ships every new card's A immediately and queues its E", async () => {
    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    firstBuildId = result.buildId;
    assert.equal(result.buildId, "b000001");
    assert.deepEqual(result.decksMinted, [{ deckCode: "C20", count: 4 }]);

    const model = loadDeckCardModel(bundlePath);
    const deck = model.decks.find((d) => d.Name === "C20");
    assert.ok(deck, "C20 deck should have been created in the bundle");
    // word -> occurrences ["A","E"] (D91 drops "N"); only "A" ships this run.
    assert.equal(deck.Cards.length, 4, "only the 4 new cards' A occurrences ship this run");
    assert.equal(model.cards.filter((c) => c.DECK_ID === "C20").length, 4);

    const queued = await pendingRows("C20");
    assert.equal(queued.length, 4, "every new card's E is queued, not shipped");
    assert.ok(queued.every((r) => r.letter === "E" && r.remaining === 11));

    const { rows: pubs } = await pool.query("SELECT * FROM publications");
    assert.equal(pubs.length, 1);
    assert.equal(pubs[0].build_id, "b000001");
    assert.equal(pubs[0].data_rev, 1);

    assert.ok(fs.existsSync(path.join(dataDir, "ota", "bundle", "b000001.js")));
    assert.ok(fs.existsSync(path.join(dataDir, "ota", "b000001", "audio.json")));
    const audioManifest = JSON.parse(fs.readFileSync(path.join(dataDir, "ota", "b000001", "audio.json"), "utf8"));
    assert.equal(Object.keys(audioManifest).length, 4);

    const { rows: jobs } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobs[0].status, "succeeded");

    // Task 5.1: every module other than the two deck/card data modules must
    // be byte-identical to the pre-publish bundle.
    const otherModuleAfter = readModuleSource(bundlePath, model.manifest[OTHER_MODULE_ID]);
    assert.equal(otherModuleAfter, otherModuleBefore, "an unrelated module must be byte-identical after a builder publish");
  });

  await t.test("editing an already-minted note's content reaches the device on the next publish, id/position unchanged", async () => {
    // A single new note elsewhere (verb -> C22) is enough to force a publish
    // under D91 — no floor, no need for a second deck's worth of 6.
    fake.setNotes([
      wordNote("n1", { text: "EDITED" }),
      wordNote("n2"),
      wordNote("n3"),
      wordNote("n4"),
      wordNote("v1", { pos: "verb" }),
    ]);
    fake.addBlob(shaOf("audio for v1"), "audio for v1");

    const before = loadDeckCardModel(bundlePath);
    const n1CardBefore = before.cards.find((c) => c.DECK_ID === "C20" && c.N.includes("word-n1"));
    assert.ok(n1CardBefore, "sanity: n1's card should exist before the edit");
    const n1Id = n1CardBefore.ID;
    const n1Position = before.decks.find((d) => d.Name === "C20").Cards.findIndex((ref) => ref.Card.startsWith(n1Id));

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.equal(result.buildId, "b000002");
    assert.deepEqual(result.decksMinted, [{ deckCode: "C22", count: 1 }]);

    const after = loadDeckCardModel(bundlePath);
    const n1CardAfter = after.cards.find((c) => c.ID === n1Id);
    assert.match(n1CardAfter.N, /EDITED/);
    assert.equal(n1CardAfter.DECK_ID, "C20");
    const n1PositionAfter = after.decks.find((d) => d.Name === "C20").Cards.findIndex((ref) => ref.Card.startsWith(n1Id));
    assert.equal(n1PositionAfter, n1Position, "an existing card's Cards[] position must never move");
    assert.equal(after.decks.find((d) => d.Name === "C20").Cards.length, 4, "C20's occurrences must not grow from a content-only regen");
  });

  await t.test("D86: a throw after both newly-minted decks' mints commit but before the bundle is saved self-heals on the next run", async () => {
    // Two decks mint in the same run: C23 (adverb) and C25 (konjunksjon).
    // `mintCardSlots` commits each deck's `card_slots`/`minted_notes` rows as
    // its own batch *before* `createCard` ever runs for that deck's notes —
    // so by the time `createCard` throws on C25's first card (a planted id
    // collision), both decks' ledger rows are already committed, but
    // `saveDeckCardModel` is never reached this attempt.
    const notes = [
      ...["d1", "d2", "d3", "d4", "d5", "d6"].map((id) => wordNote(id, { pos: "adverb" })),
      ...["k1", "k2", "k3", "k4", "k5", "k6"].map((id) => wordNote(id, { pos: "konjunksjon" })),
    ];
    fake.setNotes([wordNote("n1", { text: "EDITED" }), wordNote("n2"), wordNote("n3"), wordNote("n4"), wordNote("v1", { pos: "verb" }), ...notes]);
    for (const { id } of notes) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);

    // Plant a card directly in the bundle (outside hub's ledger entirely) at
    // the exact id `mintCardSlots` will compute for C25's first new note.
    const planted = loadDeckCardModel(bundlePath);
    createCard(planted.cards, { id: "C25001", deckId: "C20", N: "", E: "", D: "", X: "", A: "N" });
    saveDeckCardModel(bundlePath, planted);

    await assert.rejects(() => runPublish(pool, config), /card id "C25001" already exists/);

    for (const deckCode of ["C23", "C25"]) {
      const { rows } = await pool.query("SELECT count(*) FROM card_slots WHERE deck_code = $1", [deckCode]);
      assert.equal(Number(rows[0].count), 6, `${deckCode}'s mint committed independently of the later throw`);
    }
    const modelAfterFailure = loadDeckCardModel(bundlePath);
    assert.equal(
      modelAfterFailure.cards.filter((c) => c.DECK_ID === "C23" || c.DECK_ID === "C25").length,
      0,
      "neither deck's cards reached the bundle — the save never ran this failed attempt"
    );
    const { rows: jobs } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobs[0].status, "failed");

    // Remove the planted obstruction and re-run with the same note set — no
    // floor to worry about this time (D91), so C23/C25's recovery and any
    // genuinely-new note all mint/regenerate in the same run.
    const unplanted = loadDeckCardModel(bundlePath);
    unplanted.cards = unplanted.cards.filter((c) => c.ID !== "C25001");
    saveDeckCardModel(bundlePath, unplanted);
    const freshNotes = ["j1", "j2", "j3", "j4", "j5", "j6"].map((id) => wordNote(id, { pos: "adjektiv" }));
    for (const { id } of freshNotes) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);
    fake.setNotes([wordNote("n1", { text: "EDITED" }), wordNote("n2"), wordNote("n3"), wordNote("n4"), wordNote("v1", { pos: "verb" }), ...notes, ...freshNotes]);

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C21", count: 6 }]);

    const model = loadDeckCardModel(bundlePath);
    assert.equal(model.cards.filter((c) => c.DECK_ID === "C23").length, 6, "C23's cards were recreated on recovery");
    assert.equal(model.cards.filter((c) => c.DECK_ID === "C25").length, 6, "C25's cards were recreated on recovery");
    assert.equal(model.decks.find((d) => d.Name === "C23").Cards.length, 6, "only C23's recovered A's shipped — E's stay queued");
    assert.equal(model.decks.find((d) => d.Name === "C25").Cards.length, 6, "only C25's recovered A's shipped — E's stay queued");
    const { rows: jobsAfter } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobsAfter[0].status, "succeeded");
  });

  // D91's cross-batch queue mechanics (task 6.2.7), isolated on their own
  // untouched deck (C24, preposisjon) so counts don't entangle with the
  // tests above.
  await t.test("C24: 2 new notes ship both A's immediately and queue both E's at remaining=11", async () => {
    const p1 = wordNote("p1", { pos: "preposisjon" });
    const p2 = wordNote("p2", { pos: "preposisjon" });
    fake.setNotes([wordNote("n1", { text: "EDITED" }), wordNote("n2"), wordNote("n3"), wordNote("n4"), wordNote("v1", { pos: "verb" }), p1, p2]);
    fake.addBlob(shaOf("audio for p1"), "audio for p1");
    fake.addBlob(shaOf("audio for p2"), "audio for p2");

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C24", count: 2 }]);

    const model = loadDeckCardModel(bundlePath);
    assert.equal(model.decks.find((d) => d.Name === "C24").Cards.length, 2, "both A's ship, no E's yet");

    const queued = await pendingRows("C24");
    assert.equal(queued.length, 2);
    assert.ok(queued.every((r) => r.letter === "E" && r.remaining === 11));
  });

  await t.test("C24: a subsequent run with 1 new note decrements the existing pending rows and queues the new one fresh", async () => {
    const p3 = wordNote("p3", { pos: "preposisjon" });
    fake.setNotes([
      wordNote("n1", { text: "EDITED" }),
      wordNote("n2"),
      wordNote("n3"),
      wordNote("n4"),
      wordNote("v1", { pos: "verb" }),
      wordNote("p1", { pos: "preposisjon" }),
      wordNote("p2", { pos: "preposisjon" }),
      p3,
    ]);
    fake.addBlob(shaOf("audio for p3"), "audio for p3");

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C24", count: 1 }]);

    const model = loadDeckCardModel(bundlePath);
    assert.equal(model.decks.find((d) => d.Name === "C24").Cards.length, 3, "3 A's total now, still no E's");

    const queued = await pendingRows("C24");
    assert.equal(queued.length, 3);
    const byRemaining = queued.map((r) => r.remaining).sort((a, b) => a - b);
    assert.deepEqual(byRemaining, [10, 10, 11], "p1/p2 decremented to 10 by this run's one new A; p3 queued fresh at 11");
  });

  await t.test("C24: enough cumulative new cards cross 11 and drain only the oldest E's", async () => {
    const tenMore = Array.from({ length: 10 }, (_, i) => wordNote(`p${4 + i}`, { pos: "preposisjon" }));
    for (const { id } of tenMore) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);
    fake.setNotes([
      wordNote("n1", { text: "EDITED" }),
      wordNote("n2"),
      wordNote("n3"),
      wordNote("n4"),
      wordNote("v1", { pos: "verb" }),
      wordNote("p1", { pos: "preposisjon" }),
      wordNote("p2", { pos: "preposisjon" }),
      wordNote("p3", { pos: "preposisjon" }),
      ...tenMore,
    ]);

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C24", count: 10 }]);

    const model = loadDeckCardModel(bundlePath);
    // 3 earlier A's + 10 new A's + 2 drained E's (p1, p2) = 15.
    assert.equal(model.decks.find((d) => d.Name === "C24").Cards.length, 15);

    const queued = await pendingRows("C24");
    assert.equal(queued.length, 11, "p1/p2 drained and removed; p3 (now at 1) plus 10 freshly-queued remain");
    const byRemaining = queued.map((r) => r.remaining).sort((a, b) => a - b);
    assert.deepEqual(byRemaining, [1, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11]);
  });

  await t.test("C24: a run with zero new cards in this deck leaves its queue numerically unchanged", async () => {
    const before = await pendingRows("C24");

    // A grammar note (C29, single-occurrence) forces a publish this run
    // without adding anything to C24.
    const g1 = wordNote("g1", { type: "grammar", pos: undefined, grammar_rule_id: "rule-1" });
    fake.addBlob(shaOf("audio for g1"), "audio for g1");
    fake.setNotes([
      wordNote("n1", { text: "EDITED" }),
      wordNote("n2"),
      wordNote("n3"),
      wordNote("n4"),
      wordNote("v1", { pos: "verb" }),
      wordNote("p1", { pos: "preposisjon" }),
      wordNote("p2", { pos: "preposisjon" }),
      wordNote("p3", { pos: "preposisjon" }),
      ...Array.from({ length: 10 }, (_, i) => wordNote(`p${4 + i}`, { pos: "preposisjon" })),
      g1,
    ]);

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C29", count: 1 }]);

    const after = await pendingRows("C24");
    assert.deepEqual(after, before, "C24's queue must be byte-for-byte unchanged — it got zero new cards this run");
  });

  await t.test("listening/pronunciation/grammar notes never touch pending_occurrences at all", async () => {
    const { rows } = await pool.query("SELECT count(*) FROM pending_occurrences WHERE deck_code IN ('C27', 'C28', 'C29')");
    assert.equal(Number(rows[0].count), 0);

    const model = loadDeckCardModel(bundlePath);
    const c29 = model.decks.find((d) => d.Name === "C29");
    assert.ok(c29, "C29 (grammar) deck should exist from the previous run's mint");
    assert.equal(c29.Cards.length, 1, "grammar's single occurrence (N) ships immediately, nothing queued");
  });

  await t.test("D89: wiring a real grammarRuleLookup means a grammar note's placeholder text never appears", async () => {
    fake.setGrammarRules([{ id: "rule-2", title: "Past tense", html: "<p>har/hadde + perfect participle</p>" }]);
    const g2 = wordNote("g2", { type: "grammar", pos: undefined, grammar_rule_id: "rule-2" });
    fake.addBlob(shaOf("audio for g2"), "audio for g2");
    fake.setNotes([
      wordNote("n1", { text: "EDITED" }),
      wordNote("n2"),
      wordNote("n3"),
      wordNote("n4"),
      wordNote("v1", { pos: "verb" }),
      wordNote("p1", { pos: "preposisjon" }),
      wordNote("p2", { pos: "preposisjon" }),
      wordNote("p3", { pos: "preposisjon" }),
      ...Array.from({ length: 10 }, (_, i) => wordNote(`p${4 + i}`, { pos: "preposisjon" })),
      wordNote("g1", { type: "grammar", pos: undefined, grammar_rule_id: "rule-1" }),
      g2,
    ]);

    // Exactly what server.js/clock.js now do: fetch the lookup once, pass it
    // into runPublish.
    const grammarRuleLookup = await buildGrammarRuleLookup({ baseUrl: stabburBaseUrl });
    const result = await runPublish(pool, { ...config, grammarRuleLookup });
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C29", count: 1 }]);

    const model = loadDeckCardModel(bundlePath);
    const g2Card = model.cards.find((c) => c.DECK_ID === "C29" && c.N.includes("word-g2"));
    assert.ok(g2Card, "g2's card should have been minted into C29");
    assert.match(g2Card.X, /Past tense/, "the rule's real title reached the card");
    assert.doesNotMatch(g2Card.X, /not yet available/, "the placeholder must never appear once a real lookup is wired");

    // g1 (minted in an earlier test, before any grammarRuleLookup existed)
    // still has no matching rule in stabbur's fixture data — its regenerated
    // content correctly still shows the placeholder, proving this isn't a
    // blanket "always succeeds" stub.
    const g1Card = model.cards.find((c) => c.DECK_ID === "C29" && c.N.includes("word-g1"));
    assert.match(g1Card.X, /not yet available/);
  });

  t.after(async () => {
    await fake.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await closePool();
  });
});
