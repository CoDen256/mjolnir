import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const COMPANION_SOURCE = fs.readFileSync(
  path.resolve("patches/js/progress-sync-restore-companion.js"),
  "utf8"
);

const MOD_ASYNC_STORAGE = 986;
const MOD_FIREBASE_AUTH = 1220;
const MOD_STORE = 953;
const MOD_DECK_ACTIONS = 1408;
const MOD_SETTINGS_ACTIONS = 1411;
const MOD_DECKS_LOGIC = 2110;

// Runs the companion's own IIFE (it self-invokes — there is no factory
// function to extract, unlike a patchback pair) against a fully mocked
// `__r`/`fetch`, both installed as real globals the same way the real app
// provides them (`boot-ok-companion.js`'s own pattern). Returns the
// recorded dispatch calls, fetch calls, and AsyncStorage marker writes.
async function runCompanion({ marker = null, deviceId = null, uid = "uid-1", docResponse = {} } = {}) {
  const dispatched = [];
  const asyncStorageWrites = [];
  const initDecksStatusCalls = [];
  const fetchCalls = [];
  const storageState = { "mjolnir-sync-restore-done": marker, "mjolnir-device-id": deviceId };

  const store = {
    getState: () => ({ deckStats: { decks_info: [{ ID: "C20", PullCounter: 3 }] } }),
    dispatch: (action) => dispatched.push(action),
  };

  const deckActions = {
    setLastDeckPulled: (v) => ({ type: "SET_LAST_DECK_PULLED", payload: v }),
    setDecks: (v) => ({ type: "SET_DECKS", payload: v }),
    setCompletedSessions: (v) => ({ type: "SET_COMPLETED_SESSIONS", payload: v }),
    setTotalCards: (v) => ({ type: "SET_TOTAL_CARDS", payload: v }),
    setDecksInfo: (v) => ({ type: "SET_DECKS_INFO", payload: v }),
  };
  const settingsActions = {
    setRestDays: (v) => ({ type: "SET_REST_DAYS", payload: v }),
    setDailyCards: (v) => ({ type: "SET_DAILY_CARDS", payload: v }),
    setReminderSetting: (v) => ({ type: "SET_REMINDER_SETTING", payload: v }),
    setMarketingSurveySeen: (v) => ({ type: "SET_MARKETING_SURVEY_SEEN", payload: v }),
    setAcquisitionSource: (v) => ({ type: "SET_ACQUISITION_SOURCE", payload: v }),
    setSelectedApproach: (v) => ({ type: "SET_SELECTED_APPROACH", payload: v }),
    setHasSeenMjolnirWay: (v) => ({ type: "SET_HAS_SEEN_MJOLNIR_WAY", payload: v }),
  };
  const decksLogic = {
    initDecksStatus: (current, incoming) => {
      initDecksStatusCalls.push({ current, incoming });
      return [...current, ...incoming];
    },
  };

  const registry = {
    [MOD_ASYNC_STORAGE]: {
      default: {
        getItem: async (key) => (key in storageState ? storageState[key] : null),
        setItem: async (key, value) => {
          storageState[key] = value;
          asyncStorageWrites.push({ key, value });
        },
      },
    },
    [MOD_FIREBASE_AUTH]: {
      default: () => ({ currentUser: uid ? { uid } : null }),
    },
    [MOD_STORE]: { default: store },
    [MOD_DECK_ACTIONS]: deckActions,
    [MOD_SETTINGS_ACTIONS]: settingsActions,
    [MOD_DECKS_LOGIC]: { default: decksLogic },
  };

  global.__r = (id) => {
    if (!(id in registry)) throw new Error(`unexpected __r(${id}) in test`);
    return registry[id];
  };
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return { json: async () => docResponse };
  };

  const indirectEval = eval;
  indirectEval(COMPANION_SOURCE);

  // The companion's own promise chain runs detached (fire-and-forget, same
  // as the real app calling it) — give it a tick to settle before asserting.
  await new Promise((resolve) => setTimeout(resolve, 20));

  const globalDeviceId = globalThis.MJOLNIR_DEVICE_ID;
  delete global.__r;
  delete global.fetch;
  delete globalThis.MJOLNIR_DEVICE_ID;

  return {
    dispatched,
    asyncStorageWrites,
    initDecksStatusCalls,
    fetchCalls,
    globalDeviceId,
    deviceIdWrites: asyncStorageWrites.filter((w) => w.key === "mjolnir-device-id"),
    markerWrites: asyncStorageWrites.filter((w) => w.key === "mjolnir-sync-restore-done"),
  };
}

test("progress-sync-restore-companion: a device with an existing restore marker takes no restorative action, but still mints a device id if none exists yet (D-S4/D-C2)", async () => {
  const { dispatched, fetchCalls, markerWrites, deviceIdWrites, globalDeviceId } = await runCompanion({ marker: "1" });
  assert.equal(fetchCalls.length, 0);
  assert.equal(dispatched.length, 0);
  assert.equal(markerWrites.length, 0); // doesn't even rewrite the marker — it's a no-op once set
  // Device-id minting is independent of the restore-marker flow — it still
  // runs on this launch, since no device id was persisted yet.
  assert.equal(deviceIdWrites.length, 1);
  assert.equal(globalDeviceId, deviceIdWrites[0].value);
});

