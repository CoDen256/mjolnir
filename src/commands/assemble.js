import fs from "node:fs";
import path from "node:path";
import { loadIndex } from "../parseBundle.js";
import { loadPatch, applyPatch } from "../patches.js";
import { readBaseVersion } from "../apktoolYml.js";
import { appendCompanion } from "./companion.js";

// Where a decoded base APK folder keeps its Metro bundle — confirmed against
// `base/smali.mjolnir.merged/assets/index.android.bundle` (this repo's own
// base folder).
export const BASE_BUNDLE_RELATIVE_PATH = path.join("assets", "index.android.bundle");

// D-L7: extends the existing patch-apply flow (patchback's locate-by-content
// algorithm, unchanged, via `src/patches.js`) to multiple stored patches
// applied in one pass against a chosen base, never mutating the base itself.
// `outputPath` starts as a byte-identical copy of the base's own bundle;
// each patch is applied against that copy in order, re-deriving the module
// index fresh between patches (`loadIndex` auto-rebuilds on a stale
// size/mtime, same as every other `src/patches.js` caller) since each write
// shifts every later module's byte offsets. `base_version` is read from the
// base folder's own `apktool.yml` (confirmed not present anywhere in the
// bundle's own bytes, D-L7); `patch_rev` is the caller's responsibility to
// supply (builder-logic-bundle-store's single global counter lives in hub's
// `logic_bundles` table — this module has no database access of its own).
export async function assembleBundle({
  baseFolderPath,
  patchNames,
  patchesDir,
  outputPath,
  companionFile,
  buildId,
  patchRev,
}) {
  const baseBundlePath = path.join(baseFolderPath, BASE_BUNDLE_RELATIVE_PATH);
  if (!fs.existsSync(baseBundlePath)) {
    throw new Error(
      `no bundle found at ${baseBundlePath} — is "${baseFolderPath}" a decoded base APK folder?`
    );
  }
  const baseVersion = readBaseVersion(baseFolderPath);

  // Resolve every patch up front: "a patch that fails to locate aborts the
  // assembly with no partial output written" (task 5.3) — a patch name that
  // doesn't even exist on disk must fail before the output path is touched
  // at all, not partway through applying earlier patches.
  const patches = (patchNames || []).map((name) => loadPatch(patchesDir, name));

  const outDir = path.dirname(outputPath);
  if (outDir && outDir !== ".") fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(baseBundlePath, outputPath);

  try {
    for (const patch of patches) {
      // A patch's own locator may still fail to resolve unambiguously
      // against this particular base (D-L7's "fails to locate" case) —
      // `applyPatch`/`locatePatchTarget` already throw a clear error for
      // that; propagating it here (instead of swallowing) is what makes the
      // catch below discard the partial output rather than leaving it.
      const cache = loadIndex(outputPath);
      await applyPatch({ bundlePath: outputPath, cache, patch });
    }

    if (companionFile) {
      const bundle = fs.readFileSync(outputPath);
      const companionSource = fs.readFileSync(companionFile, "utf8");
      const name = path.basename(companionFile).replace(/\.js$/, "");
      const out = appendCompanion(bundle, companionSource, { buildId, baseVersion, patchRev, name });
      fs.writeFileSync(outputPath, out);
    }
  } catch (err) {
    // No partial output survives a failed assembly (task 5.3) — the base
    // itself was never touched (it was only ever read, to seed the copy).
    fs.rmSync(outputPath, { force: true });
    throw err;
  }

  return { outputPath, baseVersion, patchRev, appliedPatches: patchNames || [] };
}
