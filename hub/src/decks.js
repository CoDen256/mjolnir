import { query } from "./db.js";

// The deck allocation table (tun/docs/03-data-model.md, builder/README.md).
// `hub`'s own `decks` row is metadata only (title/pacing knobs); the actual
// bundle deck entry is created once, lazily, by `ensureDeck` (D-P1) the
// first time `builder` mints a card into it.
export const DECK_ALLOCATION = [
  { code: "C20", title: "Substantiv", description: "Nouns." },
  { code: "C21", title: "Adjektiv", description: "Adjectives." },
  { code: "C22", title: "Verb", description: "Verbs." },
  { code: "C23", title: "Adverb", description: "Adverbs." },
  { code: "C24", title: "Preposisjon", description: "Prepositions." },
  { code: "C25", title: "Konjunksjon/Subjunksjon", description: "Conjunctions and subjunctions." },
  { code: "C26", title: "Expression", description: "Fixed expressions and phrases." }, // type=expression, or any unmapped pos
  { code: "C27", title: "Listening", description: "Listening comprehension." },
  { code: "C28", title: "Pronunciation", description: "Pronunciation practice." },
  { code: "C29", title: "Grammar", description: "Grammar rules and usage." },
];

// Task 3.3. "Fixed catalog data" (13-operator-console-ux.md) — safe to
// auto-run on every container boot, unlike sample/test content, because
// idempotent "make sure these 10 rows exist" is always harmless to re-run.
// ON CONFLICT DO NOTHING so a re-run never clobbers an operator-edited
// pacing knob for a deck that already exists.
export async function seedDecks() {
  for (const { code, title, description } of DECK_ALLOCATION) {
    await query(
      `INSERT INTO decks (code, title, category, description) VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING`,
      [code, title, code[0], description || ""]
    );
  }
  return DECK_ALLOCATION.length;
}

// Task 1.3: the operator's own edit affordance (same pattern as
// `publications.js`'s `updateLabel`) — independent of `seedDecks`'
// ON CONFLICT DO NOTHING, which never touches an already-existing row.
export async function updateDeckDescription(code, description) {
  const { rowCount } = await query("UPDATE decks SET description = $1 WHERE code = $2", [description, code]);
  if (rowCount === 0) throw new Error(`no such deck "${code}"`);
}

export async function listDecks() {
  const { rows } = await query("SELECT code, title, category, description FROM decks ORDER BY code");
  return rows;
}
