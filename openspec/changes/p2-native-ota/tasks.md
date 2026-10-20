## 1. Pre-flight against the build base

- [ ] 1.1 Confirm the five hook facts on `base/smali.mjolnir.merged` v1.5.12 still hold: LazyHolder 5-entry array, wrapper lazy chain at `ReactNativeHostWrapperBase.smali:148`, `ReactNativeHostHandler` + `$-CC` defaults, `Package.createReactNativeHostHandlers`, `FileSystemModule.smali:2784` filesDir anchor
- [ ] 1.2 Record the baked-in OTA URL and bearer token to compile in (operator input — Open Question); confirm they match the live P1 endpoints
- [ ] 1.3 Decide the fallback-bundle pairing: the embedded tier-4 bundle will be the paywall-patched **v1.5.12** bundle built from this base

## 2. Native patch — the new handler class

- [ ] 2.1 Author `OtaPackage` smali implementing `Package` (four `create*` → emptyList; `createReactNativeHostHandlers` → one-element list of `this`) and `ReactNativeHostHandler`, under `smali_classes4/com/lightblitzlearning/ota/`
- [ ] 2.2 Declare every `ReactNativeHostHandler` method forwarding to `ReactNativeHostHandler$-CC;->$default$…`, except `getJSBundleFile(Z)` which gets a real body (prevents `AbstractMethodError`)
- [ ] 2.3 Implement `getJSBundleFile(Z)`: `useDeveloperSupport` → `null`; else run synchronous local selection, write the attempt marker before returning, spawn the background refresh+GC daemon, return the selected path or `null`

## 3. Native patch — launch-path selection (§2)

- [ ] 3.1 Resolve base dir as bare `getFilesDir()/mjolnir-ota/` (D56); treat unreadable/invalid `active`/`pending` tokens as absent
- [ ] 3.2 Implement tier order: pending(+promote: write `active`, delete `pending`) → active → newest-mtime boot-ok'd bundle → `null`
- [ ] 3.3 Apply the cheap activation check (length>0 ∧ first 26 bytes `var __BUNDLE_START_TIME__=`) to each candidate; honour `bad-<id>` and the watchdog threshold
- [ ] 3.4 Apply D54: rewrite `active` to the id actually returned, or delete it when falling through to the asset
- [ ] 3.5 Write `active`/`pending` via `.tmp`→`renameTo` only

## 4. Native patch — watchdog (§4)

- [ ] 4.1 Create `attempt-<id>-<n+1>` immediately before handing over a path (separate files, no read-modify-write)
- [ ] 4.2 Skip + write `bad-<id>` when `attempts ≥ 2` ∧ no `boot-ok-<id>`; fall to next tier
- [ ] 4.3 Treat `boot-ok-<id>` as making attempt count irrelevant forever; never auto-clear `bad-<id>`

## 5. Native patch — background refresh (§1, §3, §5, §6)

- [ ] 5.1 Resolve config: read `config.json` `{url, token}` if present/parseable/https, else baked-in defaults; malformed ⇒ fall back, never crash
- [ ] 5.2 Fetch + parse `current.json`; read only `buildId`/`url`/`sha256`/`size`, ignore the rest; validate buildId regex, https url, 64-hex sha256, `0 < size ≤ 64 MiB`; any failure ⇒ abandon silently
- [ ] 5.3 Download with `HttpURLConnection`: no `Accept-Encoding`; `setInstanceFollowRedirects(false)` + manual https-only redirect loop (D53); `Authorization: Bearer`; connect 10 s / read 30 s / overall 120 s; stream into `.tmp`, abort when bytes > `size`
- [ ] 5.4 Post-download verify (before rename): exact `size`, streamed `sha256`, 26-byte prefix; on success `renameTo bundle-<id>.js` then write `pending`; on failure delete `.tmp`, touch nothing else
- [ ] 5.5 GC on the background thread only: delete `.tmp` and `bundle-*.js` outside {active, pending, two newest boot-ok'd} with their markers

## 6. Native patch — registration (irreversible edit)

- [ ] 6.1 Edit `ExpoModulesPackageList$LazyHolder.<clinit>`: bump packages array `0x5`→`0x6` from a fresh register (raise `.locals 8`→`9`, size in `v8`), append `new-instance OtaPackage`/`aput` at index 5 (reuse `v0`=`0x5`), leave the `modulesList` tail untouched
- [ ] 6.2 Smoke-assemble the patched smali and confirm no `baksmali`/`smali` errors

## 7. JS companion (redeployable, §4 JS side / §5)

- [ ] 7.1 Add a bundle module that, 3 s after root mount, writes `documentDirectory + "mjolnir-ota/boot-ok-<buildId>"` (empty); not on first render alone
- [ ] 7.2 Bake the running `buildId` into the companion at publish time so the marker pairs with the loaded bundle
- [ ] 7.3 (Optional capability) helper to rewrite `config.json` with a new https `{url, token}` for rotation — never a non-https url

## 8. Build, sign, install

- [ ] 8.1 Assemble the embedded fallback bundle: v1.5.12 base bundle + re-applied paywall patch (`0f6f580`/`b962691`/`a1f8f1f`) + JS companion; place as `assets/index.android.bundle`
- [ ] 8.2 Build → align → sign via the existing `0306.orig` pipeline
- [ ] 8.3 Install on the device; **do not ship the same day it is written**

## 9. Acceptance — the irreversible-step gate

- [ ] 9.1 Boots the **stock** embedded bundle first (dex integrity) before any OTA
- [ ] 9.2 Tier 4 → tier 1: publish a bundle, confirm fetch + `pending` + promote-to-`active`, then confirm `active` load on next launch
- [ ] 9.3 Watchdog: a deliberately-crashing bundle is quarantined (`bad-<id>`) after two launches and falls back to the previous good bundle
- [ ] 9.4 Rollback: repoint `current.json` at an older `buildId`; confirm the device fetches it (identity, not ordering — D26)
- [ ] 9.5 `config.json`: write a new token; confirm the next refresh uses it, and that a malformed/non-https config falls back without crashing
- [ ] 9.6 Re-run `bin/ota-verify.sh` against the VPS (16/16)
- [ ] 9.7 If any contract clause proved wrong during implementation, record an ADR amendment in `tun/docs/07-decisions.md` (never a silent deviation)
