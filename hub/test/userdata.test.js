import test from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../src/migrate.js";
import { getPool, closePool } from "../src/db.js";
import { getOrCreate, merge, replace, remove, factoryDefaults, listAccounts, perCardProgress, historyDeltas } from "../src/userdata.js";
import { createServer } from "../src/server.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describe = DATABASE_URL ? test : test.skip;

describe("userdata + userdata-console: getOrCreate/merge/replace/remove/listAccounts/perCardProgress/historyDeltas (D-S2/D-S5/D-C3)", async (t) => {
  const pool = getPool();
  await migrate();
  await pool.query("TRUNCATE userdata, userdata_history CASCADE");

  t.after(async () => {
    await closePool();
  });

  await t.test("the first-ever GET for an unknown device id creates and returns factory defaults, not a 404 (D-S2)", async () => {
    const { doc, created } = await getOrCreate("uid-fresh-1");
    assert.equal(created, true);
    assert.deepEqual(doc, factoryDefaults0(doc));
    assert.equal(doc.completedSessions, 0);
    assert.deepEqual(doc.totalCards, []);

    const second = await getOrCreate("uid-fresh-1");
    assert.equal(second.created, false);
    assert.deepEqual(second.doc, doc);
  });

  await t.test("merge field-merges without clobbering untouched fields", async () => {
    await getOrCreate("uid-merge-1");
    const afterFirst = await merge("uid-merge-1", { completedSessions: 3 });
    assert.equal(afterFirst.completedSessions, 3);
    assert.deepEqual(afterFirst.totalCards, []); // untouched

    const afterSecond = await merge("uid-merge-1", { totalCards: [{ ID: "C20001" }] });
    assert.equal(afterSecond.completedSessions, 3); // still there — not clobbered
    assert.deepEqual(afterSecond.totalCards, [{ ID: "C20001" }]);
  });

  await t.test("merge auto-creates when no row exists yet — no ordering gap (D-S2)", async () => {
    const doc = await merge("uid-merge-fresh", { completedSessions: 1 });
    assert.equal(doc.completedSessions, 1);
    assert.deepEqual(doc.gameDecks, []);
  });

  await t.test("every merge/replace/remove writes exactly one userdata_history row", async () => {
    const deviceId = "uid-history-1";
    await getOrCreate(deviceId);
    const countRows = async () => {
      const { rows } = await pool.query("SELECT count(*) FROM userdata_history WHERE device_id = $1", [deviceId]);
      return Number(rows[0].count);
    };

    await merge(deviceId, { completedSessions: 5 });
    assert.equal(await countRows(), 1);

    await replace(deviceId, { ...factoryDefaults(), completedSessions: 9 });
    assert.equal(await countRows(), 2);

    await remove(deviceId);
    assert.equal(await countRows(), 3);

    const { rows } = await pool.query(
      "SELECT doc FROM userdata_history WHERE device_id = $1 ORDER BY id DESC LIMIT 1",
      [deviceId]
    );
    assert.equal(rows[0].doc, null); // deletion's history row records the removal
  });

  await t.test("HTTP: GET/PATCH/POST/DELETE /mjolnir/userdata/:uid; stray deviceId/device-status fields from an older build are stripped, not merged into the doc", async () => {
    const server = createServer(pool, { dataDir: ".", publicBase: "http://localhost:8080", workbenchPatchesDir: "." });
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      const getRes = await fetch(`http://localhost:${port}/mjolnir/userdata/${encodeURIComponent("uid-http-1")}`);
      assert.equal(getRes.status, 200);
      const getDoc = await getRes.json();
      assert.equal(getDoc.completedSessions, 0);

      const patchRes = await fetch(`http://localhost:${port}/mjolnir/userdata/${encodeURIComponent("uid-http-1")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "device-http-1",
          completedSessions: 7,
          activeBuildId: "b900001",
          audioCached: 3,
          audioTotal: 5,
        }),
      });
      assert.equal(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.equal(patched.completedSessions, 7);
      assert.equal(patched.activeBuildId, undefined); // a stray status field never lands in the synced doc
      assert.equal(patched.deviceId, undefined); // deviceId never lands in the synced doc either

      const postRes = await fetch(`http://localhost:${port}/mjolnir/userdata/${encodeURIComponent("uid-http-1")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...factoryDefaults(), completedSessions: 42 }),
      });
      assert.equal(postRes.status, 200);
      assert.equal((await postRes.json()).completedSessions, 42);

      const delRes = await fetch(`http://localhost:${port}/mjolnir/userdata/${encodeURIComponent("uid-http-1")}`, {
        method: "DELETE",
      });
      assert.equal(delRes.status, 200);

      const afterDelete = await fetch(`http://localhost:${port}/mjolnir/userdata/${encodeURIComponent("uid-http-1")}`);
      assert.equal(afterDelete.status, 200); // GET re-creates, never 404s (D-S2)
      assert.equal((await afterDelete.json()).completedSessions, 0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // userdata-console's own tests live in this same describe block (not a
  // separate file) deliberately — a separate file would need its own
  // `TRUNCATE userdata, userdata_history`, which races
  // against this file's own truncate when `node --test` runs multiple
  // files concurrently against the same live database (confirmed: a
  // separate file caused real, intermittent cross-file failures — "Cannot
  // read properties of undefined", stale row counts, even a Postgres
  // deadlock — none of which were bugs in the code under test).
  //
  // `card_slots`/`decks`/`card_content` are still shared with hub.test.js/
  // cardContent.test.js (neither of which this describe block truncates),
  // so `ensureFixtureCard`/`perCardProgressStable` guard against *that*
  // remaining cross-file race the same way.
  async function ensureFixtureCard() {
    await pool.query("INSERT INTO decks (code, title, category) VALUES ('C20', 'Substantiv', 'C') ON CONFLICT (code) DO NOTHING");
    await pool.query(
      "INSERT INTO card_slots (id, deck_code, card_no, note_id) VALUES ('C20077', 'C20', 77, 'console-note-1') ON CONFLICT (id) DO NOTHING"
    );
    await pool.query(
      "INSERT INTO card_content (card_id, n, e, x, a) VALUES ('C20077', '<div>hus</div>', '<div>house</div>', null, 'N') ON CONFLICT (card_id) DO NOTHING"
    );
  }
  async function perCardProgressStable(uid) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const rows = await perCardProgress(uid);
      if (rows.length === 0 || rows.every((r) => r.content !== null)) return rows;
      await ensureFixtureCard();
    }
    return perCardProgress(uid);
  }

  await t.test("D-C3: the Content column (perCardProgress) shows the card's N text identically for its N-side and E-side rows", async () => {
    await ensureFixtureCard();
    const uid = "uid-console-1";
    await merge(uid, {
      totalCards: [
        { ID: "C20077", language: "N", Stage: 14, Park: false, Graduated: false, Type: "same", Time: Date.now() },
        { ID: "C20077", language: "E", Stage: 9, Park: false, Graduated: false, Type: "same", Time: Date.now() },
      ],
    });

    const rows = await perCardProgressStable(uid);
    assert.equal(rows.length, 2);
    const nSide = rows.find((r) => r.side === "N");
    const eSide = rows.find((r) => r.side === "E");
    assert.equal(nSide.content, "<div>hus</div>");
    assert.equal(eSide.content, "<div>hus</div>"); // same N text, never the card's E field
  });

  await t.test("listAccounts lists every distinct uid that has a userdata row", async () => {
    const uid = "uid-console-3";
    await merge(uid, { completedSessions: 1 });
    const accounts = await listAccounts();
    assert.ok(accounts.includes(uid));
  });

  await t.test("historyDeltas summarizes session-count and card-count deltas against the previous entry", async () => {
    const uid = "uid-console-4";
    await merge(uid, { completedSessions: 1, totalCards: [] });
    await merge(uid, { completedSessions: 2, totalCards: [{ ID: "C20077" }] });

    const history = await historyDeltas(uid, { limit: 10 });
    assert.equal(history.length, 2);
    const [latest, oldest] = history; // DESC order
    assert.equal(latest.title, "Session completed");
    assert.ok(latest.detail.some((d) => d.label === "completedSessions" && d.text === "1 → 2"));
    assert.ok(latest.detail.some((d) => d.label === "totalCards" && d.text === "+1"));
    // The oldest fetched row has no predecessor within the window it can be
    // diffed against in this test (nothing written before it) — still gets
    // a sensible summary, not a crash.
    assert.ok(oldest.title);
  });

  await t.test("HTTP: /mjolnir/device renders the progress snapshot for the selected account", async () => {
    await ensureFixtureCard();
    const uid = "uid-console-http";
    await merge(uid, { completedSessions: 5, totalCards: [{ ID: "C20077", language: "N" }] });

    const server = createServer(pool, { dataDir: ".", publicBase: "http://localhost:8080", workbenchPatchesDir: "." });
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      const html = await (await fetch(`http://localhost:${port}/mjolnir/device?uid=${encodeURIComponent(uid)}`)).text();
      assert.ok(html.includes(uid));
      assert.ok(html.includes("Progress snapshot"));
      assert.ok(html.includes("Per-card progress"));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

// `factoryDefaults()` stamps two fields with `new Date().toISOString()` at
// call time — comparing a freshly-created doc against a fresh call isn't
// stable to the millisecond, so this normalizes those two fields away
// before a deepEqual against the real fixture.
function factoryDefaults0(doc) {
  const expected = factoryDefaults();
  expected.accountCreationDate = doc.accountCreationDate;
  expected.lastCompletedSession = doc.lastCompletedSession;
  return expected;
}
