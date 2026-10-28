import { query, getPool } from "./db.js";

// D-S2: the shim's `.get()` must never report a document as not existing —
// every write method in mod 2080 is unconditionally gated on `doc.exists`
// with no `else`, so a false negative here silently and permanently blocks
// every future sync. `getOrCreate` is the one place that guarantee lives:
// auto-creates a row with factory defaults on first touch and always
// returns a document, never "missing".
//
// Copied literally from mod 2080's own `S()` (base/smali.mjolnir.merged/
// assets/index.android.bundle.exploded/2080.js) — not paraphrased, per
// task 1.3. `accountCreationDate`/`lastCompletedSession` are ISO strings
// here (JSON has no Date type); the shim's `data()` wraps them back into
// `.toDate()`-bearing objects client-side (D-S3).
export function factoryDefaults() {
  const now = new Date().toISOString();
  return {
    completedSessions: 0,
    totalCards: [],
    gameDecks: [],
    lastDeckPulled: -1,
    restDays: [],
    dailyCards: 15,
    reminderSetting: [
      { days: ["Mo", "Tu", "We", "Th", "Fr"], hour: "08", minute: "00" },
      { days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], hour: "16", minute: "30" },
    ],
    decksStatus: [],
    selectedApproach: [],
    hasSeenMjolnirWay: { firstPage: false, lastPage: false },
    surveyAnswers: [],
    accountCreationDate: now,
    archivedCards: 0,
    inProgressCards: 0,
    hasSeenPaywall: false,
    firstSessionsCompleted: [],
    lastCompletedSession: now,
    acquisitionSource: null,
    marketingSurveySeen: false,
  };
}

// Returns `{ doc, created }` — `created` is true only the very first time a
// given device id is seen, for callers (the GET route) that want to report
// it; the document itself is identical either way.
export async function getOrCreate(deviceId) {
  const { rows } = await query("SELECT doc FROM userdata WHERE device_id = $1", [deviceId]);
  if (rows.length > 0) return { doc: rows[0].doc, created: false };

  const doc = factoryDefaults();
  await query(
    `INSERT INTO userdata (device_id, doc) VALUES ($1, $2)
     ON CONFLICT (device_id) DO NOTHING`,
    [deviceId, doc]
  );
  // A concurrent first-touch could have beaten this insert (ON CONFLICT DO
  // NOTHING) — re-read rather than assume this call's own doc won, so two
  // racing requests always agree on the same stored document.
  const { rows: after } = await query("SELECT doc FROM userdata WHERE device_id = $1", [deviceId]);
  return { doc: after[0].doc, created: true };
}

async function writeHistory(client, deviceId, doc) {
  await client.query("INSERT INTO userdata_history (device_id, doc) VALUES ($1, $2)", [deviceId, doc]);
}

// `.ref.update(patch)` — field-merge, not replace (D-S3). Auto-creates via
// `getOrCreate` first, matching every mod 2080 write method's own
// `.get()`-then-write ordering (D-S2's "no ordering gap to protect
// against" reasoning).
export async function merge(deviceId, patch) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT doc FROM userdata WHERE device_id = $1 FOR UPDATE", [deviceId]);
    const current = rows.length > 0 ? rows[0].doc : factoryDefaults();
    const next = { ...current, ...patch };
    await client.query(
      `INSERT INTO userdata (device_id, doc, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (device_id) DO UPDATE SET doc = $2, updated_at = now()`,
      [deviceId, next]
    );
    await writeHistory(client, deviceId, next);
    await client.query("COMMIT");
    return next;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// `.ref.set(doc)` — full create/overwrite (D-S3). Rarely reached now that
// GET auto-creates, but `initUserData()` can still take this path.
export async function replace(deviceId, doc) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO userdata (device_id, doc, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (device_id) DO UPDATE SET doc = $2, updated_at = now()`,
      [deviceId, doc]
    );
    await writeHistory(client, deviceId, doc);
    await client.query("COMMIT");
    return doc;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// `.ref.delete()` — still writes a final `userdata_history` row (D-S5:
// "last-write-wins storage is not a backup" extends to deletion too).
export async function remove(deviceId) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM userdata WHERE device_id = $1", [deviceId]);
    await writeHistory(client, deviceId, null);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// D-S5: device status piggybacks on the same PATCH payload as progress
// sync (D31) — a separate table, overwritten in place (this is live
// status, not a history to preserve).
export async function updateDeviceState(deviceId, status) {
  const fields = ["activeBuildId", "pendingBuildId", "audioCached", "audioTotal", "lastFetchError"];
  if (!fields.some((f) => status[f] !== undefined)) return;
  await query(
    `INSERT INTO device_state (device_id, active_build_id, pending_build_id, audio_cached, audio_total, last_error, seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (device_id) DO UPDATE SET
       active_build_id = COALESCE($2, device_state.active_build_id),
       pending_build_id = COALESCE($3, device_state.pending_build_id),
       audio_cached = COALESCE($4, device_state.audio_cached),
       audio_total = COALESCE($5, device_state.audio_total),
       last_error = COALESCE($6, device_state.last_error),
       seen_at = now()`,
    [
      deviceId,
      status.activeBuildId ?? null,
      status.pendingBuildId ?? null,
      status.audioCached ?? null,
      status.audioTotal ?? null,
      status.lastFetchError ?? null,
    ]
  );
}
