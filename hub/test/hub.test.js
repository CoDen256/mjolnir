import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { migrate } from "../src/migrate.js";
import { getPool, closePool } from "../src/db.js";
import { DECK_ALLOCATION } from "../src/decks.js";
import { listPublications, writePublication, updateLabel, deleteBuild } from "../src/publications.js";
import { cardsList } from "../src/cards.js";
import { createServer } from "../src/server.js";

// Needs a real postgres (separate logical DB per service, 02-services.md) —
// point DATABASE_URL at a throwaway database to run these. Skipped, not
// failed, when none is configured, since this is a solo-dev repo with no CI.
const DATABASE_URL = process.env.DATABASE_URL;
const describe = DATABASE_URL ? test : test.skip;

describe("hub: migrate, seed, publications, cards, ota, server", async (t) => {
  const pool = getPool();
  await migrate();
  await pool.query(
    "TRUNCATE card_slots, publications, build_jobs, minted_notes, decks, pending_occurrences, occurrence_shipments, job_logs, card_content, logic_bundles CASCADE"
  );

  process.env.ALLOW_NO_COMPANION = "1";
  process.env.ALLOW_HTTP = "1";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mjolnir-hub-"));
  const dataDir = path.join(tmpDir, "data");
  const config = { dataDir, publicBase: "http://localhost:8080", stabburUiBase: "http://localhost:5056" };

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

  await t.test("cards-browser: a card with one shipped + one pending side renders both independently", async () => {
    // D-L3: content now lives in `card_content` — durable DB state, not the
    // (removed) persistent bundle file.
    await pool.query(
      "INSERT INTO card_content (card_id, n, e, x, a) VALUES ('C20001', '<div>hus</div>', '<div>house</div>', NULL, 'N')"
    );
    await pool.query("INSERT INTO occurrence_shipments (card_id, letter, build_id) VALUES ('C20001', 'A', 'b2')");
    await pool.query("INSERT INTO pending_occurrences (deck_code, card_id, letter, remaining) VALUES ('C20', 'C20001', 'E', 3)");

    const cards = await cardsList(pool, {});
    const c20001 = cards.find((c) => c.id === "C20001");
    assert.ok(c20001);
    assert.equal(c20001.N.includes("hus"), true);
    assert.deepEqual(
      c20001.sides.sort((a, b) => a.letter.localeCompare(b.letter)),
      [
        { letter: "A", buildId: "b2", status: "shipped" },
        { letter: "E", remaining: 3, status: "pending" },
      ]
    );
  });

  await t.test("cards-browser: filtering by 'a side pending' matches only such cards", async () => {
    await pool.query(`INSERT INTO card_slots (id, deck_code, card_no, note_id) VALUES ('C20002', 'C20', 2, 'n2')`);
    await pool.query("INSERT INTO occurrence_shipments (card_id, letter, build_id) VALUES ('C20002', 'A', 'b2')");
    await pool.query("INSERT INTO occurrence_shipments (card_id, letter, build_id) VALUES ('C20002', 'E', 'b2')");

    const pending = await cardsList(pool, { statusFilter: "pending" });
    assert.deepEqual(pending.map((c) => c.id).sort(), ["C20001"]);

    const shipped = await cardsList(pool, { statusFilter: "shipped" });
    assert.deepEqual(shipped.map((c) => c.id).sort(), ["C20002"]);
  });

  await t.test("cards-browser: stabbur being unreachable degrades only the note link, not the list", async () => {
    const cards = await cardsList(pool, {});
    assert.ok(cards.length > 0, "the list itself never depends on a stabbur fetch — nothing here calls stabbur at all");
  });

  await t.test("ota console: verifying (force-publish path) rejects a bad magic prefix with the same message the CLI uses", async () => {
    const { verifyBundle } = await import("../src/ota.js");
    const result = verifyBundle(Buffer.from("not a bundle"), "b900001", { dataDir });
    assert.equal(result.ok, false);
    const magicCheck = result.checks.find((c) => c.check === "magic prefix");
    assert.equal(magicCheck.ok, false);
    assert.match(magicCheck.detail, /does not start with/);
  });

  await t.test("ota console: verifying (default submit path) needs no buildId — just size and magic prefix", async () => {
    const { verifyLogicBundleBytes } = await import("../src/ota.js");
    const bad = verifyLogicBundleBytes(Buffer.from("not a bundle"));
    assert.equal(bad.ok, false);
    const good = verifyLogicBundleBytes(Buffer.from("var __BUNDLE_START_TIME__=1;\nhello"));
    assert.equal(good.ok, true);
  });

  let firstLogicBundleId;
  await t.test("ota console: submitting a bundle with baked constants creates a logic_bundles row and never touches current.json (D-L1/D-L5)", async () => {
    const { submitBundle } = await import("../src/ota.js");
    const bytes = Buffer.from(
      "var __BUNDLE_START_TIME__=1;\nvar BASE_VERSION = '1.5.12';\nvar PATCH_REV = 1;\nhello"
    );
    const row = await submitBundle(bytes, { label: "test logic bundle", dataDir });
    firstLogicBundleId = row.id;
    assert.equal(row.base_version, "1.5.12");
    assert.equal(row.patch_rev, 1);
    assert.equal(row.active, false, "submitting alone never activates");

    assert.equal(fs.existsSync(path.join(dataDir, "ota", "current.json")), false, "submit must not touch current.json");
  });

  await t.test("ota console: submitting a bundle with no baked constants requires a manual base_version/patch_rev", async () => {
    const { submitBundle } = await import("../src/ota.js");
    const bytes = Buffer.from("var __BUNDLE_START_TIME__=1;\nno baked constants here");
    await assert.rejects(() => submitBundle(bytes, { dataDir }), /no baked base_version/);

    const row = await submitBundle(bytes, { dataDir, baseVersion: "1.6.0", patchRev: 5 });
    assert.equal(row.base_version, "1.6.0");
    assert.equal(row.patch_rev, 5);
  });

  await t.test("ota console: activating a logic bundle does not publish anything on its own", async () => {
    const { activateLogicBundle } = await import("../src/ota.js");
    await activateLogicBundle(firstLogicBundleId);
    const { rows } = await pool.query("SELECT active FROM logic_bundles WHERE id = $1", [firstLogicBundleId]);
    assert.equal(rows[0].active, true);
    assert.equal(fs.existsSync(path.join(dataDir, "ota", "current.json")), false, "activating must not publish");
  });

  await t.test("ota console: force-publish changes current.json without touching logic_bundles.active, and still records provenance", async () => {
    const { forcePublish, setCurrent } = await import("../src/ota.js");
    const bytes = Buffer.from("var __BUNDLE_START_TIME__=1;\nvar BASE_VERSION = '1.5.12';\nvar PATCH_REV = 9;\nforce-published");
    const result = await forcePublish(bytes, "b900002", "test label", { dataDir, publicBase: config.publicBase });
    assert.equal(result.buildId, "b900002");

    const current = JSON.parse(fs.readFileSync(path.join(dataDir, "ota", "current.json"), "utf8"));
    assert.equal(current.buildId, "b900002");

    const pubs = await listPublications();
    const row = pubs.find((p) => p.build_id === "b900002");
    assert.ok(row);
    assert.equal(row.label, "test label");

    // The force-published bundle left an auditable (inactive) logic_bundles
    // row, but the previously-activated one is still the active one.
    const { rows: activeRows } = await pool.query("SELECT id FROM logic_bundles WHERE active = TRUE");
    assert.equal(activeRows.length, 1);
    assert.equal(activeRows[0].id, firstLogicBundleId, "force-publish must not touch logic_bundles.active");
    const { rows: forcedRow } = await pool.query("SELECT active, patch_rev FROM logic_bundles WHERE bundle_sha = $1", [
      result.sha256,
    ]);
    assert.equal(forcedRow[0].active, false);
    assert.equal(forcedRow[0].patch_rev, 9);

    // set-as-current re-publishes the same on-disk bytes under the same id —
    // current.json updates, the bundle file itself is untouched (reused).
    await setCurrent("b900002", { dataDir, publicBase: config.publicBase });
    const afterSetCurrent = JSON.parse(fs.readFileSync(path.join(dataDir, "ota", "current.json"), "utf8"));
    assert.equal(afterSetCurrent.buildId, "b900002");
  });

  await t.test("ota console: edit label and delete", async () => {
    await updateLabel("b900002", "renamed");
    const pubs = await listPublications();
    assert.equal(pubs.find((p) => p.build_id === "b900002").label, "renamed");

    // Deleting a build with no shipments and not the current one succeeds...
    await pool.query(
      `INSERT INTO publications (build_id, base_version, patch_rev, data_rev, bundle_sha) VALUES ('bdeleteme', '0', 0, 0, 'sha-x')`
    );
    await deleteBuild("bdeleteme", { dataDir });
    assert.equal((await listPublications()).some((p) => p.build_id === "bdeleteme"), false);

    // ...but a build that shipped an occurrence is protected.
    await assert.rejects(() => deleteBuild("b2", { dataDir }), /shipped/);
  });

  await t.test("the HTTP server serves the read API, history, cards, and ota pages", async () => {
    const server = createServer(pool, config);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      const apiRes = await fetch(`http://localhost:${port}/mjolnir/api/publications`);
      assert.equal(apiRes.status, 200);

      const pageRes = await fetch(`http://localhost:${port}/mjolnir/`);
      assert.equal(pageRes.status, 200);
      const html = await pageRes.text();
      assert.match(html, /publish history/i);

      const cardsRes = await fetch(`http://localhost:${port}/mjolnir/cards`);
      assert.equal(cardsRes.status, 200);
      assert.match(await cardsRes.text(), /Cards/);

      const otaRes = await fetch(`http://localhost:${port}/mjolnir/ota`);
      assert.equal(otaRes.status, 200);
      assert.match(await otaRes.text(), /Submit bundle/);

      const missingRes = await fetch(`http://localhost:${port}/nope`);
      assert.equal(missingRes.status, 404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await t.test("D-H6: with an operator token configured, pages require it — via cookie (page loads) or bearer header (API)", async () => {
    const authedServer = createServer(pool, { ...config, operatorAuthToken: "secret123" });
    await new Promise((resolve) => authedServer.listen(0, resolve));
    const port = authedServer.address().port;
    try {
      const noAuth = await fetch(`http://localhost:${port}/mjolnir/`, { redirect: "manual" });
      assert.equal(noAuth.status, 302);
      assert.match(noAuth.headers.get("location"), /^\/mjolnir\/login/);

      const apiNoAuth = await fetch(`http://localhost:${port}/mjolnir/api/publications`);
      assert.equal(apiNoAuth.status, 401);

      const apiWithHeader = await fetch(`http://localhost:${port}/mjolnir/api/publications`, {
        headers: { Authorization: "Bearer secret123" },
      });
      assert.equal(apiWithHeader.status, 200);

      const loginPage = await fetch(`http://localhost:${port}/mjolnir/login`);
      assert.equal(loginPage.status, 200);
      assert.match(await loginPage.text(), /Operator sign in/);

      const wrongLogin = await fetch(`http://localhost:${port}/mjolnir/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "token=wrong",
      });
      assert.equal(wrongLogin.status, 401);

      const rightLogin = await fetch(`http://localhost:${port}/mjolnir/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "token=secret123",
        redirect: "manual",
      });
      assert.equal(rightLogin.status, 302);
      const cookie = rightLogin.headers.get("set-cookie");
      assert.match(cookie, /operator_token=secret123/);

      const pageWithCookie = await fetch(`http://localhost:${port}/mjolnir/`, { headers: { Cookie: cookie } });
      assert.equal(pageWithCookie.status, 200);
    } finally {
      await new Promise((resolve) => authedServer.close(resolve));
    }
  });

  t.after(async () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await closePool();
  });
});
