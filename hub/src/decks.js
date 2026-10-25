// The deck allocation table (tun/docs/03-data-model.md, builder/README.md).
// `hub`'s own `decks` row is metadata only (title/pacing knobs); the actual
// bundle deck entry is created once, lazily, by `ensureDeck` (D-P1) the
// first time `builder` mints a card into it.
export const DECK_ALLOCATION = [
  { code: "C20", title: "Substantiv" },
  { code: "C21", title: "Adjektiv" },
  { code: "C22", title: "Verb" },
  { code: "C23", title: "Adverb" },
  { code: "C24", title: "Preposisjon" },
  { code: "C25", title: "Konjunksjon/Subjunksjon" },
  { code: "C26", title: "Expression" }, // type=expression, or any unmapped pos
  { code: "C27", title: "Listening" },
  { code: "C28", title: "Pronunciation" },
  { code: "C29", title: "Grammar" },
];
