# patches

The patch set applied to Mjølnir's `index.android.bundle` and APK.

- `js/` — bundle patches. **Redeployable**: a bug here is fixed by publishing a
  new bundle. Audio resolver (mod 1440), sync shim (mod 2080), prefetcher,
  paywall (mods 968 / 2119). The OTA **companions** also live here but are not
  module patches — they are top-level snippets appended after the bundle entry
  by `bundle-tool companion` (they need no module dep; see `../docs/findings.md`
  §4a): `boot-ok-companion.js` (the D52 watchdog marker), `config-rotate.js`
  (the D39 URL/token rotation capability), and `ota-debug-report.js`
  (debug-only tier observability, D63).
- `native/` — smali/Java source for the one-time APK patch. **FROZEN once
  shipped** — see `../docs/findings.md` §4 and `tun/docs/04-delivery.md`.
  Its only job is fetching the bundle (plus the boot watchdog). Anything that
  could ever need a bug fix belongs in `js/` instead (D04).

The patch manifest (`[{id, rev}]`) recorded in each publication is the source of
truth for which patches a build contains; the "logic version" integer is only a
label (D27).
