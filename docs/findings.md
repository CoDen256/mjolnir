# Mjølnir reverse-engineering notes

> **Read the "Corrections and additional findings (2026-10-20)" section at the
> end before trusting §2 and §6** -- two statements there are wrong.
> Ecosystem design built on this document: `docs/ecosystem/README.md`.

App: `com.lightblitzlearning.mjolnir` (Expo + React Native, JSC bundle — not Hermes
bytecode). Decompiled APK: `/home/coden/rev/mjolnir/0306.orig/orig/smali.merged.mjolnir`.

## 1. Deck/card data model

Two `data`-classified modules in `index.android.bundle`, located by element shape
(not a fixed id — survives renumbering across builds):

- **Deck catalog** (`2111` in the build we've been editing) — array of decks.
  Elements have a `Cards` property.
- **Card content** (`2113`) — array of cards. Elements have a `DECK_ID` property.

**Deck shape:**
```js
{
  ID: 42, PullCounter: 0, Name: "C16", Code: "16", Enabled: true,
  Title: "Current Affairs & Society",
  Description: "...",
  Counter1: "50 cards",                    // display string
  Counter2: "<b>×2</b> (front, back)",      // display string, contains HTML
  MaxInterval: 10, AutoTickStreak: 1, AutoHammerCount: 2,  // SRS pacing knobs (deck-level)
  Cards: [ { Card: "C16001N", P: "N" }, ... ]  // occurrences, see §2
}
```

**Card shape:**
```js
{
  DECK_ID: "C16", ID: "C16001",
  N: "<div>...</div>",   // front (question)
  E: "<div>...</div>",   // back (answer)
  D: "...",               // deck title, redundant copy
  X: "<div>...</div>",   // extra/example content
  A: "N" | "E" | "X",     // which of the above fields the audio is attached to
}
```

Category = `deck.Name[0]` (first letter: `Z`/`A`/`B`/`C` observed).

## 2. What N / E / X / A actually mean

- **N** — front of the card (question side).
- **E** — back of the card (answer side).
- **X** — extra/example content (a third, optional side).
- **D** — just the deck title again, redundant, not shown as a "side."
- **A** — *not* audio content. It's a pointer: which of N/E/X the card's audio
  clip is attached to. Confirmed domain across the whole bundle: only `N`, `E`,
  `X` ever appear (2790 cards: ~1914 `N`, ~822 `E`, ~54 `X`).

## 3. Card "occurrence" — what the deck.Cards[] entries mean

A deck's `Cards[]` array is **not** a simple list of its cards — it's the actual
**presentation sequence**. A card can appear more than once, once per side it's
quizzed on. Each entry:

```js
{ Card: "<cardId><letter>", P: "N" }   // e.g. "A03005E"
```

- The **trailing letter of `Card`** (`N` / `E` / `A`) is the real direction —
  which side gets shown when that occurrence comes up: `N` = front presented,
  `E` = back presented, `A` = audio-only presented (full info "covered" by the
  clip, nothing shown visually).
- **`P` does *not* correlate with the direction letter** — it's an independent
  per-occurrence flag (observed values `N`/`Y`). We confirmed this directly:
  deck `A03` has `P:"Y"` entries whose `Card` suffix is `N`, `E`, *and* `A` —
  all three. **`P` is the free/premium gate**: `P:"N"` = included in the free
  tier, `P:"Y"` = premium-only (gated behind the paywall/subscription). This
  is orthogonal to the direction letter, which lives purely in `Card`'s last
  character. **Any tooling that edits `Cards[]` should set `P` deliberately
  for that reason** — it controls monetization, not presentation — and derive
  direction purely from the `Card` string's last character, independent of it.
- Most cards have a single occurrence (`N` only). Some decks are genuinely
  multi-occurrence — e.g. deck `A03` has cards with `N`+`E`, or all of `N`+`E`+`A`.
- Order inside `Cards[]` *is* the presentation order for that deck.

## 4. How the JS bundle gets loaded (and how to make it self-updating)

Stock behavior: `ReactNativeHost.getJSBundleFile()` always returns null →
Android loads `assets://index.android.bundle`, baked into the APK at build
time. **No OTA/self-update mechanism exists in this app today** (no CodePush,
no expo-updates, no custom downloader — checked, confirmed absent).

But the app is built on Expo, and Expo's own plumbing already has an unused
hook for exactly this:

```
ReactNativeHostWrapperBase.getJSBundleFile()
      │  lazy sequence over reactNativeHostHandlers, first non-null wins
      ▼
reactNativeHostHandlers  ←  built from a hardcoded array in
                             ExpoModulesPackageList$LazyHolder's <clinit>
                             (currently 5 Package instances, none of which
                             implement a real getJSBundleFile — all fall
                             through to Kotlin's default-interface no-op)
      │
      ▼  (if every handler returns null)
falls back to assets://index.android.bundle
```

To make the app fetch-then-fallback, the smali patch needed is small:

1. One new class implementing `Package`, whose `createReactNativeHostHandlers()`
   returns one object implementing `ReactNativeHostHandler`. Only
   `getJSBundleFile(useDeveloperSupport)` needs a real body (return `null` when
   `useDeveloperSupport` is true — never interfere with Metro/dev reload).
2. Bump `ExpoModulesPackageList$LazyHolder`'s package array from 5 → 6 entries.
3. The handler's logic: do the network fetch on a worker thread with a hard
   wall-clock timeout (so a slow/unreachable server never risks an ANR),
   validate the response (size + `starts with "var __BUNDLE_START_TIME__"`)
   before trusting it, write to a `.tmp` file and atomically rename over the
   real destination on success. Any failure path just returns `null`, which
   transparently falls back to the embedded asset — the app can never end up
   in a broken state from a bad fetch.
4. Permissions already granted (`INTERNET`, `WRITE_EXTERNAL_STORAGE`,
   `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE`) — nothing new to declare.

One decompile → patch → rebuild → re-sign (the merge/align/sign pipeline
already exists in `0306.orig/`) → reinstall. Breaks Play Store updates for
this install permanently (expected, given it's a resigned sideload). After
that one patch, every future bundle change is just a file swap on the server
— no more APK rebuilds.

### 4a. The JS-side companion (boot-ok marker, config rotation, debug reporter)

The native loader (P2) depends on a JS half that writes the `boot-ok-<buildId>`
watchdog marker (D52). It is **redeployable JS**, and three facts let it attach
to the bundle without touching a single existing module byte:

- The bundle is **not IIFE-wrapped** — it opens `var __BUNDLE_START_TIME__=…`
  and `__r` is a genuine global. It ends with the entry calls
  `__r(160);\n__r(0);` followed by `//# sourceMappingURL` / `//# debugId`
  comments. So **top-level code appended after the entry call runs at startup**,
  right after module 0 registers the root component
  (`AppRegistry.registerComponent(<cfg>.name, () => App.default)`).
- A native module is reachable two ways. `requireNativeModule(name)` (module
  2150) is `ensureNativeModulesAreInstalled(); globalThis.expo?.modules?.[name]
  ?? NativeModulesProxy.default[name] ?? null`. The bare
  `globalThis.expo.modules.<Name>` path is **not** equivalent — it skips the
  install call and the proxy fallback. The companions therefore try
  `__r(2150).requireNativeModule('ExponentFileSystem')` first and keep the bare
  path only as a fallback: if that shortcut ever yielded `undefined`, no
  `boot-ok` would be written and **every** build would be quarantined on its
  third launch, silently, looking like a native bug. Either way gives
  `documentDirectory`, `writeAsStringAsync`, `makeDirectoryAsync`,
  `readDirectoryAsync` with **no dep-array edit** — `__r` is keyed by absolute
  module id, so no dependency entry is required. (The patch system's `patchback`
  rewrites only a module's factory *body* and re-emits the original
  `__d(…, id, [deps])` tail — it *cannot* add a dependency — which is exactly
  why the dep-free `globalThis.expo.modules` route matters.)
- `documentDirectory` is the `file://…/files/` URI form **with a trailing
  slash**; native addresses the same markers via the bare `getFilesDir()` path
  (D56). Both resolve to the same file — the scheme asymmetry is correct, not a
  bug to "fix."

Mechanism: `bundle-tool companion <in> <out> <companion.js> [--build-id <id>]`
(`src/commands/companion.js`) substitutes `__MJOLNIR_BUILD_ID__` and splices the
snippet in **before the sourcemap comments, after `__r(0);`**, modifying zero
module bytes. The companions live in `patches/js/`:
`boot-ok-companion.js` (the marker writer; a 3 s timer that fires only if the
process survives, with a bounded retry while expo modules finish installing),
`config-rotate.js` (exposes `globalThis.__mjolnirRotateOtaConfig(url, token)`,
https-only — D39/D53), and `ota-debug-report.js` (debug-only; logs the
`mjolnir-ota/` state to logcat under `ReactNativeJS`, corroborating native's
D63 breadcrumb). The buildId is substituted at build time because the publish
pipeline that would bake it does not exist in `mjolnir` yet (publishing today is
`tun/bin/ota-publish.sh`); pass the **same** id to that script so the marker
pairs with `bundle-<id>.js`.

## 5. Audio: no native patching needed at all

Audio files live in `res/raw/` (e.g. `a01001.mp3`), one per card id, 2870
files / 52MB, baked into the APK. Playback goes through
`react-native-sound-player` (`com.johnsonsu.rnsoundplayer`), whose native
module **already exposes `playUrl(url)`** alongside the local
`playSoundFile(name, ext)` — no smali changes required.

Every audio call in the app funnels through one JS wrapper, module `1440`:
```js
playSoundFile: function (n, o) { s.playSoundFile(n, o); }   // s = NativeModules.RNSoundPlayer
```
Patching this single function (not the many scattered call sites in modules
like `2013`/`1439`) covers every play-call in the app:
```
if audio server reachable (checked once per session, cached):
    s.playUrl(`${AUDIO_BASE_URL}/${name}.${ext}`)
else:
    s.playSoundFile(name, ext)      // unchanged original behavior
```
This is a pure JS-bundle edit — it ships the same way as any other bundle
change (no separate native patch), and is independently deployable today via
the existing `deobfuscate` → edit → `patch-back` pipeline, even before any OTA
mechanism exists.

## 6. How card/progress data is synced ("backup")

Backend: **Firebase** — Firestore (`@react-native-firebase/firestore`) +
Firebase Auth + one Cloud Function (`deleteUser`). Not a custom server.

```
Collection: "userData"
Document:   userData/{uid}        — one per Firebase Auth user
```
Sync logic lives entirely in module `2080` (`initUserData`, `updateUserData`,
`updateSessionUserData`, `getUserData`, `deleteUserData`). Every op refreshes
`currentUser.getIdToken()` first; several writes silently no-op if there's no
signed-in user (guest/offline installs never sync).

Document shape (defaults in `S()`, module 2080):
```js
{
  completedSessions, totalCards: [...],      // see below
  gameDecks, lastDeckPulled, restDays, dailyCards: 15,
  reminderSetting: [{days, hour, minute}, ...],
  decksStatus, selectedApproach, hasSeenMjolnirWay: {firstPage, lastPage},
  surveyAnswers, accountCreationDate,
  archivedCards, inProgressCards,            // derived counts, not source of truth
  firstSessionsCompleted, lastCompletedSession,
  consistencyRate,                           // sessions / days-since-signup, capped at 1
  acquisitionSource, marketingSurveySeen, hasSeenPaywall,
}
```

`totalCards` is the actual per-card SRS state. On write, each card's `N`/`E`/`X`
HTML is stripped before upload (`{N,E,X,...rest} → rest` — no point syncing
content that already lives in the bundle; it's re-fetched locally via
`getCard(ID)` on read). On read there's a legacy fallback: if `totalCards` is a
string, it's `lz-string`-decompressed from base64 + `JSON.parse`'d — an older
storage format; current writes store it as a plain array.

**Per-card progress record** (from the actual scheduler, module `2119`):
```js
{
  ID, language, DECK_ID,   // !! `language` is the DIRECTION letter N/E/A -- see C1
  Stage: number,       // 0 = brand new, climbs with successful reviews (200+ = graduated)
  Park: boolean,        // true = archived — this is the "archived cards" flag
  Postponed, Graduated: boolean,
  Type: "brand" | "same" | "prev",   // brand=new today, prev=due again
  Time: epoch-ms,       // last-touched — "next due" is derived from this, not stored
  CF: number,            // unclear exact meaning (some correctness/confidence factor)
  AutoParkHit, AutoTagHit, numberOfReschedulings: number,
}
```

**No explicit next-review-date field exists.** Due-ness is derived at
day-granularity:
```js
Bt(dayjs(card.Time).subtract(4,'h'), dayjs().subtract(4,'h')) <= 0   // due
```
`Bt` just diffs two dates as `YYYYMMDD` integers. The `subtract(4h)` everywhere
means the app's "day" rolls over at **4am local time**, not midnight. This
isn't a classic SM-2 algorithm (no `easeFactor`/variable `interval` per card)
— it's a simpler staged/box system.  **[WRONG — see C2. `CF` *is* an ease factor
and mod 2133 holds the interval tables.]** The deck-level `MaxInterval` /
`AutoTickStreak` / `AutoHammerCount` fields (§1) are almost certainly the
coarser pacing knobs (new cards/day, how forgiving a miss is), separate from
per-card `Stage`. Exactly how `Stage` maps to day-gaps wasn't fully traced —
would need a deeper read of `drawNewCards`/session-building logic in module
`2119` to pin down.

## 7. Applied patches: paywall / subscription bypass

This is a record of what was actually done, not a design — three commits in
`smali.merged.mjolnir/assets` (`0f6f580` → `b962691` → `a1f8f1f`), each
patching `index.android.bundle` directly, iterating toward intercepting the
paywall at an earlier point:

**1. `0f6f580` "set subscription hook at counter increment"**
Module `968` (the Redux reducer from §6) — the `SET_APP_OPENED_COUNTER` case
(fires on every app open) was extended to also force:
```js
cards_purchased: true, subscription_purchased: "Yearly, renews on 27/07/2040"
```
Rides a frequently-dispatched action rather than the real IAP/purchase flow.

**2. `b962691` "disable pyawall"**
Same `SET_APP_OPENED_COUNTER` case, same module `968` — added `paywall_visible:
false` alongside the fields from patch 1. Also a stray `console.log` left in
module `2119` (debug output, not functional).

**3. `a1f8f1f` "fix paywall earlier"**
Moved the override from `SET_APP_OPENED_COUNTER` to `SET_PAYWALL_VISIBLE`
itself — now *any* dispatch of that action (ignoring its real payload) forces
`paywall_visible: false, cards_purchased: true, subscription_purchased: "..."`.
This fires right when the app decides to show the paywall, rather than
waiting for the next app-open counter tick — hence "earlier." Also added
`ae(!1)` (a React state setter, same one toggled for the end-of-trial flag
earlier) into an effect/cleanup in module `2119`, suppressing the
end-of-trial UI at the component level too — belt-and-suspenders alongside
the Redux-level fix.

**Net effect of all three, as currently applied:** both `SET_APP_OPENED_COUNTER`
and `SET_PAYWALL_VISIBLE` unconditionally force the app into "subscribed"
state on their very next dispatch, regardless of actual purchase status.

---

# Corrections and additional findings (2026-10-20)

Two statements above are **wrong**; several gaps are now filled. This section
supersedes anything that contradicts it.

## C1. `language` is not a language — it is the direction letter ⚠️ CORRECTION

§6's progress record lists a `language` field without explanation. It holds the
**occurrence direction letter** (`"N"` / `"E"` / `"A"`), taken from the last
character of the occurrence string:

```js
// mod 2110, drawNewCards
k.language = p.card.substr(p.card.length - 1);   // "A05001E" → "E"
k.DECK_ID  = p.deck;
```

Every progress lookup keys on the **triple** `{ID, language, DECK_ID}`
(mods 2110, 2124, 2131):

```js
t.ID === e.card.slice(0,6) && t.language === e.card.substr(e.card.length-1) && t.DECK_ID === e.deck
```

**Therefore each occurrence of a card is scheduled independently.** A card with
occurrences `A`, `E`, `N` holds three separate SRS states, not one.

## C2. It *is* SM-2-shaped — `CF` is the ease factor ⚠️ CORRECTION

§6 says "This isn't a classic SM-2 algorithm (no `easeFactor`/variable `interval`
per card)". Mod **2133** holds the tables, in **minutes**:

