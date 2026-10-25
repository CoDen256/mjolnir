import test from "node:test";
import assert from "node:assert/strict";
import { createCard, interleaveOccurrences, upsertCardContent, ensureDeck } from "../../src/injectDeck.js";
import { fixtureDecks, fixtureCards } from "../fixtures/deckCardFixture.js";

test("createCard inserts a new card keyed by an externally-supplied id", () => {
  const cards = fixtureCards();
  const card = createCard(cards, { id: "A01003", deckId: "A01", N: "n", E: "e", D: "Deck A1", X: "x", A: "N" });
  assert.equal(cards.length, 4);
  assert.deepEqual(card, { DECK_ID: "A01", ID: "A01003", N: "n", E: "e", D: "Deck A1", X: "x", A: "N" });
});

test("createCard rejects an id that isn't exactly 6 characters", () => {
  const cards = fixtureCards();
  assert.throws(() => createCard(cards, { id: "A0100", deckId: "A01", N: "n", E: "e", D: "d", X: "x", A: "N" }), /6 characters/);
  assert.throws(() => createCard(cards, { id: "A010033", deckId: "A01", N: "n", E: "e", D: "d", X: "x", A: "N" }), /6 characters/);
});

test("createCard rejects a duplicate id and an invalid audio target", () => {
  const cards = fixtureCards();
  assert.throws(() => createCard(cards, { id: "A01001", deckId: "A01", N: "n", E: "e", D: "d", X: "x", A: "N" }), /already exists/);
  assert.throws(() => createCard(cards, { id: "A01003", deckId: "A01", N: "n", E: "e", D: "d", X: "x", A: "Q" }), /audio target/);
});

test("interleaveOccurrences achieves lag >= 11 for a block large enough to allow it", () => {
  const deck = { Name: "C20", Cards: [] };
  const ids = Array.from({ length: 23 }, (_, i) => `C20${String(i + 1).padStart(3, "0")}`);
  interleaveOccurrences(deck, ids, () => ["N", "E"]);

  assert.equal(deck.Cards.length, ids.length * 2);
  const positionOf = new Map();
  deck.Cards.forEach((ref, i) => {
    const cardId = ref.Card.slice(0, -1);
    const letter = ref.Card.slice(-1);
    if (letter === "N") positionOf.set(cardId, i);
    else {
      const nPos = positionOf.get(cardId);
      assert.ok(nPos !== undefined, `E occurrence for ${cardId} appeared before its N`);
      assert.ok(i - nPos >= 11, `lag for ${cardId} was only ${i - nPos}, want >= 11`);
    }
  });
});

test("interleaveOccurrences on a 6-card two-occurrence block (the hard floor) maximizes achievable lag without crashing", () => {
  const deck = { Name: "C20", Cards: [] };
  const ids = ["C20001", "C20002", "C20003", "C20004", "C20005", "C20006"];
  interleaveOccurrences(deck, ids, () => ["N", "E"]);

  assert.equal(deck.Cards.length, 12);
  // 12 slots, 6 cards, 2 occurrences each: the provably-optimal minimum lag
  // achievable for every card simultaneously is 6 (all N's then all E's, in
  // the same relative order) — 11 is mathematically unreachable here, same
  // reasoning as the hard floor existing at all (one card alone gets lag 0).
  const positionOf = new Map();
  deck.Cards.forEach((ref, i) => {
    const cardId = ref.Card.slice(0, -1);
    const letter = ref.Card.slice(-1);
    if (letter === "N") positionOf.set(cardId, i);
    else {
      const lag = i - positionOf.get(cardId);
      assert.equal(lag, 6);
    }
  });
});

test("interleaveOccurrences handles mixed occurrence sets per card", () => {
  const deck = { Name: "C20", Cards: [] };
  const ids = Array.from({ length: 15 }, (_, i) => `C20${String(i + 1).padStart(3, "0")}`);
  interleaveOccurrences(deck, ids, (id) => (id === ids[0] ? ["A", "E", "N"] : ["N"]));
  assert.equal(deck.Cards.length, 14 + 3);
});

test("interleaveOccurrences rejects an invalid letter", () => {
  const deck = { Name: "C20", Cards: [] };
  assert.throws(() => interleaveOccurrences(deck, ["C20001"], () => ["Q"]), /invalid occurrence letter/);
});

test("upsertCardContent overwrites only content fields, leaving ID/DECK_ID untouched", () => {
  const cards = fixtureCards();
  const updated = upsertCardContent(cards, "A01001", { N: "new N", E: "new E" });
  assert.equal(updated.N, "new N");
  assert.equal(updated.E, "new E");
  assert.equal(updated.X, "<div>X1</div>");
  assert.equal(updated.ID, "A01001");
  assert.equal(updated.DECK_ID, "A01");
});

test("upsertCardContent never touches Cards[] or any other card", () => {
  const decks = fixtureDecks();
  const cards = fixtureCards();
  const before = JSON.parse(JSON.stringify(decks));
  upsertCardContent(cards, "A01001", { N: "edited" });
  assert.deepEqual(decks, before);
  assert.equal(cards.find((c) => c.ID === "A01002").N, "<div>Q2</div>");
});

test("upsertCardContent throws on a nonexistent id", () => {
  const cards = fixtureCards();
  assert.throws(() => upsertCardContent(cards, "ZZZ999", { N: "x" }), /no card with id/);
});

test("upsertCardContent throws on multiple matches rather than silently picking one", () => {
  const cards = fixtureCards();
  cards.push({ ...cards[0] });
  assert.throws(() => upsertCardContent(cards, "A01001", { N: "x" }), /multiple cards/);
});

test("ensureDeck creates a new deck with nextDeckId/NEW_DECK_DEFAULTS, idempotently", () => {
  const decks = fixtureDecks();
  const deck = ensureDeck(decks, { name: "C20", title: "Substantiv" });
  assert.equal(deck.Name, "C20");
  assert.equal(deck.Title, "Substantiv");
  assert.equal(deck.ID, 2);
  assert.deepEqual(deck.Cards, []);
  assert.equal(deck.Enabled, true);
  assert.equal(decks.length, 3);

  const again = ensureDeck(decks, { name: "C20", title: "ignored on repeat" });
  assert.equal(again, deck);
  assert.equal(decks.length, 3);
});

test("ensureDeck accepts overrides for the deck defaults", () => {
  const decks = fixtureDecks();
  const deck = ensureDeck(decks, { name: "C27", title: "Listening", overrides: { MaxInterval: 20 } });
  assert.equal(deck.MaxInterval, 20);
  assert.equal(deck.AutoTickStreak, 1);
});
