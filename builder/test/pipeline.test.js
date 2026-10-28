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
import { execFileSync } from "node:child_process";
import { startFakeStabbur, shaOf } from "./helpers/fakeStabbur.js";
import { seedActiveLogicBundle } from "./helpers/logicBundleFixture.js";
import { buildGrammarRuleLookup } from "../src/stabburClient.js";
import { occurrencesForBuild } from "../src/batchHistory.js";

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
    // null by default: this suite's fixture "audio" is plain text, not real
    // decodable audio, so it can't go through D-F1's real-ffmpeg trim path —
    // see the dedicated "D-F1" test below for that, which uses a real clip.
    audio_sel_ms: null,
    grammar_rule_id: null,
    status: "ready",
    _audioText: audioText,
    ...overrides,
  };
}

describe("builder pipeline: forecast + publish against a fixture stabbur and an active logic bundle", async (t) => {
  const pool = getPool();
  await migrate();
  await pool.query(
    "TRUNCATE card_slots, publications, build_jobs, minted_notes, decks, pending_occurrences, occurrence_shipments, job_logs, logic_bundles, card_content CASCADE"
  );
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
  // D-L4: this is the immutable "active logic bundle" file for the whole
  // suite — builder's pipeline never mutates it; every run copies it fresh
  // into its own scratch path and replays hub's ledger onto that copy.
  const logicBundlePath = path.join(tmpDir, "logic-bundle.js");
  fs.writeFileSync(logicBundlePath, "var __BUNDLE_START_TIME__=1;\n" + buildFixtureBundleSource() + otherModuleSource());
  runExplode(logicBundlePath);
  const otherModuleBefore = readModuleSource(logicBundlePath, loadDeckCardModel(logicBundlePath).manifest[OTHER_MODULE_ID]);
  await seedActiveLogicBundle(pool, logicBundlePath);
  const dataDir = path.join(tmpDir, "data");

  const fake = startFakeStabbur();
  const stabburBaseUrl = await fake.listen();

  const config = {
    stabburBaseUrl,
    stabburAuthToken: fake.authToken,
    sourceLang: "no",
    dataDir,
    publicBase: "https://tun.example.test",
  };

  // Every published build's own deck/card model — not the shared working
  // file of before (there is none anymore), but the immutable artifact
  // `publish()` actually wrote for that build (D-L4).
  function outputModel(buildId) {
    return loadDeckCardModel(path.join(dataDir, "ota", "bundle", `${buildId}.js`));
  }

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

  await t.test("forecast still reports a deck's pending queue depth even with zero newly-eligible notes today", async () => {
    // The confirmed bug: `byDeck` used to be built only by iterating
    // `newlyEligibleByDeck`, so a deck with real pending_occurrences but no
    // newly-eligible notes this call never got an entry at all — its real
    // queue depth silently vanished from the forecast.
    fake.setNotes([]);
    await pool.query(
      "INSERT INTO pending_occurrences (deck_code, card_id, letter, remaining) VALUES ('C29', 'ZZZTST', 'N', 5)"
    );
    try {
      const forecast = await runForecast(pool, config);
      const c29 = forecast.byDeck.find((d) => d.deckCode === "C29");
      assert.ok(c29, "C29 must appear in byDeck despite zero newly-eligible notes");
      assert.equal(c29.newlyEligibleCount, 0);
      assert.equal(c29.pendingQueueDepth, 5);
      assert.equal(c29.pendingOldestRemaining, 5);
    } finally {
      await pool.query("DELETE FROM pending_occurrences WHERE deck_code = 'C29' AND card_id = 'ZZZTST'");
    }
  });

  await t.test("forecast reports occurrence-level would-ship/would-queue, without minting (D-H2)", async () => {
    fake.setNotes([wordNote("n1"), wordNote("n2"), wordNote("n3"), wordNote("n4")]);
    for (const id of ["n1", "n2", "n3", "n4"]) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);
    const forecast = await runForecast(pool, config);

    const c20 = forecast.byDeck.find((d) => d.deckCode === "C20");
    assert.equal(c20.newlyEligibleCount, 4);
    assert.equal(c20.pendingQueueDepth, 0);

    // word -> occurrences ["A", "E"]: the A's would ship this run, the E's
    // would only be newly queued (D91 — not both in the same list).
    const shipIds = forecast.wouldShip.filter((o) => o.deckCode === "C20").map((o) => o.cardId);
    assert.deepEqual(shipIds.sort(), ["C20001", "C20002", "C20003", "C20004"]);
    assert.ok(forecast.wouldShip.filter((o) => o.deckCode === "C20").every((o) => o.letter === "A"));
    const queueIds = forecast.wouldQueue.filter((o) => o.deckCode === "C20").map((o) => o.cardId);
    assert.deepEqual(queueIds.sort(), ["C20001", "C20002", "C20003", "C20004"]);
    assert.ok(forecast.wouldQueue.filter((o) => o.deckCode === "C20").every((o) => o.letter === "E" && o.remaining === 11));

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

    const model = outputModel(result.buildId);
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
    assert.equal(pubs[0].base_version, "1.5.12");
    assert.equal(pubs[0].patch_rev, 1);
    assert.ok(pubs[0].logic_bundle_id, "D-L6: the publication records which logic bundle it was built from");

    assert.ok(fs.existsSync(path.join(dataDir, "ota", "bundle", "b000001.js")));
    assert.ok(fs.existsSync(path.join(dataDir, "ota", "b000001", "audio.json")));
    const audioManifest = JSON.parse(fs.readFileSync(path.join(dataDir, "ota", "b000001", "audio.json"), "utf8"));
    assert.equal(Object.keys(audioManifest).length, 4);

    const { rows: jobs } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobs[0].status, "succeeded");

    // Task 5.1: every module other than the two deck/card data modules must
    // be byte-identical to the active logic bundle's own copy — a builder
    // publish only ever rebuilds the deck/card pair, never anything else.
    const otherModuleAfter = readModuleSource(path.join(dataDir, "ota", "bundle", "b000001.js"), model.manifest[OTHER_MODULE_ID]);
    assert.equal(otherModuleAfter, otherModuleBefore, "an unrelated module must be byte-identical after a builder publish");

    // D-L3: card_content now durably holds each new card's rendered N/E/X/A.
    const { rows: content } = await pool.query("SELECT card_id FROM card_content WHERE card_id LIKE 'C20%' ORDER BY card_id");
    assert.deepEqual(content.map((r) => r.card_id), ["C20001", "C20002", "C20003", "C20004"]);
  });

  await t.test("forecast after a real publish shows nothing in would-ship, matching the run's outcome", async () => {
    const forecast = await runForecast(pool, config);
    assert.deepEqual(forecast.wouldShip, [], "everything currently eligible was just published — nothing left to ship");
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

    const before = outputModel(firstBuildId);
    const n1CardBefore = before.cards.find((c) => c.DECK_ID === "C20" && c.N.includes("word-n1"));
    assert.ok(n1CardBefore, "sanity: n1's card should exist before the edit");
    const n1Id = n1CardBefore.ID;
    const n1Position = before.decks.find((d) => d.Name === "C20").Cards.findIndex((ref) => ref.Card.startsWith(n1Id));

    // D-C2: the forecast should predict n1's card content would change
    // (it's the only already-minted note edited here), and no other
    // already-minted card's.
    const forecastBeforePublish = await runForecast(pool, config);
    const wouldUpdateIds = forecastBeforePublish.wouldUpdate.map((u) => u.cardId);
    assert.deepEqual(wouldUpdateIds, [n1Id], "only n1's card is predicted to change — n2/n3/n4 are unedited");

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.equal(result.buildId, "b000002");
    assert.deepEqual(result.decksMinted, [{ deckCode: "C22", count: 1 }]);

    // D-C2: the actual run's log names exactly the card(s) that changed,
    // not every already-minted card it regenerated.
    const { rows: regenLog } = await pool.query(
      "SELECT jl.line FROM job_logs jl JOIN build_jobs bj ON bj.id = jl.build_job_id WHERE bj.build_id = $1 AND jl.line LIKE 'regenerate:%'",
      [result.buildId]
    );
    assert.equal(regenLog.length, 1);
    assert.match(regenLog[0].line, /^regenerate: 1 of 4 existing card\(s\) actually changed content: C20\d{3}$/);

    const after = outputModel(result.buildId);
    const n1CardAfter = after.cards.find((c) => c.ID === n1Id);
    assert.match(n1CardAfter.N, /EDITED/);
    assert.equal(n1CardAfter.DECK_ID, "C20");
    const n1PositionAfter = after.decks.find((d) => d.Name === "C20").Cards.findIndex((ref) => ref.Card.startsWith(n1Id));
    assert.equal(n1PositionAfter, n1Position, "an existing card's Cards[] position must never move, even across a full replay");
    assert.equal(after.decks.find((d) => d.Name === "C20").Cards.length, 4, "C20's occurrences must not grow from a content-only regen");

    // D-L3: the regenerated content reached card_content too, not just this
    // run's output bundle — the next replay must see the edit as well.
    const { rows: contentRow } = await pool.query("SELECT n FROM card_content WHERE card_id = $1", [n1Id]);
    assert.match(contentRow[0].n, /EDITED/);
  });

  await t.test("D86: a throw after both newly-minted decks' mints commit but before the bundle is saved self-heals on the next run", async () => {
    // Two decks mint in the same run: C23 (adverb) and C25 (konjunksjon).
    // `mintCardSlots` commits each deck's `card_slots`/`minted_notes` rows as
    // its own batch *before* `createCard` ever runs for that deck's notes —
    // so by the time `createCard` throws on C25's first card (a planted id
    // collision), both decks' ledger rows are already committed, but the
    // save/publish is never reached this attempt.
    const notes = [
      ...["d1", "d2", "d3", "d4", "d5", "d6"].map((id) => wordNote(id, { pos: "adverb" })),
      ...["k1", "k2", "k3", "k4", "k5", "k6"].map((id) => wordNote(id, { pos: "konjunksjon" })),
    ];
    fake.setNotes([wordNote("n1", { text: "EDITED" }), wordNote("n2"), wordNote("n3"), wordNote("n4"), wordNote("v1", { pos: "verb" }), ...notes]);
    for (const { id } of notes) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);

    // Plant a collision directly in hub's own ledger (not the bundle — there
    // is no persistent bundle to plant into anymore): a `card_slots` row at
    // the exact id `mintCardSlots` will compute for C25's first new note,
    // with a matching `card_content`/`occurrence_shipments` row so `replay`
    // faithfully recreates it into this run's scratch bundle before mint
    // ever runs — reproducing "the bundle already has this id" the same way
    // a real divergence would.
    await pool.query("INSERT INTO card_slots (id, deck_code, card_no, note_id) VALUES ('C25001', 'C25', 1, 'rogue-note')");
    await pool.query("INSERT INTO card_content (card_id, n, e, x, a) VALUES ('C25001', '', '', '', 'N')");
    await pool.query("INSERT INTO occurrence_shipments (card_id, letter, build_id) VALUES ('C25001', 'N', $1)", [firstBuildId]);

    await assert.rejects(() => runPublish(pool, config), /card id "C25001" already exists/);

    for (const deckCode of ["C23", "C25"]) {
      const { rows } = await pool.query("SELECT count(*) FROM card_slots WHERE deck_code = $1", [deckCode]);
      assert.equal(Number(rows[0].count), deckCode === "C25" ? 7 : 6, `${deckCode}'s mint committed independently of the later throw`);
    }
    const { rows: jobs } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobs[0].status, "failed");

    // D-H1: a run that fails after minting (and after this run's occurrences
    // were appended in-memory) but before publish() ever succeeds must leave
    // zero shipment rows — occurrence_shipments never names a build that was
        // never actually published.
    const { rows: shipmentsAfterFailure } = await pool.query(
      "SELECT count(*) FROM occurrence_shipments WHERE (card_id LIKE 'C23%' OR card_id LIKE 'C25%') AND card_id != 'C25001'"
    );
    assert.equal(Number(shipmentsAfterFailure[0].count), 0, "a failed run must record zero shipments");

    // Remove the planted obstruction and re-run with the same note set — no
    // floor to worry about this time (D91), so C23/C25's recovery and any
    // genuinely-new note all mint/regenerate in the same run.
    await pool.query("DELETE FROM occurrence_shipments WHERE card_id = 'C25001'");
    await pool.query("DELETE FROM card_content WHERE card_id = 'C25001'");
    await pool.query("DELETE FROM card_slots WHERE id = 'C25001'");
    const freshNotes = ["j1", "j2", "j3", "j4", "j5", "j6"].map((id) => wordNote(id, { pos: "adjektiv" }));
    for (const { id } of freshNotes) fake.addBlob(shaOf(`audio for ${id}`), `audio for ${id}`);
    fake.setNotes([wordNote("n1", { text: "EDITED" }), wordNote("n2"), wordNote("n3"), wordNote("n4"), wordNote("v1", { pos: "verb" }), ...notes, ...freshNotes]);

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C21", count: 6 }]);

    const model = outputModel(result.buildId);
    assert.equal(model.cards.filter((c) => c.DECK_ID === "C23").length, 6, "C23's cards were recreated on recovery");
    assert.equal(model.cards.filter((c) => c.DECK_ID === "C25").length, 6, "C25's cards were recreated on recovery");
    assert.equal(model.decks.find((d) => d.Name === "C23").Cards.length, 6, "only C23's recovered A's shipped — E's stay queued");
    assert.equal(model.decks.find((d) => d.Name === "C25").Cards.length, 6, "only C25's recovered A's shipped — E's stay queued");
    const { rows: jobsAfter } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobsAfter[0].status, "succeeded");

    // D93: the successful recovery run must have recorded exactly one
    // shipment (the "A") per recovered card, all tagged to this run's build.
    const { rows: recoveredShipments } = await pool.query(
      "SELECT card_id, letter, build_id FROM occurrence_shipments WHERE card_id LIKE 'C23%' OR card_id LIKE 'C25%' ORDER BY card_id"
    );
    assert.equal(recoveredShipments.length, 12, "6 C23 cards + 6 C25 cards, one shipment each");
    assert.ok(recoveredShipments.every((r) => r.letter === "A" && r.build_id === result.buildId));
  });

  // D91's cross-batch queue mechanics (task 6.2.7), isolated on their own
  // untouched deck (C24, preposisjon) so counts don't entangle with the
  // tests above.
  let c24FirstBuildId;
  await t.test("C24: 2 new notes ship both A's immediately and queue both E's at remaining=11", async () => {
    const p1 = wordNote("p1", { pos: "preposisjon" });
    const p2 = wordNote("p2", { pos: "preposisjon" });
    fake.setNotes([wordNote("n1", { text: "EDITED" }), wordNote("n2"), wordNote("n3"), wordNote("n4"), wordNote("v1", { pos: "verb" }), p1, p2]);
    fake.addBlob(shaOf("audio for p1"), "audio for p1");
    fake.addBlob(shaOf("audio for p2"), "audio for p2");

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C24", count: 2 }]);
    c24FirstBuildId = result.buildId;

    const model = outputModel(result.buildId);
    assert.equal(model.decks.find((d) => d.Name === "C24").Cards.length, 2, "both A's ship, no E's yet");

    // D93: each card's A ships now, tagged to this run's build; nothing
    // for their E yet — it's queued, not shipped.
    const { rows: shipped } = await pool.query(
      "SELECT card_id, letter, build_id FROM occurrence_shipments WHERE card_id IN ('C24001', 'C24002') ORDER BY card_id"
    );
    assert.deepEqual(
      shipped.map((r) => ({ cardId: r.card_id, letter: r.letter, buildId: r.build_id })),
      [
        { cardId: "C24001", letter: "A", buildId: c24FirstBuildId },
        { cardId: "C24002", letter: "A", buildId: c24FirstBuildId },
      ]
    );

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

    const model = outputModel(result.buildId);
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

    const model = outputModel(result.buildId);
    // 3 earlier A's + 10 new A's + 2 drained E's (p1, p2) = 15.
    assert.equal(model.decks.find((d) => d.Name === "C24").Cards.length, 15);

    const queued = await pendingRows("C24");
    assert.equal(queued.length, 11, "p1/p2 drained and removed; p3 (now at 1) plus 10 freshly-queued remain");
    const byRemaining = queued.map((r) => r.remaining).sort((a, b) => a - b);
    assert.deepEqual(byRemaining, [1, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11]);

    // D93: C24001/C24002 were minted (their A shipped) in an earlier build;
    // their E only just drained, in *this* run's build — two shipment rows
    // per card, naming two different builds, exactly what the shipment log
    // exists to represent.
    assert.notEqual(result.buildId, c24FirstBuildId, "sanity: this really is a later build");
    const { rows: bothSides } = await pool.query(
      "SELECT card_id, letter, build_id FROM occurrence_shipments WHERE card_id IN ('C24001', 'C24002') ORDER BY card_id, letter"
    );
    assert.deepEqual(
      bothSides.map((r) => ({ cardId: r.card_id, letter: r.letter, buildId: r.build_id })),
      [
        { cardId: "C24001", letter: "A", buildId: c24FirstBuildId },
        { cardId: "C24001", letter: "E", buildId: result.buildId },
        { cardId: "C24002", letter: "A", buildId: c24FirstBuildId },
        { cardId: "C24002", letter: "E", buildId: result.buildId },
      ]
    );

    // D-H2: this build's own occurrencesForBuild must show both kinds of
    // shipped occurrence together — the 10 freshly-minted A's and the 2
    // drained E's from cards minted long before this run — correctly
    // attributed to the build that actually shipped each one (this build).
    const batchContents = await occurrencesForBuild(pool, result.buildId);
    assert.equal(batchContents.length, 12, "10 new A's + 2 drained E's");
    assert.equal(batchContents.filter((o) => o.letter === "A").length, 10);
    assert.equal(batchContents.filter((o) => o.letter === "E").length, 2);
    assert.ok(batchContents.every((o) => o.kind === "ship" && o.deckCode === "C24"));
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

    const { rows: lastPub } = await pool.query("SELECT build_id FROM publications ORDER BY created_at DESC LIMIT 1");
    const model = outputModel(lastPub[0].build_id);
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
    const grammarRuleLookup = await buildGrammarRuleLookup({ baseUrl: stabburBaseUrl, authToken: fake.authToken });
    const result = await runPublish(pool, { ...config, grammarRuleLookup });
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C29", count: 1 }]);

    const model = outputModel(result.buildId);
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

  await t.test("D-F1: a real publish trims a note's audio to its audio_sel_ms, end to end", async () => {
    // expression -> C26, untouched by every earlier test in this file. Real,
    // ffmpeg-decodable bytes this time (not this suite's usual plain-text
    // "audio for <id>" fixture) — unit-level trim behavior is already
    // covered by `audioSnapshot.test.js`; this proves it reaches the final
    // audio.json manifest through the whole real pipeline.
    const clipPath = path.join(tmpDir, "e1-source.mp3");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", clipPath]);
    const clipBytes = fs.readFileSync(clipPath);
    const clipSha = shaOf(clipBytes);
    fake.addBlob(clipSha, clipBytes);

    const e1 = wordNote("e1", {
      type: "expression",
      pos: undefined,
      text: "god morgen",
      audio_blob: clipSha,
      audio_sel_ms: [500, 1500],
    });
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
      wordNote("g2", { type: "grammar", pos: undefined, grammar_rule_id: "rule-2" }),
      e1,
    ]);

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C26", count: 1 }]);

    const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, "ota", result.buildId, "audio.json"), "utf8"));
    const model = outputModel(result.buildId);
    const e1Card = model.cards.find((c) => c.DECK_ID === "C26" && c.N.includes("god morgen"));
    assert.ok(e1Card, "e1's card should have been minted into C26");

    const manifestSha = manifest[e1Card.ID];
    assert.ok(manifestSha, "e1's card must have a manifest entry");
    assert.notEqual(manifestSha, clipSha, "the manifest must point at the trimmed derivative, not the original upload");

    const trimmedPath = path.join(dataDir, "blob", manifestSha);
    assert.ok(fs.existsSync(trimmedPath));
    const durationOut = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", trimmedPath],
      { encoding: "utf8" }
    );
    const durationMs = Math.round(parseFloat(durationOut.trim()) * 1000);
    assert.ok(Math.abs(durationMs - 1000) < 150, `expected ~1000ms (500-1500 selection), got ${durationMs}ms`);

    const originalPath = path.join(dataDir, "blob", clipSha);
    assert.ok(fs.existsSync(originalPath), "the original upload must still be fetched into hub's blob cache");
    assert.deepEqual(fs.readFileSync(originalPath), clipBytes, "the original must stay byte-identical — D45");
  });

  await t.test("D-H4: a failed run's log shows every checkpoint reached before the failure, not just the terminal error", async () => {
    // C27 (listening), untouched by every earlier test in this file. Plant a
    // colliding card id the same way the D86 test did — directly in hub's
    // ledger, so this run's replay recreates it before mint ever runs.
    const { rows: lastPub } = await pool.query("SELECT build_id FROM publications ORDER BY created_at DESC LIMIT 1");
    await pool.query("INSERT INTO card_slots (id, deck_code, card_no, note_id) VALUES ('C27001', 'C20', 1, 'rogue-note-2')");
    await pool.query("INSERT INTO card_content (card_id, n, e, x, a) VALUES ('C27001', '', '', '', 'N')");
    await pool.query("INSERT INTO occurrence_shipments (card_id, letter, build_id) VALUES ('C27001', 'N', $1)", [
      lastPub[0].build_id,
    ]);

    const lines = [];
    const log = async (buildJobId, line) => lines.push({ buildJobId, line });
    const listeningNote = wordNote("l1", { type: "listening", pos: undefined });
    fake.addBlob(shaOf("audio for l1"), "audio for l1");
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
      wordNote("g2", { type: "grammar", pos: undefined, grammar_rule_id: "rule-2" }),
      wordNote("e1", { type: "expression", pos: undefined, text: "god morgen" }),
      listeningNote,
    ]);

    await assert.rejects(() => runPublish(pool, { ...config, log }), /card id "C27001" already exists/);

    assert.ok(lines.length > 0, "at least some checkpoints were logged before the failure");
    const byBuildJob = new Map();
    for (const { buildJobId, line } of lines) {
      if (!byBuildJob.has(buildJobId)) byBuildJob.set(buildJobId, []);
      byBuildJob.get(buildJobId).push(line);
    }
    assert.equal(byBuildJob.size, 1, "all lines belong to the one build job this run created");
    const [thisRunLines] = [...byBuildJob.values()];
    assert.ok(thisRunLines.some((l) => l.startsWith("pulled")));
    assert.ok(thisRunLines.some((l) => l.startsWith("assign:")));
    assert.ok(thisRunLines.some((l) => l.startsWith("regenerate:")));
    assert.ok(thisRunLines.some((l) => l.includes("mint: C27")));
    assert.ok(!thisRunLines.some((l) => l.startsWith("published")), "never reached — the run failed before publish()");

    const { rows: jobs } = await pool.query("SELECT status FROM build_jobs ORDER BY requested_at DESC LIMIT 1");
    assert.equal(jobs[0].status, "failed");

    // Clean up the planted obstruction so it doesn't affect anything after.
    await pool.query("DELETE FROM occurrence_shipments WHERE card_id = 'C27001'");
    await pool.query("DELETE FROM card_content WHERE card_id = 'C27001'");
    await pool.query("DELETE FROM card_slots WHERE id = 'C27001'");
  });

  await t.test("D-L4: activating a second, different logic bundle changes what the very next publish builds onto", async () => {
    // A second logic bundle, built from a fresh fixture with a different
    // other-module body — proves a publish after activation is built onto
    // the NEW active bundle, not the first one this whole suite started
    // from.
    const secondBundlePath = path.join(tmpDir, "logic-bundle-2.js");
    const secondOtherModule = `__d(function (g, r, i, a, m, e, d) {\n  m.exports = function greet() { return "bonjour"; };\n}, ${OTHER_MODULE_ID}, []);\n`;
    fs.writeFileSync(secondBundlePath, "var __BUNDLE_START_TIME__=1;\n" + buildFixtureBundleSource() + secondOtherModule);
    runExplode(secondBundlePath);
    const secondId = await seedActiveLogicBundle(pool, secondBundlePath, { baseVersion: "1.6.0", patchRev: 2 });
    await pool.query("UPDATE logic_bundles SET active = FALSE WHERE id != $1", [secondId]);

    const h1 = wordNote("h1", { type: "pronunciation", pos: undefined });
    fake.addBlob(shaOf("audio for h1"), "audio for h1");
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
      wordNote("g2", { type: "grammar", pos: undefined, grammar_rule_id: "rule-2" }),
      wordNote("e1", { type: "expression", pos: undefined, text: "god morgen" }),
      wordNote("l1", { type: "listening", pos: undefined }),
      h1,
    ]);

    const result = await runPublish(pool, config);
    assert.equal(result.published, true);
    assert.deepEqual(result.decksMinted, [{ deckCode: "C28", count: 1 }]);

    const { rows: pub } = await pool.query("SELECT base_version, patch_rev, logic_bundle_id FROM publications WHERE build_id = $1", [
      result.buildId,
    ]);
    assert.equal(pub[0].base_version, "1.6.0");
    assert.equal(pub[0].patch_rev, 2);
    assert.equal(pub[0].logic_bundle_id, secondId);

    const model = outputModel(result.buildId);
    const otherModuleAfter = readModuleSource(path.join(dataDir, "ota", "bundle", result.buildId + ".js"), model.manifest[OTHER_MODULE_ID]);
    assert.match(otherModuleAfter, /bonjour/, "built onto the second logic bundle's own unrelated module, not the first's");

    // Everything minted under the first logic bundle must still be present
    // and unchanged — a full replay reconstructs the whole history onto the
    // new base, it doesn't drop anything.
    assert.equal(model.cards.filter((c) => c.DECK_ID === "C20").length, 4, "C20's cards survive the base change");
    assert.equal(model.decks.find((d) => d.Name === "C20").Cards.length, 4);
  });

  t.after(async () => {
    await fake.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await closePool();
  });
});
