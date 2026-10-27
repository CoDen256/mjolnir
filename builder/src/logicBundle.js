import fs from "node:fs";

// D-L4: every run starts fresh from whichever `logic_bundles` row is
// active — read-only, never mutated in place (its file is immutable once
// written, D-L1). Mirrors `hub/src/logicBundles.js`'s `getActive()` using
// builder's own `pool`, the same duplication pattern as `publications.js`/
// `mint.js` (two processes, one database, D-P3).
export async function loadActive(pool) {
  const { rows } = await pool.query("SELECT * FROM logic_bundles WHERE active LIMIT 1");
  if (rows.length === 0) {
    throw new Error(
      "no active logic bundle — submit one and mark it active via hub's OTA console before publishing (D-L1)"
    );
  }
  const row = rows[0];
  return {
    id: row.id,
    baseVersion: row.base_version,
    patchRev: row.patch_rev,
    filePath: row.file_path,
    bundleSha: row.bundle_sha,
    bytes: fs.readFileSync(row.file_path),
  };
}
