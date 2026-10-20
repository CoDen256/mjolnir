# patches

The patch set applied to Mjølnir's `index.android.bundle` and APK.

- `js/` — bundle patches. **Redeployable**: a bug here is fixed by publishing a
  new bundle. Audio resolver (mod 1440), sync shim (mod 2080), prefetcher,
  boot-ok marker, paywall (mods 968 / 2119).
- `native/` — smali/Java source for the one-time APK patch. **FROZEN once
  shipped** — see `../docs/findings.md` §4 and `tun/docs/04-delivery.md`.
  Its only job is fetching the bundle (plus the boot watchdog). Anything that
  could ever need a bug fix belongs in `js/` instead (D04).

The patch manifest (`[{id, rev}]`) recorded in each publication is the source of
truth for which patches a build contains; the "logic version" integer is only a
label (D27).
