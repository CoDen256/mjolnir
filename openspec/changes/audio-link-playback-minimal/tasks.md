## 0. Before you write any code

Read `design.md` D-A3 in full — a naive new `hub` route would land behind
the operator-auth gate by accident (`requireAuth` in `hub/src/auth.js` is
unconditional except for `/mjolnir/login`). The fix is a second static file,
not a new route. Read `docs/findings.md` §5/§C9 and confirm against the real
`base/smali.mjolnir.merged/assets/index.android.bundle.exploded/1440.js`
before patching — don't re-derive module 1440's shape from the doc alone.

## 1. The patch

- [ ] 1.1 Author the mod 1440 patch
      (`patches/js/1440-audio-link-playback.edited.js`, alongside every
      other patch in this directory), following the existing
      `patch-management`/`patchback` content-located
      authoring flow — baseline + modified source, no new patch
      infrastructure): `playSoundFile` checks the card id against the known
      stock prefixes (`a`, `b`, `c01`–`c17`, `z`) and calls the unchanged
      `s.playSoundFile(n, o)` path for a match; otherwise calls
      `s.playUrl(AUDIO_BASE_URL + "/" + n + "." + o)`. `AUDIO_BASE_URL` is a
      literal string authored into this patch file (D-A2 — not baked via
      the companion mechanism, not read from `config.json`).
- [ ] 1.2 Tests: a stock-prefixed id's patched output still calls
      `playSoundFile` unchanged; a non-stock id calls `playUrl` with the
      expected URL shape; a future-rollover id (e.g. a hypothetical `c30xxx`)
      is treated as non-stock (D-A1's "check for stock, not for custom"
      framing).

## 2. Per-publish static file

- [ ] 2.1 `builder/src/audioSnapshot.js` (or a small sibling module): after
      the existing per-card blob-ensure step, write a second copy of the
      same bytes to `data/audio-by-card/<cardId>.mp3` for every card with
      audio in the current publish.
- [ ] 2.2 Tests: publishing a card with audio produces identical bytes at
      both `/blob/<sha256>` and `/audio-by-card/<cardId>.mp3`; republishing
      the same card's unchanged audio doesn't error (idempotent write).

## 3. Caddy

- [ ] 3.1 New static-file block in `mjolnir/caddy/Caddyfile` serving
      `/audio-by-card/*` from the directory written in task 2.1, with no
      authentication — matching the existing `/ota/*`/`/blob/*` blocks'
      shape exactly.
- [ ] 3.2 Confirm via `caddy adapt --adapter caddyfile` (per D99's established
      practice — static review alone missed two real routing bugs last
      time) that the new block actually compiles to a reachable route, not
      shadowed by directive ordering.

## 4. Hand-off

This change's implementable scope ends with the patch file in `patches/js/`,
the per-publish static file write, and the Caddy block landed and tested.
**Assembling/installing a bundle with this patch and verifying it on-device
are the operator's own steps, done outside this change.**

- [ ] 4.1 Re-run the existing patch-management/patchback test suite — this
      change adds a patch, it doesn't touch the patching mechanism itself,
      but confirm nothing regressed.
- [ ] 4.2 If anything here contradicts or refines `design.md` during
      implementation, record it as an ADR amendment in
      `tun/docs/07-decisions.md`, per this project's established practice.
- [ ] 4.3 **(Operator, outside this change)** Build a bundle with
      `patches/js/1440-audio-link-playback.edited.js` applied, install it,
      and sign off on-device: a stock card still plays locally with no
      network activity; a real published custom card's audio plays via the
      new URL.
