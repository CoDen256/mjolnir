import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse } from "@babel/parser";
import generatorPkg from "@babel/generator";
import { runPatchback } from "../../src/commands/patchback.js";
import { parseBundle, readModuleSource } from "../../src/parseBundle.js";
import { extractFactoryBody } from "../../src/factory.js";

const generate = generatorPkg.default ?? generatorPkg;

const BASE_BUNDLE = path.resolve("base/smali.mjolnir.merged/assets/index.android.bundle");
const PAIR_BASELINE = path.resolve("patches/js/2119-deck-completion-display.baseline.js");
const PAIR_EDITED = path.resolve("patches/js/2119-deck-completion-display.edited.js");

async function patchedModule2119Source() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-tool-deck-completion-"));
  const outputPath = path.join(dir, "out.bundle");
  try {
    await runPatchback(BASE_BUNDLE, [`2119=${PAIR_BASELINE}:${PAIR_EDITED}`], outputPath);
    const patchedParsed = parseBundle(outputPath);
    return readModuleSource(outputPath, patchedParsed.modules.get(2119));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// A minimal dayjs-alike covering exactly the chain calls this module makes
// (subtract/startOf/diff/isAfter/isSame/toDate) — this module computes a
// couple of unconditional date values at the top of every render
// (`studyStart` day-count), so a real implementation is needed even though
// this test doesn't exercise date-dependent branches otherwise.
function fakeDayjs(input) {
  const d = input instanceof Date ? new Date(input.getTime()) : input === "ND" ? new Date(0) : new Date(input);
  const wrap = (dd) => ({
    subtract: (n, unit) => {
      const next = new Date(dd.getTime());
      if (unit === "hours") next.setHours(next.getHours() - n);
      return wrap(next);
    },
    startOf: (unit) => {
      const next = new Date(dd.getTime());
      if (unit === "day") next.setHours(0, 0, 0, 0);
      return wrap(next);
    },
    diff: (other, unit) => {
      const ms = dd.getTime() - other.toDate().getTime();
      return unit === "days" ? Math.round(ms / 86400000) : ms;
    },
    isAfter: (other) => dd.getTime() > other.toDate().getTime(),
    isSame: (other, unit) => {
      if (unit === "day") {
        const a = new Date(dd.getTime());
        a.setHours(0, 0, 0, 0);
        const b = new Date(other.toDate().getTime());
        b.setHours(0, 0, 0, 0);
        return a.getTime() === b.getTime();
      }
      return dd.getTime() === other.toDate().getTime();
    },
    toDate: () => dd,
  });
  return wrap(d);
}

// Renders module 2119's `TopicsToLearn` component against a fully mocked
// dependency set, with `jsx`/`jsxs` building a plain `{type, props}`
// descriptor tree (same trick as `myAccountPullButton.test.js`) and
// `useEffect`/`useCallback` running their body immediately (deps arrays are
// ignored — acceptable here since nothing in the scenarios this test
// exercises depends on skipping a re-run). `catalog` is the one deck this
// test controls directly (module 2111's `I.default`, the static deck
// list) — everything needed to exercise the Completion clamp and the
// removed session-start gate lives in this one deck's shape.
function loadPatchedModule2119(patchedSource, { catalog, decksInfo, drawNewCards, props = {} } = {}) {
  const ast = parse(patchedSource, { sourceType: "script", allowReturnOutsideFunction: true });
  const { factory } = extractFactoryBody(ast);
  const fnSrc = generate(factory, { comments: false }).code;
  const fn = eval(`(${fnSrc})`);

  const hookStates = [];
  let hookIndex = 0;
  function useState(initial) {
    const i = hookIndex++;
    if (hookStates.length <= i) hookStates.push(typeof initial === "function" ? initial() : initial);
    const setState = (v) => {
      hookStates[i] = v;
    };
    return [hookStates[i], setState];
  }
  const refs = [];
  let refIndex = 0;
  function useRef(initial) {
    const i = refIndex++;
    if (refs.length <= i) refs.push({ current: initial });
    return refs[i];
  }
  let pendingEffects = [];
  function useEffect(fn) {
    pendingEffects.push(fn);
  }
  function useCallback(fn) {
    return fn;
  }

  const jsx = (type, props) => ({ type, props });
  const jsxs = jsx;

  const alertCalls = [];
  const navigateCalls = [];
  const drawNewCardsCalls = [];

  const deps = [
    (obj) => (obj && obj.__esModule ? obj : { default: obj }), // d[0]
    { __esModule: true, default: (arr) => (Array.isArray(arr) ? [...arr] : arr) }, // d[1]: toConsumableArray spread helper
    { __esModule: true, default: (genFn) => (...args) => genFn(...args) }, // d[2]: asyncToGenerator
    { __esModule: true, default: (arr) => arr }, // d[3]: slicedToArray
    { useState, useEffect, useRef, useCallback }, // d[4]: React (CJS named-export shape)
    { connect: () => (Component) => Component }, // d[5]: react-redux
    { debounce: (f) => f }, // d[6]
    { __esModule: true, default: (input) => fakeDayjs(input) }, // d[7]: dayjs-alike
    {
      // d[8]: react-native
      View: "View",
      Text: "Text",
      SafeAreaView: "SafeAreaView",
      ScrollView: "ScrollView",
      Pressable: "Pressable",
      TouchableOpacity: "TouchableOpacity",
      Platform: { OS: "android" },
      StyleSheet: { create: (s) => s },
      Alert: { alert: (...args) => alertCalls.push(args) },
      ToastAndroid: { show: () => {} },
      BackHandler: { addEventListener: () => ({ remove: () => {} }), exitApp: () => {} },
    },
    { SafeAreaView: "SafeAreaView" }, // d[9]
    { useIsFocused: () => false }, // d[10]
    { __esModule: true, default: "CheckBox" }, // d[11]
    { __esModule: true, default: { setType: () => {}, getTheme: () => ({ heading: "#000", exclamation: "!", background: "#fff", buttonColor1: "#00f", titleBackground: "#eee", borderColor2: "#ccc", chooseTopicsBg: "#fff", borderColorSecondary: "#ddd", headingAccent: "#000", arrowUp: "^", arrowDown: "v" }) } }, // d[12]: theme
    { __esModule: true, default: { header: {}, secondaryText: {}, headerText: {}, smallText: {} }, Fonts: { poppinsSemiBold: "semibold" } }, // d[13]
    { normalize: (n) => n, isAndroid: true }, // d[14]
    { __esModule: true, default: "BackButton" }, // d[15]
    { __esModule: true, default: "StartSessionButton" }, // d[16]: Button component (jsx mock never invokes it)
    { __esModule: true, default: "MarkdownView" }, // d[17]
    { __esModule: true, default: { drawNewCards: (...args) => (drawNewCardsCalls.push(args), drawNewCards(...args)) } }, // d[18]: decks logic
    { setDecks: (v) => ({ type: "SET_DECKS", payload: v }), passInitialOnboarding: (v) => ({ type: "PASS_ONBOARDING", payload: v }), setTotalCards: (v) => ({ type: "SET_TOTAL_CARDS", payload: v }), setDecksInfo: (v) => ({ type: "SET_DECKS_INFO", payload: v }), setLastDeckPulled: (v) => ({ type: "SET_LAST_DECK_PULLED", payload: v }), setLastDayPulled: (v) => ({ type: "SET_LAST_DAY_PULLED", payload: v }), setStudyDay: (v) => ({ type: "SET_STUDY_DAY", payload: v }), setStudyStart: (v) => ({ type: "SET_STUDY_START", payload: v }), setCurrentSession: (v) => ({ type: "SET_CURRENT_SESSION", payload: v }), setCurrentId: (v) => ({ type: "SET_CURRENT_ID", payload: v }), setCurrentToGraduate: (v) => ({ type: "SET_CURRENT_TO_GRADUATE", payload: v }), setStudyEnd: (v) => ({ type: "SET_STUDY_END", payload: v }), setCompletedSessions: () => ({}), setPaywallVisible: () => ({}), setAppOpenedCounter: () => ({}), setLastOpenedDate: () => ({}), setTodaysInjections: () => ({}) }, // d[19]: deck actions
    { __esModule: true, default: { updateSetting: () => Promise.resolve() } }, // d[20]: 2080 shim
    { __esModule: true, default: catalog }, // d[21]: 2111 — the static deck catalog
    { __esModule: true, default: { getCard: () => { throw new Error("getCard should not be called in this test"); } } }, // d[22]
    { __esModule: true, View: "AnimatedView" }, // d[23]
    { jsx, jsxs, Fragment: "Fragment" }, // d[24]: jsx runtime
  ];
  const requireStub = (idx) => deps[idx];

  global.__r = () => {
    throw new Error("module 2119's own patched factory should not call __r directly");
  };

  const mod = { exports: {} };
  fn({}, requireStub, (x) => x, (x) => x, mod, mod.exports, Array.from({ length: 25 }, (_, i) => i));

  const Component = mod.exports.default;

  function render() {
    hookIndex = 0;
    refIndex = 0;
    pendingEffects = [];
    const tree = Component({
      navigation: { navigate: (...args) => navigateCalls.push(args) },
      mode: "light",
      studyCardVisited: false,
      totalCards: [],
      decksInfo,
      gameDecks: catalog.map((d) => d.ID),
      languageLevel: 1,
      cardFrequency: null,
      restDays: [],
      lastDeckPulled: -1,
      lastDayPulled: 0,
      studyDay: 1,
      studyStart: "ND",
      studyEnd: "ND",
      setDecks: () => {},
      setTotalCards: () => {},
      setDecksInfo: () => {},
      setLastDeckPulled: () => {},
      setLastDayPulled: () => {},
      setStudyDay: () => {},
      setStudyStart: () => {},
      setCurrentSession: () => {},
      setCurrentId: () => {},
      setCurrentToGraduate: () => {},
      setStudyEnd: () => {},
      setCompletedSessions: () => {},
      setPaywallVisible: () => {},
      setAppOpenedCounter: () => {},
      setLastOpenedDate: () => {},
      setTodaysInjections: () => {},
      currentSession: [],
      currentId: 0,
      currentToGraduate: 0,
      dailyCards: 15,
      completedSessions: 0,
      paywallVisible: false,
      appOpenedCounter: 0,
      lastOpenedDate: "ND",
      cardsPurchased: false,
      subscriptionPurchased: null,
      maxFreeAppOpenedCounter: 9999,
      maxFreeCompletedSessions: 9999,
      marketingSurveySeen: true,
      passInitialOnboarding: () => {},
      ...props,
    });
    pendingEffects.forEach((fn) => fn());
    return tree;
  }

  function findByTitle(tree, title) {
    if (!tree || typeof tree !== "object") return null;
    if (tree.props && tree.props.title === title) return tree;
    const children = tree.props && tree.props.children;
    const list = Array.isArray(children) ? children : children ? [children] : [];
    for (const child of list) {
      const found = findByTitle(child, title);
      if (found) return found;
    }
    return null;
  }

  return { render, findByTitle, alertCalls, navigateCalls, drawNewCardsCalls };
}

function cleanup() {
  delete global.__r;
}

test("deck-completion-display: a deck whose occurrence count isn't a multiple of 5 displays exactly 100%, not an overshoot (D-D1)", async () => {
  const source = await patchedModule2119Source();
  const catalog = [{ ID: "C20", Name: "TESTDECK", Cards: new Array(6).fill({}) }];
  const decksInfo = [{ ID: "C20", Name: "TESTDECK", PullCounter: 2 }]; // 5*2/6*100 = 166.67% unclamped
  const { render } = loadPatchedModule2119(source, {
    catalog,
    decksInfo,
    drawNewCards: (V, dailyCards, lastDeckPulled, decksInfo_, totalCards) => ({
      lastDeckPulled,
      decksInfo: decksInfo_,
      totalCards,
      deckPulledToday: [],
    }),
  });

  render();
  assert.equal(catalog[0].Completion, 100);
  cleanup();
});

test("deck-completion-display: a partially-drawn deck's completion is unchanged by the clamp", async () => {
  const source = await patchedModule2119Source();
  const catalog = [{ ID: "C20", Name: "TESTDECK", Cards: new Array(20).fill({}) }];
  const decksInfo = [{ ID: "C20", Name: "TESTDECK", PullCounter: 2 }]; // 5*2/20*100 = 50%, well under 100
  const { render } = loadPatchedModule2119(source, {
    catalog,
    decksInfo,
    drawNewCards: (V, dailyCards, lastDeckPulled, decksInfo_, totalCards) => ({
      lastDeckPulled,
      decksInfo: decksInfo_,
      totalCards,
      deckPulledToday: [],
    }),
  });

  render();
  assert.equal(catalog[0].Completion, 50);
  cleanup();
});

test("deck-completion-display: starting a session draws real cards immediately, with no interstitial, even when the selected deck reads >=100% (D-D2)", async () => {
  const source = await patchedModule2119Source();
  const catalog = [{ ID: "C20", Name: "TESTDECK", Cards: new Array(6).fill({}) }];
  const decksInfo = [{ ID: "C20", Name: "TESTDECK", PullCounter: 2 }]; // overshoots to 166% pre-clamp, 100% post-clamp — either way, >=100
  const { render, findByTitle, alertCalls, navigateCalls, drawNewCardsCalls } = loadPatchedModule2119(source, {
    catalog,
    decksInfo,
    drawNewCards: (V, dailyCards, lastDeckPulled, decksInfo_, totalCards) => ({
      lastDeckPulled,
      decksInfo: decksInfo_,
      // One genuinely fresh, never-before-seen card — pre-populated N/E/X so
      // the test doesn't also need to mock module 2112's getCard.
      totalCards: [...totalCards, { ID: "C20001", language: "N", DECK_ID: "TESTDECK", N: "n", E: "e", X: null, Postponed: false }],
      deckPulledToday: ["TESTDECK"],
    }),
  });

  let tree = render();
  // A second render reflects `be` (the mount-time `bt()` result) having
  // settled — this module's own effects update it via setState, same
  // "render twice to reach steady state" pattern used elsewhere in this
  // test suite for components with mount-time effects.
  tree = render();

  const button = findByTitle(tree, "Start today's session");
  assert.ok(button, "expected the session-start button to read 'Start today's session', not 'Done for today'");

  button.props.onPress();

  assert.equal(drawNewCardsCalls.length, 1, "drawNewCards must be called on the very first press — no interstitial swallowing it");
  assert.equal(alertCalls.length, 0, "no 'No new cards' alert — a real card was drawn");
  assert.ok(navigateCalls.length >= 1, "expected navigation into the study session");
  const studySessionNav = navigateCalls.find((args) => args[0] === "StudyCards" || args[0] === "TipOfTheDay");
  assert.ok(studySessionNav, `expected navigation to the study session screen, got: ${JSON.stringify(navigateCalls)}`);
  assert.ok(studySessionNav[1].sessionCards.length > 0, "expected the genuinely new card to be included in the session");
  cleanup();
});

test("deck-completion-display: a genuinely exhausted deck still shows 'No new cards for today!' — the real signal is untouched by the gate's removal", async () => {
  const source = await patchedModule2119Source();
  const catalog = [{ ID: "C20", Name: "TESTDECK", Cards: new Array(6).fill({}) }];
  const decksInfo = [{ ID: "C20", Name: "TESTDECK", PullCounter: 2 }];
  const { render, findByTitle, alertCalls, navigateCalls, drawNewCardsCalls } = loadPatchedModule2119(source, {
    catalog,
    decksInfo,
    drawNewCards: (V, dailyCards, lastDeckPulled, decksInfo_, totalCards) => ({
      lastDeckPulled,
      decksInfo: decksInfo_,
      totalCards, // unchanged — nothing new to draw
      deckPulledToday: [],
    }),
  });

  let tree = render();
  tree = render();
  findByTitle(tree, "Start today's session").props.onPress();

  assert.equal(drawNewCardsCalls.length, 1);
  assert.equal(alertCalls.length, 1);
  assert.equal(alertCalls[0][0], "No new cards for today!");
  assert.equal(navigateCalls.filter((args) => args[0] === "StudyCards" || args[0] === "TipOfTheDay").length, 0);
  cleanup();
});
