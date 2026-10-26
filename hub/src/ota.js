import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  validateBuildId,
  checkMagicPrefix,
  checkCompanionMatch,
  checkReuse,
  publish,
} from "../../tool/src/otaPublish.js";
import { previousVersions, writePublication } from "./publications.js";
import { query } from "./db.js";

// D-H5/task 6.1: verification reuses exactly the guards `ota-publish.sh`/
// `builder` already enforce — no second implementation. Returns a list of
// `{check, ok, detail}` so the UI can show which of the "6 checks" passed,
// matching the mockup's "✓ 6 checks passed" pill.
export function verifyBundle(bytes, buildId, { dataDir, allowNoCompanion = process.env.ALLOW_NO_COMPANION === "1" } = {}) {
  const checks = [];
  const run = (name, fn) => {
    try {
      fn();
      checks.push({ check: name, ok: true });
    } catch (err) {
      checks.push({ check: name, ok: false, detail: err.message });
    }
  };

  run("size", () => {
    if (bytes.length === 0) throw new Error("empty bundle");
    if (bytes.length > 67108864) throw new Error("bundle > 64 MiB, native rejects it (D48)");
  });
  run("buildId format", () => validateBuildId(buildId));
  run("magic prefix", () => checkMagicPrefix(bytes));
  run("companion buildId match", () => checkCompanionMatch(bytes, buildId, { allowNoCompanion }));
  run("not a byte-different reuse", () => checkReuse(path.join(dataDir, "ota", "bundle", `${buildId}.js`), bytes));
  run("sha256", () => crypto.createHash("sha256").update(bytes).digest("hex"));

  return { ok: checks.every((c) => c.ok), checks };
}

// Task 6.1: the actual publish, after verification has already run. Writes
// hub's own `publications` row (this didn't go through builder's pipeline,
// which writes its own) with the operator-provided label.
export async function submitBundle(bytes, buildId, label, { dataDir, publicBase, allowNoCompanion } = {}) {
  const tmpPath = path.join(dataDir, `.ota-submit-${buildId}-${Date.now()}.tmp`);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(tmpPath, bytes);
  try {
    const result = publish(tmpPath, buildId, label, { dataDir, publicBase, allowNoCompanion });
    const { baseVersion, patchRev, dataRev } = await previousVersions();
    await writePublication({ buildId, baseVersion, patchRev, dataRev, bundleSha: result.sha256, label });
    return result;
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

// Task 6.2: "set as current" — repoints `current.json` at a build whose
// bundle is already on disk, by calling the same `publish()` guards again
// with that build's own id (checkReuse sees identical bytes and skips
// rewriting the bundle file, only `current.json` changes). Not a new code
// path — the guard that makes rollback safe (D26: the device compares
// identity, never ordering) is the same one a fresh publish uses.
export async function setCurrent(buildId, { dataDir, publicBase }) {
  const bundlePath = path.join(dataDir, "ota", "bundle", `${buildId}.js`);
  if (!fs.existsSync(bundlePath)) throw new Error(`no bundle on disk for "${buildId}"`);
  const { rows } = await query("SELECT label FROM publications WHERE build_id = $1", [buildId]);
  if (rows.length === 0) throw new Error(`no such build "${buildId}"`);
  const label = rows[0].label || buildId;
  return publish(bundlePath, buildId, label, { dataDir, publicBase });
}