```js
GraduationStage: [                       // pre-graduation learning steps
  {Hard: 1,   OK: 2,    Easy: 5},
  {Panic: 1,  Hard: 2,  OK: 5,    Easy: 10},
  {Panic: 1,  Hard: 3,  OK: 10,   Easy: 2880},
  {Panic: 1,  Hard: 5,  OK: 1440, Easy: 2880},
]
CFStage: [                               // post-graduation
  {Panic: 1, VeryHard: 5,  Hard: 15,   OK: 2880, Easy: 4320},
  {Panic: 1, VeryHard: 5,  Hard: 1440, OK: 4320, Easy: 7200},
  {Panic: 1, VeryHard: 10, Hard: 2880, OK: 5760, Easy: 8640},
]
CF4: { Hard: {min:25,  max:80,  value:50},     // percentages — an EASE FACTOR
       OK:   {min:110, max:200, value:137.5},
       Easy: {min:150, max:500, value:180} }
```

1440 = 1 day, 2880 = 2 d, 8640 = 6 d. Minute-granularity learning steps
graduating into day-granularity — which is why the 4 am rollover only appears in
the dueness check. `CF` is an ease factor in percent. The exact transition logic
in mod 2119 is still not fully traced.

Mod 2133 also holds `globalOptions` (tutorial flags, study schedule, `AutoPark`,
`AutoTag`, `FreshPark`, font/skin) and `options.newDailyCards: 5`.

