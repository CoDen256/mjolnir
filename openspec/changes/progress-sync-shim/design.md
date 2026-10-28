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
- A `hub` operator console page (D-S6) for reading progress/device state —
  read-only, no write actions, so the operator can see sync is actually
  working without a shell or `psql`.

**Non-Goals:**
- Changing Firebase Auth / sign-in itself — untouched, still the real Google/
  Apple flow against the vendor's project.
- An admin-side pull from the vendor's actual Firestore — confirmed
  unnecessary: local storage already has everything, per `05-sync.md`'s own
  "Firestore is pure backup" finding.
- Any new screen **inside the Mjølnir app itself** — matches D13 ("no new UI
  inside Mjølnir"); the startup module is headless. (D-S6's console is a
  `hub` operator page, a different surface entirely — D13 doesn't apply to
  it, same as it's never applied to the Cards/OTA/Builder pages already
  shipped.)

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

### D-S4 — The new startup module does restore, plus minting a local device id; it does NOT duplicate the exists-guarantee

Given D-S2 moves the exists-guarantee server-side, the new always-run
startup module (appended the same way `boot-ok-companion.js` is, per
`src/commands/companion.js`) has two small jobs:

```
on first-ever launch (no local device-id marker yet):
    generate a random device id, write it to AsyncStorage, keep it forever
    — this is the id D-S5's device_state is keyed by; independent of the
    uid, never regenerated, survives sign-out/sign-in on the same device

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

The device id never touches `userdata`/progress — it only ever rides along
in the piggybacked device-status fields (D-S5) so `device_state` rows stay
one-per-physical-install, independent of which account happens to be signed
in on it.

Sign-in-triggered restore (`initUserData()` + `getUserData()`, mods 2114/
2205) stays completely untouched and keeps working exactly as today,
against the new backend instead of Google's — per the operator's explicit
"let's do the pull on sign-in as well." The startup module is the
*additional* path for the case sign-in won't replay (already-authenticated
sessions, future silent-session-restore on reinstall).

### D-S5 — `hub` schema: `userdata` (uid-keyed) / `userdata_history` / `device_state` (device-id-keyed)

Refined from `05-sync.md`'s single-key sketch once the console mockup
(D-S6) made the consequence concrete: `userdata` is keyed by the real
Firebase `uid` (D-S1 — progress must follow the account across devices),
but `device_state` is keyed by a **separate, locally-generated device id**,
not the uid:

```sql
hub.userdata(uid PK, doc JSONB, updated_at)
hub.userdata_history(id, uid, doc JSONB, at)   -- append-only, every sync
hub.device_state(device_id PK, uid, active_build_id, pending_build_id,
                 audio_cached, audio_total, last_error, seen_at)
```

If `device_state` were also uid-keyed, two devices signed into the same
account would overwrite each other's row — fine for `userdata` (that's the
desired merge), wrong here, since "which build is *this phone* on" and "how
much audio has *this phone* cached" are physically local facts. A retired
device's last-known state would also be unrecoverable the moment a new
device's PATCH landed, which defeats the Device ID selector's entire
purpose (D-S6) — selecting a retired device needs a row that's still there
to select. `device_state.uid` is kept as a foreign-key-shaped column (not
unique) so the console can list every device ever seen for a given account.

`userdata_history` gets a row on every PATCH/POST — "last-write-wins storage
is not a backup" (05-sync.md). Device status piggybacks on the same PATCH
payload (D31) rather than a separate endpoint — the request body now also
carries `deviceId` (generated once by the startup module, task 3.1, and
persisted locally — not derived from the uid) alongside `activeBuildId`,
`pendingBuildId`, `audioCached`, `audioTotal`, `lastFetchError`; `hub` writes
`userdata` keyed by the path's uid and `device_state` keyed by the body's
`deviceId`, from the same request.

### D-S6 — The console: two independent identity selectors, card content joined in

A static mockup was built and approved before writing this down:
**https://claude.ai/code/artifact/12b08e2e-0eba-4990-8125-584a71c7046a**
— read alongside this section, same convention as `13-operator-console-ux.md`'s
own linked mockup.

The page (`/mjolnir/device` or similar — exact route TBD at implementation)
has:

- **An identity bar with two independent selectors**: "Account (uid)" and
  "Device ID." They're deliberately not one combined picker — an account can
  carry several devices (the operator's own stated expectation: "I will
  most likely swap devices in the future"), and a device's last-known state
  should stay inspectable after it's no longer the active one. Progress
  (the panels below) follows whichever uid is selected; OTA/audio state
  follows whichever device id is selected — independently, per D-S5's
  split schema.
- **Stat row**: last synced, active build (+ label), audio cached (`142 /
  150`, pill-colored by completeness), last fetch error (pill).
- **Progress snapshot**: plain label/value pairs from the `userdata` JSONB
  (completed sessions, consistency rate, archived/in-progress counts,
  account-since, last session) — a raw-JSON toggle underneath for anything
  not worth a dedicated field.
- **Per-card progress table**: `totalCards` records joined against
  `card_content` (same join `hub/src/cards.js`'s `cardsList` already does
  for the Cards page) — a **Content** column shows the card's stripped N/E
  text so a row reads as "hus — a house," not just "C20001." Without this,
  the table is a wall of ids with no way to tell what's actually being
  reviewed. "Side" labels the stored `language` field plainly — never
  "language" in the UI, matching the `C1` correction.
- **Sync history**: a timeline of `userdata_history` rows rendered as
  diffs against the previous row (`completedSessions 46 → 47`, `totalCards
  +2`), not raw JSON per row — a full dump stays one click away.

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
