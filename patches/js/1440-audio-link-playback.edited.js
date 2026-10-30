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
  // D-A2: literal string, not the companion-constant mechanism and not
  // config.json (which has no JS-side reader). Re-author this file and
  // republish to change the domain.
  var AUDIO_BASE_URL = "https://coden256.dev/audio-by-card";
  // D-A1: checks FOR stock, not for custom — a future rollover deck (e.g.
  // C30) isn't a stock prefix either, so it's automatically treated as
  // custom with no patch update needed.
  function isStockPrefix(cardId) {
    var firstChar = cardId.charAt(0);
    if (firstChar === "a" || firstChar === "b" || firstChar === "z") return true;
    var match = /^c(\d{2})/.exec(cardId);
    return !!match && Number(match[1]) >= 1 && Number(match[1]) <= 17;
  }
  e.default = {
    playSoundFile: function (n, o) {
      if (isStockPrefix(n)) {
        s.playSoundFile(n, o);
        return;
      }
      s.playUrl(AUDIO_BASE_URL + "/" + n + "." + o);
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
