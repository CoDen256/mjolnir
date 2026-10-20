import fs from "node:fs";
import path from "node:path";

// Appends a redeployable JS companion (e.g. the boot-ok marker writer) to a
// Metro bundle as new top-level code, AFTER the entry call(s) (`__r(0);`) and
// before the trailing sourcemap comments. It modifies zero existing module
// bytes — the bundle is not IIFE-wrapped and `__r` is a genuine global, so
// appended code runs at top level once the entry module has registered the app
// (docs/findings.md §4). This is deliberately outside the content-locator patch
// system (patchback), which rewrites module factory bodies and cannot add a
// module dependency; the companion needs none, because it reaches native
// modules via `globalThis.expo.modules.<Name>`.

const BUILD_ID_RE = /^[A-Za-z0-9._-]{1,64}$/; // D48 — same charset native validates
const BUILD_ID_PLACEHOLDER = "__MJOLNIR_BUILD_ID__";

// Pure: returns a new Buffer with `companionSource` appended. `name` is used
// for a sentinel comment that makes re-appending the same companion an error.
// If the companion contains the buildId placeholder, `buildId` is required and
// substituted; otherwise `buildId` is ignored.
export function appendCompanion(bundleBuffer, companionSource, { buildId, name } = {}) {
  const sentinel = `/* mjolnir-companion: ${name || "unnamed"} */`;
  const original = bundleBuffer.toString("utf8");

  if (original.includes(sentinel)) {
    throw new Error(`companion '${name}' is already present in this bundle`);
  }

  let source = companionSource;
  if (source.includes(BUILD_ID_PLACEHOLDER)) {
    if (!buildId) {
      throw new Error(`companion '${name}' contains ${BUILD_ID_PLACEHOLDER} but no buildId was given`);
    }
    if (!BUILD_ID_RE.test(buildId)) {
      throw new Error(`buildId must match ${BUILD_ID_RE} (D48) — got '${buildId}'`);
    }
    source = source.split(BUILD_ID_PLACEHOLDER).join(buildId);
  }

  const block = `\n${sentinel}\n${source.trim()}\n`;

  // Insert before the first sourcemap/debugId comment if present, so those stay
  // the final lines; otherwise append at EOF.
  const mapIdx = original.search(/\n\/\/# (sourceMappingURL|debugId)=/);
  let result;
  if (mapIdx !== -1) {
    result = original.slice(0, mapIdx) + block + original.slice(mapIdx);
  } else {
    const sep = original.endsWith("\n") ? "" : "\n";
    result = original + sep + block.replace(/^\n/, "");
  }

  return Buffer.from(result, "utf8");
}

export function runCompanion(bundlePath, outputPath, companionFile, buildId) {
  // Create the output directory if needed — otherwise writeFileSync throws a
  // raw ENOENT stack at the end of the work, after the bundle is built.
  const outDir = path.dirname(outputPath);
  if (outDir && outDir !== "." && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const bundle = fs.readFileSync(bundlePath);
  const companionSource = fs.readFileSync(companionFile, "utf8");
  const name = path.basename(companionFile).replace(/\.js$/, "");

  const out = appendCompanion(bundle, companionSource, { buildId, name });
  fs.writeFileSync(outputPath, out);

  console.log(`appended companion '${name}' → ${outputPath}`);
  if (companionSource.includes(BUILD_ID_PLACEHOLDER)) {
    console.log(`  buildId  ${buildId}`);
    console.log(`  NOTE: pass the SAME buildId to tun/bin/ota-publish.sh so the`);
    console.log(`        boot-ok marker pairs with bundle-${buildId}.js (D52).`);
  }
}
