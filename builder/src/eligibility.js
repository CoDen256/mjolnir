import { assignDeck } from "./deckAssignment.js";

// A card's own occurrences can't be spaced apart against themselves — 6 is
// the floor below which lag-11 interleave has no room to work with
// (03-data-model.md: "hold ready notes with audio until a deck has ≥6").
export const MINT_FLOOR = 6;

// Splits a pulled+audio-filtered note list into already-minted (by hub's own
// ledger, D44) and newly-eligible, then groups the newly-eligible ones by
// deck assignment. `mintedNoteIds` is a Set of note ids already in
// `minted_notes` — the caller queries this against hub's database so this
// function stays pure/testable without a live connection.
export function partitionByDeck(notes, mintedNoteIds) {
  const alreadyMinted = [];
  const byDeck = new Map();

  for (const note of notes) {
    if (mintedNoteIds.has(note.id)) {
      alreadyMinted.push(note);
      continue;
    }
    const deck = assignDeck(note);
    if (!byDeck.has(deck)) byDeck.set(deck, []);
    byDeck.get(deck).push(note);
  }

  return { alreadyMinted, newlyEligibleByDeck: byDeck };
}

// Decks whose newly-eligible count has crossed the floor this run — these
// are the only ones minted/published; everything else just waits, with no
// separate "held" state (they simply aren't in minted_notes yet).
export function decksCrossingFloor(newlyEligibleByDeck) {
  return [...newlyEligibleByDeck.entries()].filter(([, notes]) => notes.length >= MINT_FLOOR);
}
