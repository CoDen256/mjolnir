import { loadDeckCardModel } from "../../src/deckData.js";

// D93/D-H2: every card ever minted, joined with its per-side shipment/queue
// status. Search/filter/group happen in JS over this one already-joined
// shape — the operator's filter vocabulary ("a side pending") maps directly
// onto it, not onto a SQL WHERE clause that would need to re-derive
// occurrence semantics itself.
export async function cardsList(pool, bundlePath, { search = "", deckCode = "", statusFilter = "" } = {}) {
  const { rows: slots } = await pool.query(
    `SELECT cs.id, cs.deck_code, cs.note_id, cs.grammar_rule_id, d.title AS deck_title
     FROM card_slots cs JOIN decks d ON d.code = cs.deck_code
     ORDER BY cs.id`
  );
  if (slots.length === 0) return [];

  const cardIds = slots.map((s) => s.id);
  const { rows: shipped } = await pool.query(
    "SELECT card_id, letter, build_id FROM occurrence_shipments WHERE card_id = ANY($1) ORDER BY shipped_at ASC",
    [cardIds]
  );
  const { rows: pending } = await pool.query(
    "SELECT card_id, letter, remaining FROM pending_occurrences WHERE card_id = ANY($1)",
    [cardIds]
  );

  const shippedByCard = new Map();
  for (const row of shipped) {
    if (!shippedByCard.has(row.card_id)) shippedByCard.set(row.card_id, []);
    shippedByCard.get(row.card_id).push({ letter: row.letter, buildId: row.build_id, status: "shipped" });
  }
  const pendingByCard = new Map();
  for (const row of pending) {
    if (!pendingByCard.has(row.card_id)) pendingByCard.set(row.card_id, []);
    pendingByCard.get(row.card_id).push({ letter: row.letter, remaining: row.remaining, status: "pending" });
  }

  // The card's actual N/E/X/A text lives in the bundle, not hub's own DB —
  // hub reads it (never writes: `builder` is the bundle's only writer,
  // D-P3) purely to render this page. A missing/unreadable bundle degrades
  // to blank content columns, not a failed page (cards-browser spec's
  // "stabbur unreachable" tolerance extends to this too, by the same logic:
  // the ledger is always the source of truth for *which* cards exist).
  let content = new Map();
  try {
    const model = loadDeckCardModel(bundlePath);
    content = new Map(model.cards.map((c) => [c.ID, c]));
  } catch {
    content = new Map();
  }

  let cards = slots.map((s) => {
    const card = content.get(s.id);
    return {
      id: s.id,
      deckCode: s.deck_code,
      deckTitle: s.deck_title,
      noteId: s.note_id,
      grammarRuleId: s.grammar_rule_id,
      N: card?.N ?? "",
      E: card?.E ?? "",
      sides: [...(shippedByCard.get(s.id) || []), ...(pendingByCard.get(s.id) || [])],
    };
  });

  if (deckCode) cards = cards.filter((c) => c.deckCode === deckCode);
  if (statusFilter === "pending") cards = cards.filter((c) => c.sides.some((s) => s.status === "pending"));
  if (statusFilter === "shipped") cards = cards.filter((c) => c.sides.length > 0 && c.sides.every((s) => s.status === "shipped"));
  if (search) {
    const q = search.toLowerCase();
    cards = cards.filter(
      (c) => c.N.toLowerCase().includes(q) || c.E.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }

  return cards;
}

// Strips the N/E HTML projector.js wraps content in, down to plain text —
// this page is a dense operator table, not the device's own card renderer.
export function stripHtml(html) {
  return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
