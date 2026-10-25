import test from "node:test";
import assert from "node:assert/strict";
import { assignDeck } from "../src/deckAssignment.js";
import { fixtureNote } from "./fixtures/stabburNotes.js";

test("assigns type=word notes by pos per the allocation table", () => {
  const cases = {
    substantiv: "C20",
    adjektiv: "C21",
    verb: "C22",
    adverb: "C23",
    preposisjon: "C24",
    konjunksjon: "C25",
    subjunksjon: "C25",
  };
  for (const [pos, deck] of Object.entries(cases)) {
    assert.equal(assignDeck(fixtureNote({ type: "word", pos })), deck);
  }
});

test("an unmapped pos on a word note falls through to C26", () => {
  assert.equal(assignDeck(fixtureNote({ type: "word", pos: "pronomen" })), "C26");
  assert.equal(assignDeck(fixtureNote({ type: "word", pos: "interjeksjon" })), "C26");
});

test("non-word types go to their own fixed deck regardless of pos", () => {
  assert.equal(assignDeck(fixtureNote({ type: "expression", pos: null })), "C26");
  assert.equal(assignDeck(fixtureNote({ type: "listening", pos: null })), "C27");
  assert.equal(assignDeck(fixtureNote({ type: "pronunciation", pos: null })), "C28");
  assert.equal(assignDeck(fixtureNote({ type: "grammar", pos: null })), "C29");
});