## C3. Card IDs are exactly 6 characters — hard-coded

```js
// mod 2112 — the card index
getCard(t) { return 6 == t.length ? this.cards[t] : this.cards[t.substr(0, 6)]; }
```

plus `card.slice(0, 6)` in mods **2110, 2124, 2131**. Occurrence strings are
therefore exactly 7. Any generated card id must be 6 chars.

## C4. `PullCounter` is a block index — 5 occurrences per pull

```js
// mod 2110, drawNewCards
var v = 5 * PullCounter;
var u = premium ? deck.Cards.slice(v, v+5)
                : deck.Cards.filter(n => "N" === n.P).slice(v, v+5);
… deck.PullCounter++;
```

`PullCounter` lives in synced userdata (`decksInfo`). Consequences:

- **Appending to `Cards[]` is safe** — new entries land beyond the counter.
- **Reordering is catastrophic** — the counter then points at different cards and
  you silently, permanently *skip* some. (Duplicates would be caught by the
  `{ID, language, DECK_ID}` dedup at 2119:314; skips would not.)
- The non-premium branch filters to `P === "N"` **before** slicing, so the free
  tier indexes a different array entirely.

## C5. Occurrence statistics across all 2790 stock cards

| set | count |
|---|---|
| `EN` | 1124 |
| `N` | 987 |
| `AEN` | 376 |
| `A` | 278 |
| `AE` | 98 |
| `E` | 58 |

