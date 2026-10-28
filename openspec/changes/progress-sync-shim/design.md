## Context

Read `tun/docs/05-sync.md` and `docs/findings.md` §6/C8 first — this design
refines both against the actual mod 2080 source (read directly from
`base/smali.mjolnir.merged/assets/index.android.bundle.exploded/2080.js`),
not just their pseudocode. Read `patches/js/boot-ok-companion.js` and
`src/commands/companion.js` for the append-a-top-level-module mechanism this
design's new startup module reuses — not a new mechanism.

Confirmed directly from source:
- `userDataCollection: (0, s.default)().collection("userData")` — a
  native-backed Firestore SDK object (confirmed: the APK has real
  `com/google/firestore/bundle/*` gRPC protobuf classes), not a URL. There is
  nothing to redirect by configuration; the field's *value* must be replaced.
- Every one of the 7 methods (`initUserData`, `updateUserData`,
  `updateSessionUserData`, `updateSetting`, `addSurveyAnswers`,
  `getUserData`, `deleteUserData`) only ever calls generic
  `.doc(id).get()` / `.ref.set()` / `.ref.update()` / `.ref.delete()` on
  `this.userDataCollection` — none of them know they're talking to
  Firestore specifically. A shim only needs to replace that one field.
- `updateUserData`/`updateSessionUserData` both send the **complete current
  `totalCards` array** (`e.map(...)`) on every call, not a diff — confirmed
  reading their bodies. Combined with local storage already being the real
  working copy (`05-sync.md`: "local is the working copy; Firestore is pure
  backup"), the next time either naturally fires (confirmed call sites: mod
  2140 for session-complete, mods 2117/2188 for settings/onboarding) your
  full existing history uploads with no migration-specific code.
- Every write method (`updateUserData`, `updateSessionUserData`,
  `updateSetting`, `addSurveyAnswers`) is gated `if (doc.exists) { ... }`
  with **no `else`** — a false `exists` makes the function return having
  done nothing, silently, forever, with no error surfaced anywhere.
- `initUserData()` is called on **every** sign-in (mods 2114, 2205 — not
  just first-ever), and idempotently creates the doc if missing
  (`if (r.exists) ; else { ...ref.set(defaults) }`). This is what guarantees
  `exists` is always true by the time any write-capable screen is reached in
  the stock app — but it depends on a sign-in event actually firing, and the
  operator is already signed in today, so installing this patch alone won't
  retrigger it.

## Goals / Non-Goals

**Goals:**
- Swap the sync transport with the smallest possible diff to mod 2080 — one
  field, zero method-body edits.
- Never let the `exists: false` hazard occur, for any device, at any point —
  not just for the already-signed-in operator's current situation.
- Preserve cross-device continuity via the real Firebase Auth `uid` (D-S1).
- Replicate the real restore trigger (sign-in) *and* add a startup-time
  equivalent, since this device won't replay sign-in on its own.
- Zero new code specifically for migration — the existing write paths do it.

**Non-Goals:**
- Changing Firebase Auth / sign-in itself — untouched, still the real Google/
  Apple flow against the vendor's project.
- An admin-side pull from the vendor's actual Firestore — confirmed
  unnecessary: local storage already has everything, per `05-sync.md`'s own
  "Firestore is pure backup" finding.
- A UI for any of this — matches D13 ("no new UI inside Mjølnir"); the
  startup module is headless.

## Decisions

### D-S1 — Keyed by the real Firebase Auth `uid`, not a new device id

Call sites (`this.userDataCollection.doc(currentUser?.uid)`) stay completely
unedited. The shim's `.doc(id)` uses whatever `id` it's given — the real
`uid` — as the server-side key. This is simpler than introducing a
locally-generated device id (zero call-site edits either way) **and** gives
what the operator actually wants: signing in with the same account on a
future replacement device resolves to the same `uid`, same server doc,
continuous progress. No handling added for `currentUser` being `undefined`
(not signed in) — mirrors existing stock behavior exactly (the stock app has
the identical gap today; not a new risk this change introduces).

### D-S2 — `exists: false` is eliminated server-side, not client-side

