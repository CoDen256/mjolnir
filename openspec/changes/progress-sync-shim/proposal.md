## Why

Progress sync today goes to the app vendor's own Firebase project
(`mjolnir-4d731`, confirmed in the APK's `res/values/strings.xml`), not
anywhere this project controls. `tun/docs/05-sync.md` already designed the
replacement (a Firestore-shaped shim over `hub`'s own REST endpoints) — this
turns that design into a real change, grounded in reading the actual mod
2080 source rather than the original design's pseudocode. Confirmed directly
from the decompiled bundle: Firestore is accessed via a native-backed SDK
object (`collection("userData")`, backed by real `com/google/firestore/*`
gRPC classes in the APK), not a configurable URL — so the fix is a handle
swap, not a config change, exactly as `05-sync.md` originally called for.
No separate migration step or script is needed: local storage
(`persist:primary`) is already the real working copy (Firestore has only
ever been a mirror), and the existing write paths already upload the
complete current snapshot, not a diff — so the very next natural sync event
after this patch ships carries your full existing history to `hub` with no
new code written specifically for migration.

## What Changes

- **Patch mod 2080's `userDataCollection` field** (one field, not the method
  bodies) to a Firestore-shaped shim object implementing `.doc(id).get()` /
  `.ref.set()` / `.ref.update()` / `.ref.delete()` against `hub`'s own REST
  endpoints instead of real Firestore. Every method body in mod 2080
  (`initUserData`, `updateUserData`, `updateSessionUserData`,
  `updateSetting`, `addSurveyAnswers`, `getUserData`, `deleteUserData`) stays
  untouched — confirmed each one only ever calls generic collection/doc
  methods on this one field.
- **Keyed by the real Firebase Auth `uid`, not a new locally-generated
  device id** — call sites are unchanged, and this is what gives continuity
  across a future device swap (same Google/Apple account, same `uid`, same
  server doc).
- **The shim's `.get()` never reports `exists: false`** — every write method
  in mod 2080 is unconditionally gated on `if (doc.exists)` with no `else`,
  so a false `exists` silently and permanently blocks every future write with
  no error anywhere. The guarantee lives entirely server-side (`hub`'s `GET`
  auto-creates on first touch) — not duplicated client-side, so it covers
  every future device, not just the operator's current already-signed-in
  session.
- **New always-run startup module** (not gated on sign-in), with two small
  jobs: (1) on first-ever launch, mint and permanently store a local device
  id (independent of the uid — see schema below); (2) on every launch,
  before redux-persist rehydrates, if local state has never been restored
  and the server already has a doc for this `uid`, write it into
  `persist:primary`. Needed because this device is already signed in and
  won't replay the sign-in handlers on its own.
- **Sign-in-triggered restore keeps working unchanged** — mods 2114/2205
  aren't touched; `initUserData()` + `getUserData()` fire exactly as today,
  now against `hub` instead of Google's Firestore.
- **New `hub` endpoints**: `GET/PATCH/POST/DELETE /mjolnir/userdata/{uid}`
  (the device-facing contract, piggybacking device status per D31), plus
  `hub.userdata` (uid-keyed) / `hub.userdata_history` (uid-keyed) /
  `hub.device_state` (keyed by the locally-generated device id, **not**
  the uid — two devices on one account must not overwrite each other's OTA/
  audio state, and a retired device's last-known state needs to stay
  inspectable).
- **New `hub` operator console page**: progress and device/OTA state,
  read-only, with independent "Account (uid)" / "Device ID" selectors
  (since one account can carry several devices) and a per-card table that
  shows each card's actual text, not just its id — see `design.md` D-S6 for
  the full mockup.
- No separate migration script, endpoint, or one-time job.

## Capabilities

### New Capabilities
- `progress-sync-shim`: the mod 2080 patch and the new startup module.
- `userdata-api`: `hub`'s device-facing sync endpoints and schema.
- `userdata-console`: the operator-facing progress/device-state page.

### Modified Capabilities
<!-- None. -->

## Impact

- `patches/js/` — new patch targeting mod 2080 (one field) + a new
  always-run startup companion module (same append mechanism as the
  boot-ok companion).
- `hub/src/` — new routes, new migration (`userdata`, `userdata_history`,
  `device_state`), new operator console page reusing the Cards page's
  `card_content` join pattern.
- No changes to `stabbur`, `smia`, `builder`'s pipeline, or the native patch.
- Depends on nothing else proposed or in flight; independent of
  `builder-logic-bundle-store` and `audio-link-playback-minimal`.
