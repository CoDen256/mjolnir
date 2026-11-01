__d(function (g, r, i, a, m, e, d) {
  "use strict";

  var n = r(d[0]);
  Object.defineProperty(e, "__esModule", {
    value: !0
  }), e.default = void 0;
  var o,
    t,
    u = n(r(d[1])),
    l = r(d[2]),
    f = n(r(d[3])),
    s = l.NativeModules.RNSoundPlayer,
    c = new l.NativeEventEmitter(s),
    p = null,
    y = null;
  // D-A1: checks FOR stock, not for custom — a future rollover deck (e.g.
  // C30) isn't a stock prefix either, so it's automatically treated as
  // custom with no patch update needed.
  function isStockPrefix(cardId) {
    var firstChar = cardId.charAt(0);
    if (firstChar === "a" || firstChar === "b" || firstChar === "z") return true;
    var match = /^c(\d{2})/.exec(cardId);
    return !!match && Number(match[1]) >= 1 && Number(match[1]) <= 17;
  }
  // D122/audio-cache-prefetch: `playUrl`/`loadUrl` cannot play a remote
  // `https://` URL at all (confirmed on a real device, traced to the
  // compiled smali) — only a local `file://` path ever works. A non-stock
  // card therefore only ever plays from the local cache the
  // `audio-prefetch-companion.js` companion populates ahead of time, never
  // via a direct URL. `__r`/`ExponentFileSystem` are reachable the same way
  // every other companion in this repo already reaches them — no dependency
  // array edit needed, `__r` is a genuine bundle-wide global keyed by
  // absolute module id (confirmed, docs/findings.md §4).
  var MOD_EXPO_MODULES_CORE = 2150;
  function fileSystem() {
    try {
      if (typeof __r === "function") {
        var mod = __r(MOD_EXPO_MODULES_CORE);
        if (mod && typeof mod.requireNativeModule === "function") {
          var viaApp = mod.requireNativeModule("ExponentFileSystem");
          if (viaApp) return viaApp;
        }
      }
    } catch (ex) {}
    var g2 = typeof globalThis !== "undefined" ? globalThis : null;
    return g2 && g2.expo && g2.expo.modules && g2.expo.modules.ExponentFileSystem;
  }
  e.default = {
    playSoundFile: function (n, o) {
      if (isStockPrefix(n)) {
        s.playSoundFile(n, o);
        return;
      }
      // D-P2: the manifest is an in-memory global the prefetcher companion
      // already populated — no fetch here, this lookup is synchronous.
      var manifest = typeof globalThis !== "undefined" ? globalThis.MJOLNIR_AUDIO_MANIFEST : null;
      var sha256 = manifest && manifest[n];
      if (!sha256) return; // D-P3: no manifest entry — silent skip, never a URL attempt
      var FS;
      try {
        FS = fileSystem();
      } catch (ex) {
        return;
      }
      if (!FS || !FS.documentDirectory) return;
      // documentDirectory is already a `file://…/` URI (D56) — do not
      // prepend another `file://` scheme on top of it.
      var path = FS.documentDirectory + "mj-audio/" + sha256 + ".mp3";
      FS.getInfoAsync(path)
        .then(function (info) {
          if (info && info.exists) s.playUrl(path); // D-P3: cache hit only, never a remote URL
        })
        .catch(function () {});
    },
    playSoundFileWithDelay: function (n, o, t) {
      s.playSoundFileWithDelay(n, o, t);
    },
    loadSoundFile: function (n, o) {
      s.loadSoundFile(n, o);
    },
    setNumberOfLoops: function (n) {
      s.setNumberOfLoops(n);
    },
    playUrl: function (n) {
      s.playUrl(n);
    },
    loadUrl: function (n) {
      s.loadUrl(n);
    },
    playAsset: (t = (0, u.default)(function* (n) {
      __DEV__ || "android" !== l.Platform.OS ? s.playUrl((0, f.default)(n).uri) : s.playSoundFile((0, f.default)(n).uri, '');
    }), function (n) {
      return t.apply(this, arguments);
    }),
    loadAsset: function (n) {
      __DEV__ || "android" !== l.Platform.OS ? s.loadUrl((0, f.default)(n).uri) : s.loadSoundFile((0, f.default)(n).uri, '');
    },
    onFinishedPlaying: function (n) {
      p && (p.remove(), p = void 0), p = c.addListener("FinishedPlaying", n);
    },
    onFinishedLoading: function (n) {
      y && (y.remove(), y = void 0), y = c.addListener("FinishedLoading", n);
    },
    addEventListener: function (n, o) {
      return c.addListener(n, o);
    },
    play: function () {
      s.resume();
    },
    pause: function () {
      s.pause();
    },
    resume: function () {
      s.resume();
    },
    stop: function () {
      s.stop();
    },
    seek: function (n) {
      s.seek(n);
    },
    setVolume: function (n) {
      s.setVolume(n);
    },
    setSpeaker: function (n) {
      s.setSpeaker(n);
    },
    setMixAudio: function (n) {
      "android" === l.Platform.OS ? console.log("setMixAudio is not implemented on Android") : s.setMixAudio(n);
    },
    getInfo: (o = (0, u.default)(function* () {
      return s.getInfo();
    }), function () {
      return o.apply(this, arguments);
    }),
    unmount: function () {
      p && (p.remove(), p = void 0), y && (y.remove(), y = void 0);
    }
  };
}, 1440, [1, 68, 5, 102]);
