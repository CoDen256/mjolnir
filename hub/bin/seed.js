#!/usr/bin/env node
import { getPool, closePool } from "../src/db.js";
import { DECK_ALLOCATION } from "../src/decks.js";

// Seeds hub's own `decks` table with C20-C29 (task 3.3) — enabled from the
// start, `Cards: []` until builder's first run for each (that part lives in
// the bundle itself, via `ensureDeck`, not here). Idempotent: ON CONFLICT
// DO NOTHING, since re-running this must never clobber an operator's
// hand-tuned pacing knobs for a deck that already exists.
async function seed() {
  const pool = getPool();
  for (const { code, title } of DECK_ALLOCATION) {
    await pool.query(
      `INSERT INTO decks (code, title, category) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING`,
      [code, title, code[0]]
    );
  }
}

seed()
  .then(() => {
    console.log(`seeded ${DECK_ALLOCATION.length} decks (C20-C29)`);
    return closePool();
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
