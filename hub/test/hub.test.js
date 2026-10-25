import test from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../src/migrate.js";
import { getPool, closePool } from "../src/db.js";
import { DECK_ALLOCATION } from "../src/decks.js";
import { listPublications } from "../src/publications.js";
import { createServer } from "../src/server.js";

// Needs a real postgres (separate logical DB per service, 02-services.md) —
// point DATABASE_URL at a throwaway database to run these. Skipped, not
// failed, when none is configured, since this is a solo-dev repo with no CI.
const DATABASE_URL = process.env.DATABASE_URL;
const describe = DATABASE_URL ? test : test.skip;

describe("hub: migrate, seed, publications, server", async (t) => {
  const pool = getPool();
  await migrate();
  await pool.query("TRUNCATE card_slots, publications, build_jobs, minted_notes, decks CASCADE");

  await t.test("seeding decks is idempotent and matches the allocation table", async () => {
    for (const { code, title } of DECK_ALLOCATION) {
      await pool.query(
        `INSERT INTO decks (code, title, category) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
        [code, title, code[0]]
      );
    }
    const { rows } = await pool.query("SELECT code FROM decks ORDER BY code");
    assert.deepEqual(rows.map((r) => r.code), DECK_ALLOCATION.map((d) => d.code).sort());

    // Re-seeding must not clobber an operator-edited pacing knob.
    await pool.query("UPDATE decks SET max_interval = 99 WHERE code = 'C20'");
    for (const { code, title } of DECK_ALLOCATION) {
      await pool.query(
        `INSERT INTO decks (code, title, category) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
        [code, title, code[0]]
      );
    }
    const { rows: after } = await pool.query("SELECT max_interval FROM decks WHERE code = 'C20'");
    assert.equal(after[0].max_interval, 99);
  });

  await t.test("card_slots enforces a 6-character id and unique (deck_code, card_no)", async () => {
    await assert.rejects(() => pool.query(`INSERT INTO card_slots (id, deck_code, card_no, note_id) VALUES ('short', 'C20', 1, 'n1')`));
    await pool.query(`INSERT INTO card_slots (id, deck_code, card_no, note_id) VALUES ('C20001', 'C20', 1, 'n1')`);
    await assert.rejects(() => pool.query(`INSERT INTO card_slots (id, deck_code, card_no, note_id) VALUES ('C20002', 'C20', 1, 'n2')`));
  });

  await t.test("minted_notes references an existing card_slot", async () => {
    await assert.rejects(() => pool.query(`INSERT INTO minted_notes (note_id, card_slot_id) VALUES ('n9', 'ZZZZZZ')`));
    await pool.query(`INSERT INTO minted_notes (note_id, card_slot_id) VALUES ('n1', 'C20001')`);
  });

  await t.test("listPublications orders by created_at descending", async () => {
    await pool.query(
      `INSERT INTO publications (build_id, base_version, patch_rev, data_rev, bundle_sha, created_at) VALUES
       ('b1', '6.0.3', 0, 1, 'sha1', now() - interval '1 day'),
       ('b2', '6.0.3', 0, 2, 'sha2', now())`
    );
    const rows = await listPublications();
    assert.deepEqual(rows.map((r) => r.build_id), ["b2", "b1"]);
  });

  await t.test("the HTTP server serves the read API and the history page", async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      const apiRes = await fetch(`http://localhost:${port}/mjolnir/api/publications`);
      assert.equal(apiRes.status, 200);
      const body = await apiRes.json();
      assert.equal(body.length, 2);

      const pageRes = await fetch(`http://localhost:${port}/mjolnir/`);
      assert.equal(pageRes.status, 200);
      const html = await pageRes.text();
      assert.match(html, /b2/);
      assert.match(html, /publish history/i);

      const missingRes = await fetch(`http://localhost:${port}/nope`);
      assert.equal(missingRes.status, 404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await closePool();
});
