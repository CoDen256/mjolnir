import { createCard, ensureDeck } from "../../src/injectDeck.js";
import { addOccurrence } from "../../src/deckData.js";
import { deckTitle } from "./mint.js";
import { getAll as getAllCardContent } from "./cardContent.js";

// D-L4: a pure, stateless rebuild of the deck/card data onto a freshly
// loaded logic bundle — every run starts here instead of mutating one
// persistent working file. Replays exactly the occurrences that have
// *already shipped* (`occurrence_shipments`, in the real chronological ship
// order, D93), re-creating each card once from its durable `card_content`
// row the first time one of its occurrences is seen. A card minted this
// same run (nothing shipped for it yet) is NOT this function's job — it's
// handled by the existing mint/append code path immediately after replay
// runs, same as today's newly-eligible loop (design.md's "Risks" section:
// replay and mint are already two separate steps within one run, not a
// gap). `pending_occurrences` needs no replay step of its own — it's
// already durable DB state, read live by `drainThenQueue` exactly as before.
export async function replay(pool, model) {
  const { rows: shipments } = await pool.query(
    `SELECT os.card_id, os.letter, cs.deck_code
     FROM occurrence_shipments os
     JOIN card_slots cs ON cs.id = os.card_id
     ORDER BY os.id ASC`
  );
  if (shipments.length === 0) return;

  const contentByCard = await getAllCardContent(pool);
  const titleByDeck = new Map();
  const deckByCode = new Map();

  async function ensureDeckByCode(deckCode) {
    if (!titleByDeck.has(deckCode)) titleByDeck.set(deckCode, await deckTitle(pool, deckCode));
    if (!deckByCode.has(deckCode)) {
      deckByCode.set(deckCode, ensureDeck(model.decks, { name: deckCode, title: titleByDeck.get(deckCode) }));
    }
    return deckByCode.get(deckCode);
  }

  const created = new Set();
  for (const { card_id: cardId, letter, deck_code: deckCode } of shipments) {
    const deck = await ensureDeckByCode(deckCode);
    if (!created.has(cardId)) {
      const content = contentByCard.get(cardId);
      if (!content) {
        // card_content is written at the exact same mint-time step that
        // puts a card's first occurrence into the shipment log — this
        // combination means an upstream write path is broken, not a
        // recoverable runtime condition.
        throw new Error(`card "${cardId}" has a shipped occurrence but no card_content row — data corruption`);
      }
      createCard(model.cards, {
        id: cardId,
        deckId: deckCode,
        N: content.N,
        E: content.E,
        D: titleByDeck.get(deckCode),
        X: content.X,
        A: content.A,
      });
      created.add(cardId);
    }
    addOccurrence(deck, cardId, letter);
  }
}