`A`-only and `E`-only are both well-used, so audio-only and answer-side-audio
cards are supported paths, not edge cases.

## C6. `Cards[]` ordering is minimum-lag re-insertion, not shuffling

```
C16 (50 cards × NE):
NNNNNNNNNNN ENENNENENNENENNENEN… EEEEEEEEEEEEEEEEEEEEEEEE
└─ 11 new ─┘ └ each E lands 11 behind its own N ┘ └ tail ┘
```

Measured minimum lags per deck do **not** correlate with `MaxInterval`,
`AutoTickStreak` or `AutoHammerCount` — C13–C17 are structurally identical and
all use 11, while A08 and B08 use 1. Different authoring batches, different
recipes. C13–C17 is the cleanest, clearly machine-generated family.

A lag of 11 is meaningful given C4: with 5 occurrences per pull, lag ≥ 11 puts a
card's occurrences at least two pull-blocks apart.

## C7. The deck-list screen groups by `Name.charAt(0)` and needs contiguity

```js
// mod 2119
switch (I.default[l].Name.charAt(0)) { case "Z": … case "A": … case "B": … case "C": }   // no default
… findIndex(first of group) … findIndex(last of group) + 1
```

Four `useState` pairs hold the per-category index ranges (`Be/Ue`, `Le/tt`,
`Me/ot`, `qe/st`), plus a second `switch (F)` on the selected approach. So:

