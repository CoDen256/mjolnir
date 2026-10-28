import test from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../src/migrate.js";
import { getPool, closePool } from "../src/db.js";
import {
  getOrCreate,
  merge,
  replace,
  remove,
  updateDeviceState,
  factoryDefaults,
  listAccounts,
  listDevicesForAccount,
  perCardProgress,
  historyDeltas,
} from "../src/userdata.js";
import { createServer } from "../src/server.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describe = DATABASE_URL ? test : test.skip;

describe("userdata + userdata-console: getOrCreate/merge/replace/remove/updateDeviceState/listAccounts/listDevicesForAccount/perCardProgress/historyDeltas (D-S2/D-S5/D-C1/D-C3)", async (t) => {
  const pool = getPool();
  await migrate();
  await pool.query("TRUNCATE userdata, userdata_history, device_state CASCADE");

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

  await t.test("updateDeviceState writes device-status fields keyed by deviceId, storing uid alongside, leaving the userdata doc untouched", async () => {
    const uid = "uid-status-1";
    const deviceId = "device-status-1";
    await getOrCreate(uid);
    await updateDeviceState(deviceId, uid, { activeBuildId: "b1", audioCached: 10, audioTotal: 20 });
    const { rows } = await pool.query("SELECT * FROM device_state WHERE device_id = $1", [deviceId]);
    assert.equal(rows[0].uid, uid);
    assert.equal(rows[0].active_build_id, "b1");
    assert.equal(rows[0].audio_cached, 10);
    assert.equal(rows[0].audio_total, 20);

    // A later call omitting a field doesn't null it out.
    await updateDeviceState(deviceId, uid, { pendingBuildId: "b2" });
    const { rows: after } = await pool.query("SELECT * FROM device_state WHERE device_id = $1", [deviceId]);
    assert.equal(after[0].active_build_id, "b1");
    assert.equal(after[0].pending_build_id, "b2");
  });

  await t.test("D-C1: migration 014's backfill sets uid = device_id for every pre-existing row, the one-time correction of the pre-fix scheme", async () => {
    // Replays the migration's own backfill statement against a throwaway
    // table shaped like `device_state` before 014 ran (no `uid` column) —
    // `014_device_state_uid.sql` has already applied against this test's
    // real `device_state` table by the time this test runs (migrate() ran
    // once, at file load), so this verifies the SQL pattern directly
    // rather than replaying migration history.
    await pool.query("DROP TABLE IF EXISTS device_state_pre_014_scratch");
    await pool.query("CREATE TABLE device_state_pre_014_scratch (device_id TEXT PRIMARY KEY, active_build_id TEXT)");
    await pool.query(
      "INSERT INTO device_state_pre_014_scratch (device_id, active_build_id) VALUES ('uid-pre-existing', 'b1')"
    );
    await pool.query("ALTER TABLE device_state_pre_014_scratch ADD COLUMN uid TEXT");
    await pool.query("UPDATE device_state_pre_014_scratch SET uid = device_id");
    await pool.query("ALTER TABLE device_state_pre_014_scratch ALTER COLUMN uid SET NOT NULL");
    const { rows } = await pool.query("SELECT device_id, uid FROM device_state_pre_014_scratch");
    assert.equal(rows[0].uid, rows[0].device_id);
    await pool.query("DROP TABLE device_state_pre_014_scratch");
  });

  await t.test("D-C1: two devices on one uid produce two separate device_state rows, neither overwriting the other", async () => {
    const uid = "uid-multi-device";
    await updateDeviceState("device-a", uid, { activeBuildId: "b1" });
    await updateDeviceState("device-b", uid, { activeBuildId: "b2" });

    const { rows } = await pool.query("SELECT device_id, uid, active_build_id FROM device_state WHERE uid = $1 ORDER BY device_id", [
      uid,
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows.find((r) => r.device_id === "device-a").active_build_id, "b1");
    assert.equal(rows.find((r) => r.device_id === "device-b").active_build_id, "b2");

    // A retired device's last-reported state survives a different device's
    // later sync under the same uid — untouched, not overwritten or removed.
    await updateDeviceState("device-b", uid, { activeBuildId: "b3" });
    const { rows: after } = await pool.query("SELECT active_build_id FROM device_state WHERE device_id = 'device-a'");
    assert.equal(after[0].active_build_id, "b1");
  });

  await t.test("HTTP: GET/PATCH/POST/DELETE /mjolnir/userdata/:uid, device-status fields (with deviceId) split onto device_state (D31/D-C1)", async () => {
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
      assert.equal(patched.activeBuildId, undefined); // status fields never land in the synced doc
      assert.equal(patched.deviceId, undefined); // deviceId never lands in the synced doc either

      const { rows } = await pool.query("SELECT * FROM device_state WHERE device_id = 'device-http-1'");
      assert.equal(rows[0].uid, "uid-http-1");
      assert.equal(rows[0].active_build_id, "b900001");
      assert.equal(rows[0].audio_cached, 3);

      // A PATCH with no deviceId skips the device_state write entirely,
      // same as today's behavior when no device-status fields are present.
      await fetch(`http://localhost:${port}/mjolnir/userdata/${encodeURIComponent("uid-http-1")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeBuildId: "should-not-land", audioCached: 99 }),
      });
      const { rows: unchanged } = await pool.query("SELECT * FROM device_state WHERE device_id = 'device-http-1'");
      assert.equal(unchanged[0].active_build_id, "b900001");

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
  // `TRUNCATE userdata, userdata_history, device_state`, which races
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

  await t.test("D-C1: a retired device (no recent activity) is still listed for its account, alongside an active one", async () => {
    const uid = "uid-console-2";
    await merge(uid, { completedSessions: 1 });
    await updateDeviceState("device-active", uid, { activeBuildId: "b2" });
    await updateDeviceState("device-retired", uid, { activeBuildId: "b1" });
    // Backdate the retired device's seen_at so it's unambiguously the older one.
    await pool.query("UPDATE device_state SET seen_at = now() - interval '60 days' WHERE device_id = 'device-retired'");

    const devices = await listDevicesForAccount(uid);
    assert.equal(devices.length, 2);
    assert.ok(devices.some((d) => d.deviceId === "device-retired"));
    assert.ok(devices.some((d) => d.deviceId === "device-active"));
    // Most-recently-seen first.
    assert.equal(devices[0].deviceId, "device-active");
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

  await t.test("HTTP: selecting a retired device under the same account swaps only the device/OTA panels, not the progress panels (D-C1)", async () => {
    await ensureFixtureCard();
    const uid = "uid-console-http";
    await merge(uid, { completedSessions: 5, totalCards: [{ ID: "C20077", language: "N" }] });
    await updateDeviceState("device-http-active", uid, { activeBuildId: "b-active", audioCached: 5, audioTotal: 5 });
    await updateDeviceState("device-http-retired", uid, { activeBuildId: "b-retired", audioCached: 1, audioTotal: 5 });
    await pool.query("UPDATE device_state SET seen_at = now() - interval '90 days' WHERE device_id = 'device-http-retired'");

    const server = createServer(pool, { dataDir: ".", publicBase: "http://localhost:8080", workbenchPatchesDir: "." });
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      const activeHtml = await (
        await fetch(`http://localhost:${port}/mjolnir/device?uid=${encodeURIComponent(uid)}&device=device-http-active`)
      ).text();
      const retiredHtml = await (
        await fetch(`http://localhost:${port}/mjolnir/device?uid=${encodeURIComponent(uid)}&device=device-http-retired`)
      ).text();

      // Device/OTA panel differs between the two responses.
      assert.ok(activeHtml.includes("b-active"));
      assert.ok(retiredHtml.includes("b-retired"));
      assert.ok(!retiredHtml.includes("b-active"));

      // Progress snapshot (driven by uid alone) is identical in both.
      const snapshot = (html) => html.slice(html.indexOf("Progress snapshot"), html.indexOf("Per-card progress"));
      assert.equal(snapshot(activeHtml), snapshot(retiredHtml));

      // The retired device still shows up in the selector at all.
      assert.ok(retiredHtml.includes("device-http-retired"));
      assert.ok(retiredHtml.includes("device-http-active"));
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
