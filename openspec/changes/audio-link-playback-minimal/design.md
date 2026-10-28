## Context

Read `tun/docs/04-delivery.md`'s "Audio cache" section and `docs/findings.md`
§5/§C9 before changing anything — this design deliberately implements a
narrower slice of that already-accepted design, not a divergent one. Read
`hub/src/auth.js` and the `requireAuth` call in `hub/src/server.js` before
proposing any new `hub` route — this change was redesigned mid-exploration
specifically because a naive new dynamic route would have landed behind the
operator-auth gate by accident (every route in hub's Node process is gated
except `/mjolnir/login`; the only unauthenticated, device-facing paths are
plain static files Caddy serves directly, per D55).

mod 1440 is confirmed (read directly from
`base/smali.mjolnir.merged/assets/index.android.bundle.exploded/1440.js`) to
be a thin wrapper: `playSoundFile: function (n, o) { s.playSoundFile(n, o); }`
where `s = NativeModules.RNSoundPlayer`. The same module already exposes
`playUrl(url)` on the same native module — confirmed reachable, no native
patch needed (D05).

## Goals / Non-Goals

**Goals:**
- Make a custom card's audio audible on-device with the smallest possible
  patch surface — one function, one new static file per publish.
- Preserve stock cards' playback exactly byte-identical (no regression risk
  on the 2790 existing cards).
- Keep every device-facing artifact a static file, matching D55 and the
  existing `/ota/*`/`/blob/*` pattern — no new dynamic, unauthenticated route
  in `hub`'s Node process.

**Non-Goals (deferred — see Future Work):**
- Local caching, a prefetcher, offline playback.
- Resolving `cardId → sha256` on-device from the `audio.json` manifest.
- A reachability check / online-vs-offline branch.
- Making the audio base URL rotatable via `config.json` the way the OTA
  URL/token already are (D39).

## Decisions

### D-A1 — Patch `playSoundFile`, not the many call sites

Confirmed (`docs/findings.md` §5): every playback call in the app funnels
through mod 1440's `playSoundFile`. Patching this one function, not the
scattered call sites in mods 1439/2013/2124, covers every play-call
automatically, exactly as already designed.

```js
playSoundFile: function (n, o) {
  if (isStockPrefix(n)) { s.playSoundFile(n, o); return; }   // unchanged
  s.playUrl(AUDIO_BASE_URL + "/" + n + "." + o);
}
```

`isStockPrefix` checks against the known stock prefixes (`a`, `b`,
`c01`–`c17`, `z`) rather than checking *for* the custom range — this means a
future rollover deck (`C30` = "substantiv II" per `03-data-model.md`) is
automatically treated as custom with no patch update needed, since it isn't
a *stock* prefix either.

### D-A2 — `AUDIO_BASE_URL` is a literal string in the patch, not a baked
constant or a `config.json` field

For this minimal version, the URL is authored directly into the patch file,
the same way every other hand patch in `patches/js/` is. **Not** using the
companion-constant mechanism (`__MJOLNIR_BUILD_ID__`-style) and **not**
extending `config.json` (which would require a new JS-side *reader* for it —
today only `config-rotate.js` writes it; nothing reads it back). Changing the
domain means re-authoring this one patch and republishing — acceptable for a
minimal version; Future Work makes this rotatable like the OTA URL already
is.

### D-A3 — One more static file, not a new `hub` route

Rejected: `GET /mjolnir/audio/<cardId>.mp3` as a new dynamic route in `hub`.
Confirmed in `hub/src/server.js`: `requireAuth` runs unconditionally on
every request except `/mjolnir/login` — there is no existing mechanism for
an unauthenticated dynamic route to coexist with the operator console in the
same process without adding a special case to the auth gate itself. The
device-facing paths that already exist (`/ota/*`, `/blob/*`) avoid this
entirely by being **plain static files Caddy serves directly**, matching
D55's "P1 ships no application code" principle.

Chosen instead: `builder`'s existing audio-snapshot step (which already
writes `audio.json` and ensures every referenced blob is at
`/blob/<sha256>`, per D45) writes one additional static file per card:
`data/audio-by-card/<cardId>.mp3`, a plain copy of the same bytes already at
`/blob/<sha256>`. One new Caddy static-file block serves that directory.
Zero new dynamic code, zero auth-gate special-casing, matches the existing
pattern exactly.

**Alternative considered**: a redirect-only static file (e.g. an Nginx/Caddy
`rewrite` from `/audio/<cardId>.mp3` to `/blob/<sha256>`) computed once and
written as config rather than duplicating bytes. Rejected for this minimal
version — doubles the moving parts (a generated redirect rule file *and* a
blob) for a saving that only matters at a scale this project isn't at yet
(duplicate storage cost: a few hundred KB per clip, same reasoning D45
already accepted for stabbur/hub's existing audio duplication).

### D-A4 — No reachability check, no fallback, for this version

`playUrl` is fire-and-forget on this native module (no promise, no exposed
error listener in mod 1440's own surface — confirmed by reading the module).
If the URL is unreachable, the clip doesn't play. Already an accepted risk
(`08-pitfalls.md` D07: "tolerate missing audio... a temporarily silent card
is recoverable"). No new mechanism needed to accept a risk already on
record.

## Risks / Trade-offs

- **Duplicate storage** (same bytes at both `/blob/<sha256>` and
  `/audio-by-card/<cardId>.mp3`) — negligible at this project's scale
  (D45 already accepts duplication of this kind).
- **No offline playback for custom cards** — stock cards are unaffected;
  custom cards simply don't play without connectivity, same tolerance as
  P4's existing audio-mandatory design already accepts for a 404'd blob.
- **Re-authoring the patch to change the domain** is manual, unlike the OTA
  URL's `config.json` rotation path. Acceptable short-term; Future Work
  closes this gap when it's actually needed.

## Migration Plan

None — this is new capability, not a change to anything with existing
on-device data.

## Future Work (not this change — captured here so it doesn't need
re-deriving later)

The full version, already designed in `tun/docs/04-delivery.md`, to build
once there's real content and caching actually matters:

```
playSoundFile(name, ext):
    if name is a stock prefix (a/b/c01-c17/z) → playSoundFile(name, ext)   // unchanged
    else if cached(name)   → playUrl("file://" + <documentDirectory>/mj-audio/<sha256>.mp3)
    else if online         → playUrl(blobUrl) + enqueue for background caching
    else                   → skip
```

- **Manifest-driven resolution**: device reads the per-build `audio.json`
  (`{cardId: sha256}`, already written by `builder` today) itself, instead
  of relying on the `audio-by-card/` static duplication this change adds.
  Once this lands, `audio-by-card/` becomes dead weight and should be
  retired from `builder`'s write step.
- **Local cache**: `<documentDirectory>/mj-audio/<sha256>.mp3`, written via
  `ExponentFileSystem` (confirmed already reachable from the bundle with no
  native work, D05/C9).
- **Prefetcher**: runs on app foreground, diffs the manifest against what's
  on disk, downloads missing blobs with a small concurrency cap — content
  addressing means a version bump only pulls genuinely new clips (D45).
- **Reachability check**: "checked once per session, cached" (per
  `docs/findings.md` §5's original sketch) — reuse the existing OTA
  heartbeat rather than add a second network check.
- **`config.json`-rotatable `AUDIO_BASE_URL`**: requires a new JS-side
  *reader* for `config.json` (today only written, never read back by JS —
  `config-rotate.js` is write-only); the native loader is the only current
  reader. Mirrors D39's reasoning for the OTA URL/token exactly — a domain
  change shouldn't require re-authoring and republishing a patch.
