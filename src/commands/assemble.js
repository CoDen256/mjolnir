import fs from "node:fs";
import path from "node:path";
import { loadIndex } from "../parseBundle.js";
import { loadPatch, applyPatch, computePatchedModuleSource } from "../patches.js";
import { loadPatchbackPair } from "../patchbackPairs.js";
import { reassembleBundle } from "../reassemble.js";
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
// D110/D111: a bundle's patch-like inputs are three genuinely different
// operations, not degrees of the same thing. `patchNames` (via
// `src/patches.js`, JSON-store) and `patchbackPairNames` (via
// `src/patchbackPairs.js`, raw `<id>-name.baseline.js`/`.edited.js` file
// pairs) both REPLACE an existing module's factory body in place, using the
// identical reconciliation algorithm (`computePatchedModuleSource`) — they
// differ only in how the target module is found (content locator vs. a
// module id named in the pair's own filename) and in storage shape (one
// JSON file with metadata vs. two plain source files). `companionFiles`
// APPEND brand-new top-level code after the bundle's entry call, touching
// zero existing module bytes (`src/commands/companion.js`'s mechanism —
// what `boot-ok-companion.js`/`config-rotate.js`/`ota-debug-report.js` all
// are, per `patches/README.md`). Assembly applies every JSON-store patch,
// then every patch-back pair, then appends every companion — all three in
// their own given order; only replace-vs-replace order can matter (two
// patches touching the same module), so patches and pairs are applied in
// argument order with no interleaving between the two lists.
export async function assembleBundle({
  baseFolderPath,
  patchNames,
  patchesDir,
  patchbackPairNames,
  patchbackDir,
  outputPath,
  companionFiles,
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
  // Same up-front resolution for patch-back pairs: an unknown name, or one
  // whose filename carries no leading module id, must abort before any
  // write happens too.
  const resolvedPatchbackDir = patchbackDir || (patchesDir ? path.join(patchesDir, "js") : undefined);
  const patchbackPairs = (patchbackPairNames || []).map((name) => loadPatchbackPair(resolvedPatchbackDir, name));
  // Same up-front resolution for companions: a missing file must abort
  // before any write happens, exactly like a missing patch name.
  const companionSources = (companionFiles || []).map((file) => ({
    name: path.basename(file).replace(/\.js$/, ""),
    source: fs.readFileSync(file, "utf8"),
  }));

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

    for (const pair of patchbackPairs) {
      const cache = loadIndex(outputPath);
      if (!cache.modules[pair.moduleId]) {
        throw new Error(`patch-back pair "${pair.name}": module ${pair.moduleId} not found in this bundle`);
      }
      const patch = {
        baseline: fs.readFileSync(pair.baselinePath, "utf8"),
        modified: fs.readFileSync(pair.editedPath, "utf8"),
      };
      const newSource = await computePatchedModuleSource({
        bundlePath: outputPath,
        cache,
        targetModuleId: pair.moduleId,
        patch,
      });
      const outBuffer = reassembleBundle(outputPath, cache.modules, [{ moduleId: pair.moduleId, newSource }]);
      fs.writeFileSync(outputPath, outBuffer);
    }

    for (const { name, source } of companionSources) {
      const bundle = fs.readFileSync(outputPath);
      const out = appendCompanion(bundle, source, { buildId, baseVersion, patchRev, name });
      fs.writeFileSync(outputPath, out);
    }
  } catch (err) {
    // No partial output survives a failed assembly (task 5.3) — the base
    // itself was never touched (it was only ever read, to seed the copy).
    fs.rmSync(outputPath, { force: true });
    throw err;
  }

  return {
    outputPath,
    baseVersion,
    patchRev,
    appliedPatches: patchNames || [],
    appliedPatchbackPairs: patchbackPairs.map((p) => p.name),
    appliedCompanions: companionSources.map((c) => c.name),
  };
}
