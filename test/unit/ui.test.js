import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runExplode } from "../../src/commands/explode.js";
import { loadDeckCardModel } from "../../src/deckData.js";
import { createServer } from "../../src/commands/ui.js";
import { buildFixtureBundleSource } from "../fixtures/deckCardFixture.js";

function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-tool-ui-"));
  const bundlePath = path.join(dir, "fixture.bundle");
  fs.writeFileSync(bundlePath, buildFixtureBundleSource());
  runExplode(bundlePath);

  const server = createServer(bundlePath);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", async () => {
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;
      try {
        await fn({ baseUrl, bundlePath });
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
}

async function api(baseUrl, method, p, body) {
  const res = await fetch(`${baseUrl}${p}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

test("GET /api/decks lists decks grouped by category (via category field)", async () => {
  await withServer(async ({ baseUrl }) => {
    const { status, data } = await api(baseUrl, "GET", "/api/decks");
    assert.equal(status, 200);
    assert.equal(data.length, 2);
    const a01 = data.find((d) => d.Name === "A01");
    assert.equal(a01.category, "A");
    assert.equal(a01.cardCount, 2);
  });
});

test("GET /api/decks/:name returns deck detail with resolved cards", async () => {
  await withServer(async ({ baseUrl }) => {
    const { status, data } = await api(baseUrl, "GET", "/api/decks/A01");
    assert.equal(status, 200);
    assert.equal(data.cards.length, 2);
    for (const card of data.cards) {
      assert.ok(card.preview, "each card should have a plain-text preview");
      assert.doesNotMatch(card.preview, /<[^>]+>/);
    }
    assert.equal(data.cards.find((c) => c.ID === "A01001").preview, "Q1");
    assert.deepEqual(data.cards.find((c) => c.ID === "A01001").directions, ["N"]);
  });
});

test("GET /api/decks/:name reports every direction letter a card is referenced with in that deck", async () => {
  await withServer(async ({ baseUrl }) => {
    const { data } = await api(baseUrl, "GET", "/api/decks/B01");
    assert.deepEqual(data.cards.find((c) => c.ID === "B01001").directions, ["N", "Y"]);
  });
});

test("POST /api/cards creates a card, appends an N-direction deck reference, and persists it", async () => {
  await withServer(async ({ baseUrl, bundlePath }) => {
    const { status, data } = await api(baseUrl, "POST", "/api/cards", { DECK_ID: "A01" });
    assert.equal(status, 201);
    assert.equal(data.ID, "A01003");
    assert.equal(data.N, '<div class="center">...</div>');

    const model = loadDeckCardModel(bundlePath);
    assert.ok(model.cards.some((c) => c.ID === "A01003"));
    const deck = model.decks.find((d) => d.Name === "A01");
    assert.deepEqual(
      deck.Cards.find((ref) => ref.Card === "A01003N"),
      { Card: "A01003N", P: "N" }
    );
  });
});

test("adding a card to a dual-direction deck only adds an N-direction reference", async () => {
  await withServer(async ({ baseUrl, bundlePath }) => {
    const { status, data } = await api(baseUrl, "POST", "/api/cards", { DECK_ID: "B01" });
    assert.equal(status, 201);

    const model = loadDeckCardModel(bundlePath);
    const deck = model.decks.find((d) => d.Name === "B01");
    const refsForNewCard = deck.Cards.filter((ref) => ref.Card.startsWith(data.ID));
    assert.equal(refsForNewCard.length, 1);
    assert.equal(refsForNewCard[0].P, "N");
  });
});

test("PUT /api/cards/:id edits a card and the edit is reflected on reload", async () => {
  await withServer(async ({ baseUrl, bundlePath }) => {
    const { status, data } = await api(baseUrl, "PUT", "/api/cards/A01001", { N: "<div>updated</div>" });
    assert.equal(status, 200);
    assert.equal(data.N, "<div>updated</div>");

    const model = loadDeckCardModel(bundlePath);
    assert.equal(model.cards.find((c) => c.ID === "A01001").N, "<div>updated</div>");
  });
});

test("DELETE /api/cards/:id removes the card and its deck references", async () => {
  await withServer(async ({ baseUrl, bundlePath }) => {
    const { status } = await api(baseUrl, "DELETE", "/api/cards/A01001");
    assert.equal(status, 200);

    const model = loadDeckCardModel(bundlePath);
    assert.ok(!model.cards.some((c) => c.ID === "A01001"));
    const deck = model.decks.find((d) => d.Name === "A01");
    assert.ok(!deck.Cards.some((ref) => ref.Card.startsWith("A01001")));
  });
});

test("an edit that would orphan a reference is rejected and the bundle is left unchanged", async () => {
  await withServer(async ({ baseUrl, bundlePath }) => {
    const before = fs.readFileSync(bundlePath);

    // The UI never offers to change a card's DECK_ID, but the PUT route
    // accepts it (only `ID` is protected) — pointing it at a nonexistent
    // deck is exactly the kind of direct-API-bypass edit that should be
    // caught by saveDeckCardModel's referential-integrity check.
    const { status, data } = await api(baseUrl, "PUT", "/api/cards/A01001", {
      DECK_ID: "NO_SUCH_DECK",
    });
    assert.equal(status, 400);
    assert.match(data.error, /NO_SUCH_DECK/);

    const after = fs.readFileSync(bundlePath);
    assert.ok(before.equals(after));

    const model = loadDeckCardModel(bundlePath);
    assert.equal(model.cards.find((c) => c.ID === "A01001").DECK_ID, "A01");
  });
});

test("POST /api/decks creates a new empty deck", async () => {
  await withServer(async ({ baseUrl, bundlePath }) => {
    const { status, data } = await api(baseUrl, "POST", "/api/decks", { Name: "C01", Title: "Deck C1" });
    assert.equal(status, 201);
    assert.deepEqual(data.Cards, []);

    const model = loadDeckCardModel(bundlePath);
    assert.ok(model.decks.some((d) => d.Name === "C01"));
  });
});
