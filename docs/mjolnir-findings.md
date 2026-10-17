# Mjølnir reverse-engineering notes

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
- **`P` is a red herring** — it's an independent per-occurrence flag (observed
  values `N`/`Y`) that does *not* correlate with the direction letter. We
  confirmed this directly: deck `A03` has `P:"Y"` entries whose `Card` suffix is
  `N`, `E`, *and* `A` — all three. Whatever `P` tracks (looks like some kind of
  per-occurrence review/scheduling flag, unconfirmed), it's orthogonal to
  direction. **Any tooling that edits `Cards[]` should always write `P:"N"`**
  and derive direction purely from the `Card` string's last character.
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
  ID, language, DECK_ID,
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
— it's a simpler staged/box system. The deck-level `MaxInterval` /
`AutoTickStreak` / `AutoHammerCount` fields (§1) are almost certainly the
coarser pacing knobs (new cards/day, how forgiving a miss is), separate from
per-card `Stage`. Exactly how `Stage` maps to day-gaps wasn't fully traced —
would need a deeper read of `drawNewCards`/session-building logic in module
`2119` to pin down.
