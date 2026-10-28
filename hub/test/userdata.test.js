import test from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../src/migrate.js";
import { getPool, closePool } from "../src/db.js";
import { getOrCreate, merge, replace, remove, updateDeviceState, factoryDefaults } from "../src/userdata.js";
import { createServer } from "../src/server.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describe = DATABASE_URL ? test : test.skip;

describe("userdata: getOrCreate/merge/replace/remove/updateDeviceState (D-S2/D-S5)", async (t) => {
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

  await t.test("updateDeviceState writes device-status fields, leaving the userdata doc untouched", async () => {
    const deviceId = "uid-status-1";
    await getOrCreate(deviceId);
    await updateDeviceState(deviceId, { activeBuildId: "b1", audioCached: 10, audioTotal: 20 });
    const { rows } = await pool.query("SELECT * FROM device_state WHERE device_id = $1", [deviceId]);
    assert.equal(rows[0].active_build_id, "b1");
    assert.equal(rows[0].audio_cached, 10);
    assert.equal(rows[0].audio_total, 20);

    // A later call omitting a field doesn't null it out.
    await updateDeviceState(deviceId, { pendingBuildId: "b2" });
    const { rows: after } = await pool.query("SELECT * FROM device_state WHERE device_id = $1", [deviceId]);
    assert.equal(after[0].active_build_id, "b1");
    assert.equal(after[0].pending_build_id, "b2");
  });

  await t.test("HTTP: GET/PATCH/POST/DELETE /mjolnir/userdata/:deviceId, device-status fields split onto device_state (D31)", async () => {
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
        body: JSON.stringify({ completedSessions: 7, activeBuildId: "b900001", audioCached: 3, audioTotal: 5 }),
      });
      assert.equal(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.equal(patched.completedSessions, 7);
      assert.equal(patched.activeBuildId, undefined); // status fields never land in the synced doc

      const { rows } = await pool.query("SELECT * FROM device_state WHERE device_id = 'uid-http-1'");
      assert.equal(rows[0].active_build_id, "b900001");
      assert.equal(rows[0].audio_cached, 3);

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
