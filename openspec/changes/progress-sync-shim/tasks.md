## 0. Before you write any code

Read `design.md` in full, especially D-S2 (the exists-guarantee lives
server-side on `GET`, not duplicated client-side) and D-S4 (the startup
module does restore only — it is not a second place that guarantees
existence). Read mod 2080's actual source
(`base/smali.mjolnir.merged/assets/index.android.bundle.exploded/2080.js`)
before patching — confirm the method bodies against the real file, not just
this design doc's quoted excerpts, in case the base bundle has moved.

## 1. hub schema and endpoints

- [x] 1.1 Migration: `userdata(device_id TEXT PK, doc JSONB, updated_at)`,
      `userdata_history(id SERIAL PK, device_id TEXT, doc JSONB, at
      TIMESTAMPTZ)`, `device_state(device_id TEXT PK, active_build_id,
      pending_build_id, audio_cached, audio_total, last_error, seen_at)`.
- [x] 1.2 `hub/src/userdata.js`: `getOrCreate(deviceId)` (D-S2 — auto-creates
      factory defaults on first touch, never returns "missing"), `merge
      (deviceId, patch)` (field-merge, writes `userdata` + a
      `userdata_history` row), `replace(deviceId, doc)` (the `.ref.set()`
      path), `remove(deviceId)` (the `.ref.delete()` path — also writes a
      final `userdata_history` row per D-S5's "last-write-wins is not a
      backup" reasoning).
- [x] 1.3 Factory defaults in `getOrCreate` match mod 2080's own `S()`
      shape exactly (`completedSessions: 0, totalCards: [], gameDecks: [],
      ...` — copy the literal shape from the module, don't paraphrase it).
- [x] 1.4 `hub/src/server.js`: `GET/PATCH/POST/DELETE
      /mjolnir/userdata/:deviceId`, accepting device-status fields
      (`activeBuildId`, `pendingBuildId`, `audioCached`, `audioTotal`,
      `lastFetchError`) on the same `PATCH` body and writing them to
      `device_state` (D-S5).
- [x] 1.5 Tests: first-ever `GET` for an unknown device id creates and
      returns factory defaults, not a 404; `PATCH` field-merges without
      clobbering untouched fields; every `PATCH`/`POST`/`DELETE` adds exactly
      one `userdata_history` row; a `PATCH` carrying device-status fields
      updates `device_state` in the same call.

## 2. The shim

- [x] 2.1 Author the shim object (shape: `.doc(id) → {get(), ref: {set(doc),
      update(patch), delete()}}`) against the endpoints from task 1 — plain
      `fetch()` calls, no Firebase SDK involved.
- [x] 2.2 `data()`'s returned object wraps any timestamp-shaped field
      (`accountCreationDate`) in an object exposing `.toDate()` returning a
      real `Date` (D-S3).
- [x] 2.3 Patch mod 2080: replace only the `userDataCollection` field's
      value with the shim instance — confirm no other line in the module
      changes (per the existing `patch-management`/`patchback` diff
      mechanism, this should show as a one-line diff). Lands in
      `patches/js/2080-progress-sync-shim.js`, alongside every other patch
      in this directory — not a standalone file elsewhere.
- [x] 2.4 Tests: each of the 7 mod-2080 methods, called against the patched
      module with a mocked shim backend, produces the same request shape
      (`.doc(uid).get()` then `.ref.update(...)`, etc.) it would have against
      a real Firestore mock — i.e. confirm the method bodies truly didn't
      need to change.

## 3. Startup restore module

- [x] 3.1 Author the new companion module as
      `patches/js/progress-sync-restore-companion.js` (appended the same way
      `boot-ok-companion.js` is, via `src/commands/companion.js` — no new
      append mechanism, same directory as every other companion): on every
      launch, before redux-persist rehydrates,
      check a local restore-marker; if absent, `GET` the userdata endpoint
      for the current Firebase Auth uid (read from whatever locally-cached
      auth state is already available at this point in boot) and, if the
      returned document is non-default (i.e. this wasn't this call's own
      auto-creation), write it into `persist:primary`; write the
      restore-marker regardless of outcome.
- [x] 3.2 Tests: a device with existing `persist:primary` data takes no
      restorative action; a device with none and a real server-side
      document gets it written into `persist:primary`; the check never
      repeats once the marker is set.

## 4. Hand-off

This change's implementable scope ends with the patch files in `patches/js/`
and `hub`'s schema/endpoints landed and tested. **Applying the patch to a
bundle, assembling/installing it on the device, and verifying it on-device
are the operator's own steps, done outside this change** — not something to
automate or perform as part of these tasks.

- [x] 4.1 Confirm mods 2114/2205 (sign-in success handlers) are untouched —
      diff them against the unpatched base to prove it.
- [x] 4.2 Decide the Open Question in `design.md` (shared `OPERATOR_AUTH_TOKEN`
      vs. a separate device-facing token) before wiring Caddy routes for
      this endpoint — record the decision as an ADR in
      `tun/docs/07-decisions.md`.
- [x] 4.3 If anything here contradicts or refines `design.md` during
      implementation, record it as an ADR amendment in
      `tun/docs/07-decisions.md`, per this project's established practice.
- [ ] 4.4 **(Operator, outside this change)** Apply
      `patches/js/2080-progress-sync-shim.js` and
      `patches/js/progress-sync-restore-companion.js`, assemble/install, and
      sign off on-device: completing one study session pushes the device's
      full existing `totalCards` history to `hub` (check
      `userdata`/`userdata_history` directly); a subsequent sign-in still
      completes normally.
