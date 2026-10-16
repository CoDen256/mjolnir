import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runExplode } from "../../src/commands/explode.js";
import {
  loadDeckCardModel,
  deckCategory,
  validateReferences,
  nextCardId,
  stripHtml,
} from "../../src/deckData.js";
import {
  buildFixtureBundleSource,
  fixtureDecks,
  fixtureCards,
} from "../fixtures/deckCardFixture.js";

function withFixtureBundle(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-tool-deckdata-"));
  const bundlePath = path.join(dir, "fixture.bundle");
  fs.writeFileSync(bundlePath, buildFixtureBundleSource());
  runExplode(bundlePath);
  try {
    return fn(bundlePath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("locates the deck-catalog and card-content modules by structural shape", () => {
  withFixtureBundle((bundlePath) => {
    const { deckModuleId, cardModuleId, decks, cards } = loadDeckCardModel(bundlePath);
    assert.equal(deckModuleId, "100");
    assert.equal(cardModuleId, "101");
    assert.equal(decks.length, 2);
    assert.equal(cards.length, 3);
  });
});

test("derives a deck's category as the first character of its Name", () => {
  const [deckA, deckB] = fixtureDecks();
  assert.equal(deckCategory(deckA), "A");
  assert.equal(deckCategory(deckB), "B");
});

test("validation passes for referentially consistent decks/cards", () => {
  const { valid, errors } = validateReferences(fixtureDecks(), fixtureCards());
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validation catches a deck referencing a nonexistent card", () => {
  const decks = fixtureDecks();
  decks[0].Cards.push({ Card: "A01999N", P: "N" });
  const { valid, errors } = validateReferences(decks, fixtureCards());
  assert.equal(valid, false);
  assert.match(errors.join("\n"), /A01999/);
});

test("validation catches a card with an unresolved DECK_ID", () => {
  const cards = fixtureCards();
  cards[0].DECK_ID = "Z99";
  const { valid, errors } = validateReferences(fixtureDecks(), cards);
  assert.equal(valid, false);
  assert.match(errors.join("\n"), /Z99/);
});

test("stripHtml removes tags and collapses whitespace", () => {
  assert.equal(
    stripHtml('<div class="center">Does Norwegian have<br><b class="bold">long</b> vowels?</div>'),
    "Does Norwegian have long vowels?"
  );
});

test("stripHtml handles empty/missing input", () => {
  assert.equal(stripHtml(""), "");
  assert.equal(stripHtml(undefined), "");
});

test("nextCardId picks the next sequence number", () => {
  assert.equal(nextCardId("A01", fixtureCards()), "A01003");
});

test("nextCardId handles non-contiguous existing sequence numbers", () => {
  const cards = [
    { ID: "C01001", DECK_ID: "C01" },
    { ID: "C01007", DECK_ID: "C01" },
    { ID: "C01003", DECK_ID: "C01" },
  ];
  assert.equal(nextCardId("C01", cards), "C01008");
});

test("nextCardId starts a fresh deck's sequence at 001", () => {
  assert.equal(nextCardId("D01", fixtureCards()), "D01001");
});
