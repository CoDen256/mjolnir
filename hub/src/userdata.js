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

// D-S5/D-C1: device status piggybacks on the same PATCH payload as progress
// sync (D31) — a separate table, overwritten in place (this is live
// status, not a history to preserve), keyed by `deviceId` (a real,
// locally-generated per-device id — never the uid). `uid` rides along as a
// non-key column so the console can list every device an account has ever
// synced from (`listDevicesForAccount`). Two devices signed into the same
// `uid` get two independent rows; a device that stops syncing keeps its
// last-written row untouched by a different device's later sync, since
// each is a separate `deviceId`.
export async function updateDeviceState(deviceId, uid, status) {
  const fields = ["activeBuildId", "pendingBuildId", "audioCached", "audioTotal", "lastFetchError"];
  if (!fields.some((f) => status[f] !== undefined)) return;
  await query(
    `INSERT INTO device_state (device_id, uid, active_build_id, pending_build_id, audio_cached, audio_total, last_error, seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (device_id) DO UPDATE SET
       uid = $2,
       active_build_id = COALESCE($3, device_state.active_build_id),
       pending_build_id = COALESCE($4, device_state.pending_build_id),
       audio_cached = COALESCE($5, device_state.audio_cached),
       audio_total = COALESCE($6, device_state.audio_total),
       last_error = COALESCE($7, device_state.last_error),
       seen_at = now()`,
    [
      deviceId,
      uid,
      status.activeBuildId ?? null,
      status.pendingBuildId ?? null,
      status.audioCached ?? null,
      status.audioTotal ?? null,
      status.lastFetchError ?? null,
    ]
  );
}

// ---- userdata-console: read-only queries for the Device sync page ----

// Every distinct account (uid) ever seen — `userdata.device_id` is the uid
// column despite its name (D-S1; never renamed, D-C1's smaller-diff
// reasoning extends to this pre-existing column too).
export async function listAccounts() {
  const { rows } = await query("SELECT device_id AS uid FROM userdata ORDER BY device_id");
  return rows.map((r) => r.uid);
}

// Every device `device_state` has ever recorded for this uid, most-recently
// -seen first — including a device that has stopped syncing (D-C1's Open
// Question: "yes, this is useful information, not noise"). A device with
// OTA/audio activity but zero study sessions still shows up here, since
// `device_state` is independent of whether `userdata` has any content for
// this uid at all.
export async function listDevicesForAccount(uid) {
  const { rows } = await query(
    `SELECT device_id, active_build_id, pending_build_id, audio_cached, audio_total, last_error, seen_at
     FROM device_state WHERE uid = $1 ORDER BY seen_at DESC`,
    [uid]
  );
  return rows.map((r) => ({
    deviceId: r.device_id,
    activeBuildId: r.active_build_id,
    pendingBuildId: r.pending_build_id,
    audioCached: r.audio_cached,
    audioTotal: r.audio_total,
    lastError: r.last_error,
    seenAt: r.seen_at,
  }));
}

// D-C3: the account's `totalCards` joined against `card_content` — same
// `card_slots`/`decks`/`card_content` join shape `hub/src/cards.js`'s
// `cardsList` already uses, reused rather than reinvented, selecting only
// `card_content.n` (never `.e`) so the Content column always shows the
// card's identifying text regardless of which occurrence side this row is.
export async function perCardProgress(uid) {
  const { rows } = await query("SELECT doc FROM userdata WHERE device_id = $1", [uid]);
  if (rows.length === 0) return [];
  const totalCards = rows[0].doc.totalCards || [];
  if (totalCards.length === 0) return [];

  const cardIds = totalCards.map((c) => c.ID);
  const { rows: contentRows } = await query(
    `SELECT cs.id, cs.deck_code, d.title AS deck_title, cc.n
     FROM card_slots cs
     JOIN decks d ON d.code = cs.deck_code
     LEFT JOIN card_content cc ON cc.card_id = cs.id
     WHERE cs.id = ANY($1)`,
    [cardIds]
  );
  const byId = new Map(contentRows.map((r) => [r.id, r]));

  return totalCards.map((c) => {
    const info = byId.get(c.ID);
    return {
      id: c.ID,
      content: info ? info.n : null,
      side: c.language, // the stored direction letter (N/E/A) — findings.md C1
      deckCode: info ? info.deck_code : null,
      deckTitle: info ? info.deck_title : null,
      stage: c.Stage,
      park: !!c.Park,
      graduated: !!c.Graduated,
      type: c.Type,
      lastReviewedAt: c.Time ? new Date(c.Time) : null,
    };
  });
}

// Summarizes one `userdata_history` row against its predecessor — session-
// count delta, totalCards-length delta, or (when neither changed) which
// other top-level fields differ. There is no stored event-type/provenance
// tag (D-S5 only ever records the resulting document, not which mod 2080
// method produced it), so the title is inferred from what actually changed,
// not a literal replay of which screen caused it.
function summarizeDelta(doc, prevDoc) {
  if (doc === null) return { title: "Account deleted", detail: [] };
  const prev = prevDoc || {};
  const detail = [];

  const sessionsChanged = prev.completedSessions !== doc.completedSessions;
  const cardsDelta = (doc.totalCards?.length ?? 0) - (prev.totalCards?.length ?? 0);

  if (sessionsChanged) {
    detail.push({
      label: "completedSessions",
      text: `${prev.completedSessions ?? "—"} → ${doc.completedSessions}`,
      up: (doc.completedSessions ?? 0) > (prev.completedSessions ?? 0),
    });
  }
  if (cardsDelta !== 0) {
    detail.push({ label: "totalCards", text: `${cardsDelta > 0 ? "+" : ""}${cardsDelta}`, up: cardsDelta > 0 });
  }

  if (sessionsChanged && cardsDelta !== 0) return { title: "Session completed", detail };
  if (sessionsChanged) return { title: "Progress updated", detail };
  if (cardsDelta !== 0) return { title: "Cards updated", detail };

  const changedKeys = Object.keys(doc).filter((k) => JSON.stringify(doc[k]) !== JSON.stringify(prev[k]));
  if (changedKeys.length > 0) {
    return {
      title: "Settings updated",
      detail: changedKeys.slice(0, 4).map((k) => ({ label: k, text: "changed", up: null })),
    };
  }
  return { title: "Synced", detail: [] };
}

// `limit + 1` rows are fetched so the oldest row returned still has a real
// predecessor to diff against; that extra row is used only for the diff,
// never returned itself.
export async function historyDeltas(uid, { limit = 20 } = {}) {
  const { rows } = await query(
    "SELECT id, doc, at FROM userdata_history WHERE device_id = $1 ORDER BY at DESC LIMIT $2",
    [uid, limit + 1]
  );
  return rows.slice(0, limit).map((row, i) => ({
    id: row.id,
    doc: row.doc,
    at: row.at,
    ...summarizeDelta(row.doc, rows[i + 1]?.doc),
  }));
}
