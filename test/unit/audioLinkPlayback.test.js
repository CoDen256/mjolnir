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
const PAIR_BASELINE = path.resolve("patches/js/1440-audio-link-playback.baseline.js");
const PAIR_EDITED = path.resolve("patches/js/1440-audio-link-playback.edited.js");

// Loads module 1440's exports with a minimal native-module stub recording
// every call made through `RNSoundPlayer`, so each assertion below can
// check exactly which native method (and with what arguments) the patched
// `playSoundFile` actually invoked.
function loadPatchedModule1440(patchedSource) {
  const ast = parse(patchedSource, { sourceType: "script", allowReturnOutsideFunction: true });
  const { factory } = extractFactoryBody(ast);
  const fnSrc = generate(factory, { comments: false }).code;
  const fn = eval(`(${fnSrc})`);

  const calls = [];
  const rnSoundPlayer = {
    playSoundFile: (...args) => calls.push({ method: "playSoundFile", args }),
    playUrl: (...args) => calls.push({ method: "playUrl", args }),
  };
  const reactNativeStub = {
    NativeModules: { RNSoundPlayer: rnSoundPlayer },
    NativeEventEmitter: function () {
      return { addListener: () => ({ remove: () => {} }) };
    },
    Platform: { OS: "android" },
  };
  const interopDefault = (obj) => (obj && obj.__esModule ? obj : { default: obj });
  const deps = [
    interopDefault, // d[0]: module 1 — _interopRequireDefault
    // d[1]: module 68 — asyncToGenerator helper. `playAsset`/`getInfo` call
    // this immediately at object-literal construction time (not lazily), so
    // it must be a real function even though playSoundFile never uses it.
    { __esModule: true, default: (genFn) => (...args) => genFn(...args) },
    reactNativeStub, // d[2]: module 5 — react-native
    { __esModule: true, default: () => ({ uri: "stub" }) }, // d[3]: module 102 — asset resolver, unused by playSoundFile
  ];
  const requireStub = (idx) => deps[idx];

  const mod = { exports: {} };
  fn({}, requireStub, (x) => x, (x) => x, mod, mod.exports, [0, 1, 2, 3]);

  return { exports: mod.exports.default, calls };
}

async function patchedModule1440Source() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-tool-audio-link-"));
  const outputPath = path.join(dir, "out.bundle");
  try {
    await runPatchback(BASE_BUNDLE, [`1440=${PAIR_BASELINE}:${PAIR_EDITED}`], outputPath);
    const patchedParsed = parseBundle(outputPath);
    return readModuleSource(outputPath, patchedParsed.modules.get(1440));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("1440-audio-link-playback: a stock-prefixed id still calls playSoundFile unchanged", async () => {
  const source = await patchedModule1440Source();
  const stockIds = ["a001", "b014", "c01007", "c17099", "z003"];
  for (const id of stockIds) {
    const { exports, calls } = loadPatchedModule1440(source);
    exports.playSoundFile(id, "mp3");
    assert.deepEqual(calls, [{ method: "playSoundFile", args: [id, "mp3"] }], `expected ${id} to play locally`);
  }
});

test("1440-audio-link-playback: a non-stock id calls playUrl with the expected URL shape", async () => {
  const source = await patchedModule1440Source();
  const { exports, calls } = loadPatchedModule1440(source);
  exports.playSoundFile("c20001", "mp3");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "playUrl");
  assert.match(calls[0].args[0], /^https:\/\/.+\/audio-by-card\/c20001\.mp3$/);
});

test("1440-audio-link-playback: a future-rollover id (e.g. c30xxx) is treated as non-stock", async () => {
  const source = await patchedModule1440Source();
  const { exports, calls } = loadPatchedModule1440(source);
  exports.playSoundFile("c30001", "mp3");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "playUrl");
  assert.match(calls[0].args[0], /c30001\.mp3$/);
});
