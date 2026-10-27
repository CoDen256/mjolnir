import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { assembleBundle } from "../../src/commands/assemble.js";
import { savePatch } from "../../src/patches.js";
import { parseBundle, readModuleSource } from "../../src/parseBundle.js";

const DEMO_BUNDLE = path.resolve("test/fixtures/demo.bundle");
const COMPANION_FILE = path.resolve("patches/js/boot-ok-companion.js");

async function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-tool-assemble-"));
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// A minimal decoded-base-APK-folder shape: `apktool.yml` (for base_version)
// + `assets/index.android.bundle` (the actual Metro bundle) — mirrors this
// repo's own `base/smali.mjolnir.merged/`.
function makeBaseFolder(dir, versionName) {
  const baseFolder = path.join(dir, "base-folder");
  fs.mkdirSync(path.join(baseFolder, "assets"), { recursive: true });
  fs.copyFileSync(DEMO_BUNDLE, path.join(baseFolder, "assets", "index.android.bundle"));
  fs.writeFileSync(
    path.join(baseFolder, "apktool.yml"),
    `version: 2.12.1\nversionInfo:\n  versionCode: 1\n  versionName: ${versionName}\n`
  );
  return baseFolder;
}

function moduleSource(bundlePath, moduleId) {
  const { modules } = parseBundle(bundlePath);
  return readModuleSource(bundlePath, modules.get(moduleId));
}

test("assembling from 3 patches against a known base produces one bundle reflecting all 3 changes, base_version from apktool.yml", async () => {
  await withTmpDir(async (dir) => {
    const baseFolder = makeBaseFolder(dir, "1.5.12");
    const baseBundlePath = path.join(baseFolder, "assets", "index.android.bundle");

    const patchesDir = path.join(dir, "patches");
    const m2042 = moduleSource(baseBundlePath, 2042);
    const m1186 = moduleSource(baseBundlePath, 1186);
    const m824 = moduleSource(baseBundlePath, 824);

    savePatch(patchesDir, {
      name: "bump-2042",
      locator: { contains: "2.3.0" },
      baseline: m2042,
      modified: m2042.replace("2.3.0", "9.9.9"),
    });
    savePatch(patchesDir, {
      name: "bump-1186",
      locator: { contains: "16.5.0" },
      baseline: m1186,
      modified: m1186.replace("16.5.0", "99.0.0"),
    });
    savePatch(patchesDir, {
      name: "patch-824",
      locator: { contains: "return [];" },
      baseline: m824,
      modified: m824.replace("return [];", "return ['patched'];"),
    });

    const outputPath = path.join(dir, "out", "assembled.bundle");
    const result = await assembleBundle({
      baseFolderPath: baseFolder,
      patchNames: ["bump-2042", "bump-1186", "patch-824"],
      patchesDir,
      outputPath,
      companionFile: COMPANION_FILE,
      buildId: "b000099",
      patchRev: 7,
    });

    assert.equal(result.baseVersion, "1.5.12");
    assert.equal(result.patchRev, 7);
    assert.deepEqual(result.appliedPatches, ["bump-2042", "bump-1186", "patch-824"]);

    assert.match(moduleSource(outputPath, 2042), /9\.9\.9/);
    assert.match(moduleSource(outputPath, 1186), /99\.0\.0/);
    assert.match(moduleSource(outputPath, 824), /patched/);

    const outBytes = fs.readFileSync(outputPath, "utf8");
    assert.match(outBytes, /BUILD_ID = 'b000099'/);
    assert.match(outBytes, /BASE_VERSION = '1\.5\.12'/);
    assert.match(outBytes, /PATCH_REV = 7/);

    // The base folder's own bundle must never be touched.
    const baseStillOriginal = moduleSource(baseBundlePath, 2042);
    assert.match(baseStillOriginal, /2\.3\.0/);
  });
});

test("a patch that fails to locate aborts the assembly with no partial output written", async () => {
  await withTmpDir(async (dir) => {
    const baseFolder = makeBaseFolder(dir, "1.5.12");
    const baseBundlePath = path.join(baseFolder, "assets", "index.android.bundle");
    const patchesDir = path.join(dir, "patches");
    const m2042 = moduleSource(baseBundlePath, 2042);

    savePatch(patchesDir, {
      name: "good-patch",
      locator: { contains: "2.3.0" },
      baseline: m2042,
      modified: m2042.replace("2.3.0", "9.9.9"),
    });
    savePatch(patchesDir, {
      name: "bad-patch",
      locator: { contains: "this-string-does-not-exist-anywhere" },
      baseline: m2042,
      modified: m2042.replace("2.3.0", "8.8.8"),
    });

    const outputPath = path.join(dir, "out", "assembled.bundle");
    await assert.rejects(
      () =>
        assembleBundle({
          baseFolderPath: baseFolder,
          patchNames: ["good-patch", "bad-patch"],
          patchesDir,
          outputPath,
        }),
      /matched no modules/
    );

    assert.equal(fs.existsSync(outputPath), false, "no partial output survives a failed assembly");
  });
});

test("an unknown patch name aborts before the output path is even touched", async () => {
  await withTmpDir(async (dir) => {
    const baseFolder = makeBaseFolder(dir, "1.5.12");
    const patchesDir = path.join(dir, "patches");
    const outputPath = path.join(dir, "out", "assembled.bundle");

    await assert.rejects(
      () =>
        assembleBundle({
          baseFolderPath: baseFolder,
          patchNames: ["nope"],
          patchesDir,
          outputPath,
        }),
      /no such patch/
    );
    assert.equal(fs.existsSync(outputPath), false);
  });
});

test("assembling with zero patches still produces a byte-faithful copy stamped with the companion", async () => {
  await withTmpDir(async (dir) => {
    const baseFolder = makeBaseFolder(dir, "2.0.0");
    const patchesDir = path.join(dir, "patches");
    const outputPath = path.join(dir, "out", "assembled.bundle");

    const result = await assembleBundle({
      baseFolderPath: baseFolder,
      patchNames: [],
      patchesDir,
      outputPath,
      companionFile: COMPANION_FILE,
      buildId: "b000001",
      patchRev: 1,
    });

    assert.equal(result.baseVersion, "2.0.0");
    assert.match(moduleSource(outputPath, 2042), /2\.3\.0/, "no patches applied — original content untouched");
  });
});