test("progress-sync-restore-companion: an existing restore marker AND an existing device id — no action of any kind", async () => {
  const { dispatched, fetchCalls, asyncStorageWrites, globalDeviceId } = await runCompanion({
    marker: "1",
    deviceId: "already-minted-id",
  });
  assert.equal(fetchCalls.length, 0);
  assert.equal(dispatched.length, 0);
  assert.equal(asyncStorageWrites.length, 0);
  assert.equal(globalDeviceId, "already-minted-id");
});

test("progress-sync-restore-companion (D-C2): a device id is minted exactly once and stays stable across subsequent launches, including a sign-out/sign-in", async () => {
  const first = await runCompanion({ marker: "1" });
  assert.equal(first.deviceIdWrites.length, 1);
  const mintedId = first.deviceIdWrites[0].value;

  // A later launch, already signed out (no uid) — the persisted id must be
  // read back unchanged, not re-minted.
  const second = await runCompanion({ marker: "1", deviceId: mintedId, uid: null });
  assert.equal(second.deviceIdWrites.length, 0);
  assert.equal(second.globalDeviceId, mintedId);

  // Signing back in on the same physical device — still the same id.
  const third = await runCompanion({ marker: "1", deviceId: mintedId, uid: "uid-1" });
  assert.equal(third.deviceIdWrites.length, 0);
  assert.equal(third.globalDeviceId, mintedId);
});

test("progress-sync-restore-companion: no marker, a real server document — restores via the same action creators mod 2205 uses, then sets the marker", async () => {
  const doc = {
    restDays: ["Sa"],
    dailyCards: 20,
    lastDeckPulled: 2,
    gameDecks: ["C20", "C21"],
    reminderSetting: [{ hour: "08" }, { hour: "16" }],
    completedSessions: 7,
    totalCards: [{ ID: "C20001" }],
    marketingSurveySeen: true,
    acquisitionSource: "organic",
    selectedApproach: ["casual"],
    hasSeenMjolnirWay: { firstPage: true, lastPage: true },
    decksStatus: [{ ID: "C21", PullCounter: 1 }],
  };
  const { dispatched, markerWrites, initDecksStatusCalls, fetchCalls } = await runCompanion({
    marker: null,
    deviceId: "already-minted-id",
    docResponse: doc,
  });

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/uid-1$/);

  const types = dispatched.map((a) => a.type);
  assert.deepEqual(types, [
    "SET_REST_DAYS",
    "SET_DAILY_CARDS",
    "SET_LAST_DECK_PULLED",
    "SET_DECKS",
    "SET_REMINDER_SETTING",
    "SET_REMINDER_SETTING",
    "SET_COMPLETED_SESSIONS",
    "SET_TOTAL_CARDS",
    "SET_MARKETING_SURVEY_SEEN",
    "SET_ACQUISITION_SOURCE",
    "SET_SELECTED_APPROACH",
    "SET_HAS_SEEN_MJOLNIR_WAY",
    "SET_DECKS_INFO",
  ]);
  assert.equal(dispatched.find((a) => a.type === "SET_COMPLETED_SESSIONS").payload, 7);
  assert.deepEqual(dispatched.find((a) => a.type === "SET_TOTAL_CARDS").payload, [{ ID: "C20001" }]);

  assert.equal(initDecksStatusCalls.length, 1);
  assert.deepEqual(initDecksStatusCalls[0].current, [{ ID: "C20", PullCounter: 3 }]);
  assert.deepEqual(initDecksStatusCalls[0].incoming, doc.decksStatus);

  assert.deepEqual(markerWrites, [{ key: "mjolnir-sync-restore-done", value: "1" }]);
});

test("progress-sync-restore-companion: a doc that is only this call's own auto-creation is not restored, but the marker is still set (D-S2/D-S4)", async () => {
  const { dispatched, markerWrites, fetchCalls } = await runCompanion({
    marker: null,
    deviceId: "already-minted-id",
    docResponse: { completedSessions: 0, totalCards: [], _justCreated: true },
  });
  assert.equal(fetchCalls.length, 1);
  assert.equal(dispatched.length, 0);
  assert.deepEqual(markerWrites, [{ key: "mjolnir-sync-restore-done", value: "1" }]);
});

test("progress-sync-restore-companion: not signed in — no fetch at all, marker still set (mirrors mod 2080's own unhandled currentUser gap, D-S1)", async () => {
  const { dispatched, fetchCalls, markerWrites } = await runCompanion({
    marker: null,
    deviceId: "already-minted-id",
    uid: null,
  });
  assert.equal(fetchCalls.length, 0);
  assert.equal(dispatched.length, 0);
  assert.deepEqual(markerWrites, [{ key: "mjolnir-sync-restore-done", value: "1" }]);
});

test("progress-sync-restore-companion: the check never repeats once the marker is set — a second run with a marker present does nothing", async () => {
  const first = await runCompanion({
    marker: null,
    deviceId: "already-minted-id",
    docResponse: { completedSessions: 3, totalCards: [] },
  });
  assert.equal(first.markerWrites.length, 1);

  const second = await runCompanion({ marker: "1", docResponse: { completedSessions: 3, totalCards: [] } });
  assert.equal(second.fetchCalls.length, 0);
  assert.equal(second.dispatched.length, 0);
});
