// Mjølnir progress sync — manual pull companion (progress-sync-manual-pull,
// D-M1/D-M2). Appended the same way `boot-ok-companion.js` is, via
// `bundle-tool companion` — no new append mechanism, modifies zero existing
// module bytes.
//
// Replaces `progress-sync-restore-companion.js` (deleted — D127/D-S4's
// one-shot restore-on-launch mechanism was found unreliable in practice:
// Google Sign-In on a resigned APK is itself unreliable, and the stock
// app's own sign-in -> redux-persist rehydration is laggy, so a single
// fire-once attempt could easily land at the wrong moment and, once spent,
// never get a second chance).
//
// D-M1: this file does NOT self-invoke. It only defines
// `globalThis.MJOLNIR_PULL_CLOUD_PROGRESS`, a callable returning a Promise
// — same cross-boundary-global convention as `MJOLNIR_BUILD_ID`/
// `MJOLNIR_AUDIO_MANIFEST` (this companion and the patched account-screen
// module, 2176, are two separate appended/patched pieces of code with no
// shared scope otherwise). The account screen's own "Pull cloud progress"
// button is the only caller — D-M2: no marker, no automatic call, ever.
//
// The restore logic itself (`restoreFromDoc`) is carried over unchanged
// from the deleted companion: dispatches the exact same action creators
// mod 2205's own sign-in restore uses, through the real, already-
// constructed redux store (module 953's default export) — reusing the
// app's own real code paths rather than hand-constructing redux-persist's
// on-disk shape.
//
// `__MJOLNIR_SYNC_BASE_URL__`/`__MJOLNIR_SYNC_TOKEN__` are placeholders,
// substituted the same way `__MJOLNIR_BUILD_ID__` is (src/commands/
// companion.js's `appendCompanion`) — baked at `bundle-tool companion`/
// `bundle-tool assemble` time via `--sync-base-url`/`--sync-token`. Must be
// given the SAME values passed when baking `2080-progress-sync-shim.
// edited.js`'s copy of these two placeholders — both patches talk to the
// same hub.
(function () {
  var SYNC_BASE_URL = '__MJOLNIR_SYNC_BASE_URL__';
  var SYNC_TOKEN = '__MJOLNIR_SYNC_TOKEN__';

  // Module ids pinned to this specific base bundle (same convention as
  // `boot-ok-companion.js`'s hardcoded 2150) — not derived, not looked up.
  var MOD_FIREBASE_AUTH = 1220;
  var MOD_STORE = 953;
  var MOD_DECK_ACTIONS = 1408;
  var MOD_SETTINGS_ACTIONS = 1411;
  var MOD_DECKS_LOGIC = 2110;

  // D-M5: unlike the deleted companion (silent by design — it ran
  // unattended at launch), this is a user-triggered action and its result
  // must be visible. Logging too, same logcat convention every companion
  // in this repo uses (D63):
  //     adb logcat -s ReactNativeJS:V | grep mjolnir-progress-pull
  var TAG = '[mjolnir-progress-pull]';
  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(TAG);
      console.log.apply(console, args);
    } catch (e) {}
  }

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

  // Resolves with { status: 'restored' } or { status: 'nothing-to-restore' }
  // (a real, existing server doc vs. this call's own GET auto-creating one
  // — D-S2/D-S4's `_justCreated` check, unchanged). Rejects with an Error
  // whose `.code` is `'not-signed-in'` when there's no signed-in uid to
  // pull for, or the real fetch/HTTP error otherwise — callers (the account
  // screen's button) are expected to show these to the user (D-M5), never
  // swallow them the way the deleted companion's background run() did.
  function pullCloudProgress() {
    var uid;
    try {
      var auth = __r(MOD_FIREBASE_AUTH).default();
      uid = auth && auth.currentUser && auth.currentUser.uid;
    } catch (e) {}

    if (!uid) {
      log('not signed in — nothing to pull');
      var notSignedIn = new Error('not signed in');
      notSignedIn.code = 'not-signed-in';
      return Promise.reject(notSignedIn);
    }

    log('pulling cloud progress for', uid);
    return fetch(SYNC_BASE_URL + '/' + encodeURIComponent(uid), {
      headers: { Authorization: 'Bearer ' + SYNC_TOKEN }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('pull failed: HTTP ' + res.status);
        return res.json();
      })
      .then(function (doc) {
        // D-S2/D-S4: only restore a REAL existing document — not this
        // call's own auto-creation. hub's GET marks that case explicitly
        // (`_justCreated`); nothing else in the bundle reads or depends on
        // that field.
        if (!doc || doc._justCreated) {
          log('no cloud progress for this account yet');
          return { status: 'nothing-to-restore' };
        }
        restoreFromDoc(doc);
        log('restored cloud progress');
        return { status: 'restored' };
      })
      .catch(function (e) {
        log('pull failed:', e && e.message ? e.message : String(e));
        throw e;
      });
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.MJOLNIR_PULL_CLOUD_PROGRESS = pullCloudProgress;
  }
})();