- A deck whose name starts with anything else is **invisible** in the UI.
- Each category's decks must be a **contiguous range** of the deck array.

Existing deck names (37): `Z01–Z02, A01–A11, B01–B14, C01, C03, C10–C17` —
note the gaps at C02 and C04–C09, and nothing after C17.

## C8. Sync semantics (mod 2080) and local persistence

- Every op is `.get()` then `.update()` → **read-then-field-merge**, not replace.
- `if (doc.exists)` guards mean a **missing document silently disables all writes**.
- `updateSetting` additionally returns early while `completedSessions == 0`.
- `accountCreationDate` is a Firestore **`Timestamp`** (`.toDate()`), not a `Date`.
- `getUserData()` is called from **exactly two places** — the Google and Apple
  sign-in success handlers (mods 2205, 2114). Nothing reads the server at startup.
- The Redux store is
  `createStore(persistReducer({key:"primary", storage: AsyncStorage, stateReconciler}, …))`
  (mod **953**) → local state lives under the AsyncStorage key **`persist:primary`**.

**Therefore: local is the working copy and Firestore is pure backup.** A restore
can be performed by writing `persist:primary` before redux-persist rehydrates.

## C9. Nothing native is needed for audio or file storage

- `expo/modules/filesystem/FileSystemPackage` is **one of the five packages
  registered** in `ExpoModulesPackageList$LazyHolder`, exposing `downloadAsync`,
  `getInfoAsync`, `makeDirectoryAsync`, `moveAsync`, `deleteAsync`,
  `readAsStringAsync`, `writeAsStringAsync`, `documentDirectory`, `cacheDirectory`
  under the native module name **`ExponentFileSystem`**.
- The JS bundle contains `requireNativeModule` / `NativeModulesProxy` /
  `expo-modules-core` (mods 2143, 2148–2150, 2171), so that module is reachable
  from a patched bundle with no native work.
- `RNSoundPlayerModule.playUrl` → `prepareUrl` →
  `MediaPlayer.setDataSource(Context, Uri)` — which accepts `file:///…`.
- Audio playback call site: `playSoundFile(r.ID.toLowerCase(), 'mp3')` (mod 2124),
  gated on the shown side matching the card's `A` pointer.

## C10. Related documentation

Ecosystem design built on these findings lives in `docs/ecosystem/`.
Start at `docs/ecosystem/README.md`.
