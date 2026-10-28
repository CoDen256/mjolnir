## Why

Every custom card (C20–C29) requires audio on reveal, with no type-based
exception (`tun/docs/03-data-model.md` D74) — but nothing in the bundle can
play it yet. Stock audio ships baked into the APK as `res/raw/<id>.mp3`;
custom cards have no such file. `tun/docs/04-delivery.md` already designs the
full answer (content-addressed blobs, a local cache, a background
prefetcher), but that's real work with nothing yet to test it against — P4's
own 10-note finish line hasn't run once. This change ships the smallest
possible slice that makes a custom card's audio audible at all: stream it
straight from a URL, no caching, no prefetch, no manifest. The full version
stays fully designed (captured here in `design.md`'s Future Work) for a later
change once there's real content and a real need to stop re-downloading the
same clip every reveal.

## What Changes

- **Patch mod 1440's `playSoundFile(n, o)`** — the single chokepoint every
  playback call in the app funnels through (confirmed: `docs/findings.md`
  §5/C9). Stock card ids (prefixes `a`/`b`/`c01`–`c17`/`z`) behave exactly as
  today, byte-identical. Any other id (`c20`+ onward, including future
  rollover decks per `03-data-model.md`'s `C30 = "substantiv II"` note) plays
  via the native module's already-exposed `playUrl(url)` instead, built from
  a baked base URL + the card id + extension.
- **One more static file per publish, not a new route.** `builder` already
  writes a per-build `audio.json` manifest (`cardId → sha256`) and ensures
  every referenced blob exists at `/blob/<sha256>` (D45). This change adds a
  second, card-id-keyed static copy (`data/audio-by-card/<cardId>.mp3`) of
  that same content at the same step, so the device can hit a predictable,
  name-based URL with no manifest fetch and no sha256 lookup of its own —
  confirmed this must stay fully static: `hub`'s operator-auth gate
  (D-H6) applies to every dynamic route in its Node process except
  `/mjolnir/login`, so a device-facing, unauthenticated endpoint can only
  exist the same way `/ota/*`/`/blob/*` already do — as a plain file Caddy
  serves directly (D55), never touching hub's Node process at all. This is
  deliberately a throwaway simplification: the full version (Future Work)
  has the device resolve `cardId → sha256` itself from the manifest and hit
  `/blob/<sha256>` directly, making this duplicate copy unnecessary once it
  ships.
- **One new Caddy static-file block** for the new directory, alongside the
  existing `/ota/*`/`/blob/*` blocks.
- **No reachability check, no fallback, no retry.** If the URL is
  unreachable, the clip simply doesn't play — already an accepted risk
  (`08-pitfalls.md` D07: "tolerate missing audio rather than gating
  activation on a complete set").
- **No new config/rotation mechanism.** The base URL is a literal string in
  the patch file itself, authored the same way any other hand patch in
  `patches/js/` is — not baked via the companion-constant mechanism, not
  rotatable via `config.json`. Changing it means re-authoring this one patch.
  (The full version's design, captured here, makes this config.json-
  rotatable like the OTA URL already is, per D39 — deliberately deferred.)

## Capabilities

### New Capabilities
- `audio-link-playback`: the mod 1440 patch and the hub route it calls, for
  this minimal, uncached, unprefetched version.

### Modified Capabilities
<!-- None. -->

## Impact

- `patches/js/` — new patch targeting mod 1440 (via the existing
  `patch-management`/`patchback` content-located patch mechanism — no new
  patch infrastructure).
- `builder/src/audioSnapshot.js` (or a sibling) — one more static file write
  per card per publish, alongside the existing `audio.json` manifest write.
  No schema change — reads `card_slots.audio_sha256`, already present.
- `mjolnir`'s `caddy/Caddyfile` — one new static-file block.
- No changes to `stabbur`, `smia`, `hub`'s Node routes, or the native patch.
- Depends on nothing else proposed or in flight; independent of
  `builder-logic-bundle-store` and `progress-sync-shim`.
