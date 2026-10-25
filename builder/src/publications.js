// D77/D-P3: base_version/patch_rev are operator-set and copied forward;
// data_rev is bumped by builder automatically on every publish that runs —
// builder only ever publishes because there's new/changed content, so every
// publish is by definition a new data_rev.
export async function previousVersions(pool) {
  const { rows } = await pool.query(
    "SELECT base_version, patch_rev, data_rev FROM publications ORDER BY created_at DESC LIMIT 1"
  );
  if (rows.length === 0) return { baseVersion: "0", patchRev: 0, dataRev: 0 };
  return { baseVersion: rows[0].base_version, patchRev: rows[0].patch_rev, dataRev: rows[0].data_rev };
}

export async function writePublication(pool, { buildId, baseVersion, patchRev, dataRev, bundleSha }) {
  await pool.query(
    `INSERT INTO publications (build_id, base_version, patch_rev, data_rev, bundle_sha)
     VALUES ($1, $2, $3, $4, $5)`,
    [buildId, baseVersion, patchRev, dataRev, bundleSha]
  );
}
