// Mjølnir progress sync — startup restore companion (D-S4, progress-sync-
// shim). Appended the same way `boot-ok-companion.js` is, via
// `bundle-tool companion` — no new append mechanism, modifies zero existing
// module bytes.
//
// D-S4: this module does restore ONLY. It does NOT duplicate the
// exists-guarantee — that lives server-side on `GET` (D-S2, hub/src/
// userdata.js's `getOrCreate`). Sign-in-triggered restore (`initUserData()`
// + `getUserData()`, mods 2114/2205) is untouched and keeps working exactly
// as before, against this same backend. This module is the *additional*
// path for an already-authenticated session that won't replay sign-in on
// its own.
//
// Refines D-S4's original pseudocode ("write it into AsyncStorage under
// persist:primary") after reading the real reducers (confirmed via mods
// 964/965/967/968/1408/1411/2110): `persist:primary`'s on-disk shape is
// redux-persist's own serialization, and the `deckStats` slice's field
// names (`completed_sessions`, `decks_info`, ...) are NOT the Firestore
// doc's camelCase field names — `decksStatus` in particular only resolves
// into `decks_info` via mod 2110's own `initDecksStatus` merge logic, not a
// plain rename. Hand-constructing that blob directly would mean
// re-implementing reducer internals outside the reducers. Dispatching the
// exact same action creators mod 2205's own sign-in restore uses — through
// the real, already-constructed redux store (module 953's default export)
// — reuses the app's own real code paths instead, and is safe regardless
// of exactly when this fires relative to redux-persist's async REHYDRATE:
// there is nothing on disk to conflict with in the one scenario this
// module acts on (no local progress yet).
//
// `__MJOLNIR_SYNC_BASE_URL__`/`__MJOLNIR_SYNC_TOKEN__` are placeholders,
// substituted the same way `__MJOLNIR_BUILD_ID__` is (src/commands/
// companion.js's `appendCompanion`) — baked at `bundle-tool companion`/
// `bundle-tool assemble` time via `--sync-base-url`/`--sync-token`, not
// hand-edited into this file. Must be given the SAME values passed when
// baking `2080-progress-sync-shim.edited.js`'s copy of these two
// placeholders (via `substituteSyncPlaceholders`) — both patches talk to
// the same hub.
(function () {
  var SYNC_BASE_URL = '__MJOLNIR_SYNC_BASE_URL__';
  var SYNC_TOKEN = '__MJOLNIR_SYNC_TOKEN__';
  var MARKER_KEY = 'mjolnir-sync-restore-done';

  // Module ids pinned to this specific base bundle (same convention as
  // `boot-ok-companion.js`'s hardcoded 2150) — not derived, not looked up.
  var MOD_ASYNC_STORAGE = 986;
  var MOD_FIREBASE_AUTH = 1220;
  var MOD_STORE = 953;
  var MOD_DECK_ACTIONS = 1408;
  var MOD_SETTINGS_ACTIONS = 1411;
  var MOD_DECKS_LOGIC = 2110;

  function restoreFromDoc(doc) {
    var store = __r(MOD_STORE).default;
    var deckActions = __r(MOD_DECK_ACTIONS);
    var settingsActions = __r(MOD_SETTINGS_ACTIONS);
    var decksLogic = __r(MOD_DECKS_LOGIC).default;

    // Mirrors mod 2205's own post-`getUserData()` dispatch sequence
    // exactly — same actions, same order, same `reminderSetting` split.
    store.dispatch(settingsActions.setRestDays(doc.restDays));
    store.dispatch(settingsActions.setDailyCards(doc.dailyCards));
    store.dispatch(deckActions.setLastDeckPulled(doc.lastDeckPulled));
    store.dispatch(deckActions.setDecks(doc.gameDecks));
    if (doc.reminderSetting) {
      store.dispatch(settingsActions.setReminderSetting({ reminder1: doc.reminderSetting[0] }));
      store.dispatch(settingsActions.setReminderSetting({ reminder2: doc.reminderSetting[1] }));
    }
    store.dispatch(deckActions.setCompletedSessions(doc.completedSessions));
    store.dispatch(deckActions.setTotalCards(doc.totalCards));
    store.dispatch(settingsActions.setMarketingSurveySeen(doc.marketingSurveySeen));
    store.dispatch(settingsActions.setAcquisitionSource(doc.acquisitionSource));
    store.dispatch(settingsActions.setSelectedApproach(doc.selectedApproach));
    store.dispatch(settingsActions.setHasSeenMjolnirWay(doc.hasSeenMjolnirWay));

    var currentDecksInfo = store.getState().deckStats.decks_info;
    var mergedDecksInfo = decksLogic.initDecksStatus(currentDecksInfo, doc.decksStatus || []);
    store.dispatch(deckActions.setDecksInfo(mergedDecksInfo));
  }

  function run() {
    var AsyncStorage;
    try {
      AsyncStorage = __r(MOD_ASYNC_STORAGE).default;
    } catch (e) {
      return;
    }

    AsyncStorage.getItem(MARKER_KEY)
      .then(function (marker) {
        // Never repeat this check once the marker is set (D-S4).
        if (marker) return;

        var finish = function () {
          return AsyncStorage.setItem(MARKER_KEY, '1').catch(function () {});
        };

        var uid;
        try {
          var auth = __r(MOD_FIREBASE_AUTH).default();
          uid = auth && auth.currentUser && auth.currentUser.uid;
        } catch (e) {}

        // Not signed in — mirrors mod 2080's own unhandled `currentUser`
        // gap (D-S1): nothing to restore from, same risk already accepted.
        if (!uid) return finish();

        return fetch(SYNC_BASE_URL + '/' + encodeURIComponent(uid), {
          headers: { Authorization: 'Bearer ' + SYNC_TOKEN }
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (doc) {
            // D-S2/D-S4: only restore a REAL existing document — not this
            // call's own auto-creation. hub's GET marks that case
            // explicitly (`_justCreated`); nothing else in the bundle reads
            // or depends on that field.
            if (doc && !doc._justCreated) {
              restoreFromDoc(doc);
            }
          })
          .catch(function () {})
          .then(finish, finish);
      })
      .catch(function () {});
  }

  try {
    run();
  } catch (e) {}
})();
