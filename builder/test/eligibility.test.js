import test from "node:test";
import assert from "node:assert/strict";
import { filterAudioEligible } from "../src/stabburClient.js";
import { partitionByDeck, decksCrossingFloor, MINT_FLOOR } from "../src/eligibility.js";
import { fixtureNote } from "./fixtures/stabburNotes.js";

test("filterAudioEligible drops notes with no audio_blob regardless of type (D74)", () => {
  const notes = [
    fixtureNote({ type: "word", audio_blob: "sha1" }),
    fixtureNote({ type: "pronunciation", audio_blob: null }),
    fixtureNote({ type: "grammar", audio_blob: "sha2" }),
  ];
  const eligible = filterAudioEligible(notes);
  assert.equal(eligible.length, 2);
  assert.ok(eligible.every((n) => n.audio_blob));
});

test("partitionByDeck splits already-minted vs newly-eligible, grouping the latter by deck", () => {
  const notes = [
    fixtureNote({ id: "n1", type: "word", pos: "substantiv" }),
    fixtureNote({ id: "n2", type: "word", pos: "substantiv" }),
    fixtureNote({ id: "n3", type: "word", pos: "verb" }),
  ];
  const { alreadyMinted, newlyEligibleByDeck } = partitionByDeck(notes, new Set(["n1"]));
  assert.deepEqual(alreadyMinted.map((n) => n.id), ["n1"]);
  assert.deepEqual(newlyEligibleByDeck.get("C20").map((n) => n.id), ["n2"]);
  assert.deepEqual(newlyEligibleByDeck.get("C22").map((n) => n.id), ["n3"]);
});

test("decksCrossingFloor: a deck with 4 newly-eligible notes does not cross; 6 does", () => {
  const below = new Map([["C20", Array.from({ length: MINT_FLOOR - 2 }, (_, i) => fixtureNote({ id: `b${i}` }))]]);
  assert.deepEqual(decksCrossingFloor(below), []);

  const atFloor = new Map([["C20", Array.from({ length: MINT_FLOOR }, (_, i) => fixtureNote({ id: `a${i}` }))]]);
  const crossing = decksCrossingFloor(atFloor);
  assert.equal(crossing.length, 1);
  assert.equal(crossing[0][0], "C20");
  assert.equal(crossing[0][1].length, MINT_FLOOR);
});
