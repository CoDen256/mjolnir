// D-L3: each card's last-known-good rendered N/E/X/A, written at mint and
// refreshed on every regeneration while the source note is still returned
// by stabbur's pull — the newly-minted loop and the already-minted regen
// loop in `pipeline.js` are the only two places this is ever called from,
// mirroring exactly where content is already projected today. Pool-based,
// like `mint.js`/`publications.js` — builder's own copy of the same table
// hub/src/cardContent.js also reads/writes, same duplication pattern as
// publications.js (two processes, one database, D-P3).
export async function upsert(pool, cardId, { N, E, X, A }) {
  await pool.query(
    `INSERT INTO card_content (card_id, n, e, x, a, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (card_id) DO UPDATE SET n = $2, e = $3, x = $4, a = $5, updated_at = now()`,
    [cardId, N ?? null, E ?? null, X ?? null, A]
  );
}

// Keyed by card id, for `replay.js` to reconstruct every already-shipped
// card's content without touching the (removed) persistent bundle file.
export async function getAll(pool) {
  const { rows } = await pool.query("SELECT card_id, n, e, x, a FROM card_content");
  return new Map(rows.map((r) => [r.card_id, { N: r.n, E: r.e, X: r.x, A: r.a }]));
}
