import { query } from "./db.js";

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

// Task 3.3. "Fixed catalog data" (13-operator-console-ux.md) — safe to
// auto-run on every container boot, unlike sample/test content, because
// idempotent "make sure these 10 rows exist" is always harmless to re-run.
// ON CONFLICT DO NOTHING so a re-run never clobbers an operator-edited
// pacing knob for a deck that already exists.
export async function seedDecks() {
  for (const { code, title } of DECK_ALLOCATION) {
    await query(
      `INSERT INTO decks (code, title, category) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING`,
      [code, title, code[0]]
    );
  }
  return DECK_ALLOCATION.length;
}