Rejected: a new client-side "ensure the doc exists" step duplicating
`initUserData()`'s own create-if-missing logic. Chosen instead: **`hub`'s
`GET /mjolnir/userdata/{deviceId}` auto-creates a row with factory defaults
on its very first request for a given id, and always responds as if the
document exists** — it never returns a "not found" shape. This is strictly
simpler than client-side duplication, and closes the gap for every future
device, not just the operator's current already-signed-in session: every
method in mod 2080 calls `.get()` on the shim immediately before any write
(confirmed — `05-sync.md`'s own "every op: .get() then .update()" reading),
so a single server-side guarantee on `GET` is sufficient; there is no
ordering gap to protect against, since the read always precedes the write
within the same method body. `initUserData()`'s own `if (r.exists) ;`
branch simply becomes the common case now — it was already written to
handle "doc already exists," it just didn't matter when it would stop being
the exception.

### D-S3 — The shim's REST mapping

```
.doc(id).get()      → GET    /mjolnir/userdata/{id}   (auto-creates on first touch, D-S2)
.ref.update(patch)   → PATCH  /mjolnir/userdata/{id}   (field-merge, not replace)
.ref.set(doc)        → POST   /mjolnir/userdata/{id}   (full create/overwrite — rarely
                                                          reached in practice now that GET
                                                          auto-creates, but still a real
                                                          path `initUserData` can take)
.ref.delete()        → DELETE /mjolnir/userdata/{id}
```

`DELETE` wasn't in `05-sync.md`'s original three-endpoint sketch —
`deleteUserData()`'s body calls `.ref.delete()` before its unrelated call to
the vendor's own `deleteUser` Cloud Function (left untouched; orthogonal to
progress storage, still hits the real Firebase project since Auth is
unmodified). The shim needs *something* behind `.ref.delete()` even if this
path is rarely exercised in practice for a solo operator.

`.data()`'s returned object exposes `accountCreationDate` (and any other
timestamp field) as an object with a `.toDate()` method, not a bare `Date` —
`updateSessionUserData` calls `.toDate()` directly on it (confirmed reading
the source) — matching `05-sync.md`'s already-identified requirement.

### D-S4 — The new startup module only does restore; it does NOT duplicate the exists-guarantee

Given D-S2 moves the exists-guarantee server-side, the new always-run
startup module (appended the same way `boot-ok-companion.js` is, per
`src/commands/companion.js`) has exactly one job:

```
on every launch, before redux-persist rehydrates:
    if no local restore-marker:
        GET /mjolnir/userdata/{uid}   (uid read from the same AsyncStorage/
                                        Firebase Auth state mod 2080 itself
                                        would use — the restore hook runs
                                        before 2080 does, so it reads
                                        whatever auth session is already
                                        cached locally, same as the app
                                        would)
        if a real (non-fresh, i.e. not just auto-created this call)
        document came back:
            write it into AsyncStorage under "persist:primary"
        write the restore-marker either way (never repeat this check)
```

Sign-in-triggered restore (`initUserData()` + `getUserData()`, mods 2114/
2205) stays completely untouched and keeps working exactly as today,
against the new backend instead of Google's — per the operator's explicit
"let's do the pull on sign-in as well." The startup module is the
*additional* path for the case sign-in won't replay (already-authenticated
sessions, future silent-session-restore on reinstall).

### D-S5 — `hub` schema: `userdata` / `userdata_history` / `device_state`

Exactly as `05-sync.md` already specified:

```sql
hub.userdata(device_id PK, doc JSONB, updated_at)
hub.userdata_history(id, device_id, doc JSONB, at)   -- append-only, every sync
hub.device_state(device_id, active_build_id, pending_build_id,
                 audio_cached, audio_total, last_error, seen_at)
```

`userdata_history` gets a row on every PATCH/POST — "last-write-wins storage
is not a backup" (05-sync.md). Device status piggybacks on the same PATCH
payload (D31) rather than a separate endpoint — `activeBuildId`,
`pendingBuildId`, `audioCached`, `audioTotal`, `lastFetchError` ride along,
written into `device_state` server-side from the same request body.

## Risks / Trade-offs

- **`currentUser` could be `undefined`** at call time (not signed in) —
  pre-existing stock behavior, not newly introduced; no new handling added
  (per this project's "don't validate scenarios that already exist
  unhandled and aren't newly caused by this change" norm).
- **Auto-creating on `GET` means a probing/malformed request also creates a
  row** — acceptable: `hub`'s existing shared-bearer-token pattern (D-H6,
  same shape planned here) already gates every endpoint; an authenticated
  caller creating an empty row for a bogus id is a non-issue at this
  project's single-operator scale.
- **`userdata_history` grows unboundedly** — same accepted trade-off as
  `occurrence_shipments` (D-H1's risk note in `builder-logic-bundle-store`):
  cheap at this scale, not worth pre-optimizing.

## Migration Plan

None, by design (see Why) — the existing write paths carry the full current
`totalCards` snapshot on their own next natural firing. No backfill script,
no one-time job, no admin-side Firestore read.

## Open Questions

- Should `hub`'s userdata endpoints share the same `OPERATOR_AUTH_TOKEN`
  gate as the rest of `hub` (D-H6), or a separate device-scoped token? A
  shared operator token would mean the APK itself carries that secret
  (readable via `strings` on the dex, same class of exposure D64 already
  accepts for the OTA token). Lean toward a separate, device-facing token
  mirroring D39's OTA-token pattern exactly — but not yet decided here.
