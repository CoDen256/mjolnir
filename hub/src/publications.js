import { query } from "./db.js";

// Task 3.4: all the UI (task 3.5) needs.
export async function listPublications() {
  const { rows } = await query(
    `SELECT build_id, base_version, patch_rev, data_rev, bundle_sha, created_at
     FROM publications
     ORDER BY created_at DESC`
  );
  return rows;
}
