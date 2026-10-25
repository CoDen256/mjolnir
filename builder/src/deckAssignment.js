// Deck allocation table (tun/docs/03-data-model.md, builder/README.md). Only
// `type=word` notes are assigned by `pos` — every other type goes straight to
// its own fixed deck regardless of `pos` (the spec's "any note whose pos does
// not match the word-deck mapping" is scoped to word notes in both
// 03-data-model.md's table and builder/README.md's; forcing e.g. a
// type=grammar note into C26 based on an irrelevant `pos` would contradict
// both and leave grammar/listening/pronunciation decks always empty).
const WORD_POS_DECK = {
  substantiv: "C20",
  adjektiv: "C21",
  verb: "C22",
  adverb: "C23",
  preposisjon: "C24",
  konjunksjon: "C25",
  subjunksjon: "C25",
};

const TYPE_DECK = {
  expression: "C26",
  listening: "C27",
  pronunciation: "C28",
  grammar: "C29",
};

const EXPRESSION_CATCHALL_DECK = "C26";

export function assignDeck(note) {
  if (note.type === "word") {
    return WORD_POS_DECK[note.pos] || EXPRESSION_CATCHALL_DECK;
  }
  return TYPE_DECK[note.type] || EXPRESSION_CATCHALL_DECK;
}
