// The CI-job pattern (02-services.md): builder writes a row, picks it up,
// writes status back; builder's UI polls (task 4.12). No row at all is
// written for a no-op run (no newly-eligible notes anywhere, D91) — "no build_jobs row
// and no publish" is the spec's own wording for that case.
export async function createBuildJob(pool) {
  const { rows } = await pool.query(
    "INSERT INTO build_jobs (status, started_at) VALUES ('running', now()) RETURNING id"
  );
  return rows[0].id;
}

export async function markSucceeded(pool, id) {
  await pool.query("UPDATE build_jobs SET status = 'succeeded', finished_at = now() WHERE id = $1", [id]);
}

// Surfaced in builder's UI (task 4.12) — most recent jobs first.
export async function recentBuildJobs(pool, limit = 10) {
  const { rows } = await pool.query(
    "SELECT id, status, requested_at, started_at, finished_at, error FROM build_jobs ORDER BY requested_at DESC LIMIT $1",
    [limit]
  );
  return rows;
}

export async function markFailed(pool, id, error) {
  await pool.query("UPDATE build_jobs SET status = 'failed', finished_at = now(), error = $1 WHERE id = $2", [
    String(error && error.message ? error.message : error),
    id,
  ]);
}
