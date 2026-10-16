import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDeckCardModel,
  saveDeckCardModel,
  deckCategory,
  nextCardId,
  stripHtml,
  cardDirectionsInDeck,
  addOccurrence,
  updateOccurrenceLetter,
  removeOccurrence,
  shuffleOccurrences,
  searchDecks,
  searchCards,
  nextDeckId,
  NEW_CARD_SKELETON,
  NEW_DECK_DEFAULTS,
} from "../deckData.js";

const ASSETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../ui-assets");

const STATIC_FILES = {
  "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", contentType: "text/css; charset=utf-8" },
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function deckSummaries(decks, cards) {
  const cardCountByDeck = new Map();
  for (const card of cards) {
    cardCountByDeck.set(card.DECK_ID, (cardCountByDeck.get(card.DECK_ID) || 0) + 1);
  }
  return decks.map((deck) => ({
    Name: deck.Name,
    Title: deck.Title,
    category: deckCategory(deck),
    cardCount: cardCountByDeck.get(deck.Name) || 0,
  }));
}

function findDeck(decks, name) {
  return decks.find((d) => d.Name === name);
}

function findCard(cards, id) {
  return cards.find((c) => c.ID === id);
}

const PREVIEW_MAX_LENGTH = 80;
const SEARCH_RESULT_LIMIT = 50;

function previewText(card) {
  const plainText = stripHtml(card.N);
  return plainText.length > PREVIEW_MAX_LENGTH
    ? `${plainText.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
    : plainText;
}

function cardSummary(card, directions = []) {
  return { ID: card.ID, DECK_ID: card.DECK_ID, N: card.N, preview: previewText(card), directions };
}

// A deck's `Cards[]` *array order* is the actual presentation sequence —
// this mirrors it 1:1 (one entry per occurrence, in order) rather than
// deduplicating by card id the way cardSummary's per-deck list does.
function occurrenceSummaries(deck, cardsById) {
  return deck.Cards.map((ref, index) => {
    const cardId = ref.Card.slice(0, -1);
    const letter = ref.Card.slice(-1);
    const card = cardsById.get(cardId);
    return { index, cardId, letter, preview: card ? previewText(card) : null };
  });
}

function serveStatic(req, res, pathname) {
  const entry = STATIC_FILES[pathname];
  if (!entry) {
    sendError(res, 404, "not found");
    return;
  }
  const filePath = path.join(ASSETS_DIR, entry.file);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendError(res, 404, "not found");
      return;
    }
    res.writeHead(200, { "Content-Type": entry.contentType });
    res.end(data);
  });
}

// Builds the route handler table. Every mutating handler reloads the model
// fresh from the bundle, applies its edit, validates, and saves — each
// request is its own atomic load-edit-validate-save cycle, so there is no
// server-held draft state to go stale between requests.
function createRoutes(bundlePath) {
  return [
    {
      method: "GET",
      pattern: /^\/api\/decks$/,
      handler: () => {
        const { decks, cards } = loadDeckCardModel(bundlePath);
        return { status: 200, body: deckSummaries(decks, cards) };
      },
    },
    {
      method: "GET",
      pattern: /^\/api\/decks\/([^/]+)$/,
      handler: (match) => {
        const name = decodeURIComponent(match[1]);
        const { decks, cards } = loadDeckCardModel(bundlePath);
        const deck = findDeck(decks, name);
        if (!deck) return { status: 404, body: { error: `no deck named "${name}"` } };
        const directions = cardDirectionsInDeck(deck);
        const deckCards = cards
          .filter((c) => c.DECK_ID === name)
          .map((c) => cardSummary(c, [...(directions.get(c.ID) || [])].sort()));
        const cardsById = new Map(cards.map((c) => [c.ID, c]));
        return {
          status: 200,
          body: {
            ...deck,
            category: deckCategory(deck),
            cards: deckCards,
            occurrences: occurrenceSummaries(deck, cardsById),
          },
        };
      },
    },
    {
      method: "POST",
      pattern: /^\/api\/decks$/,
      handler: (match, body) => {
        if (!body || typeof body.Name !== "string" || !body.Name) {
          return { status: 400, body: { error: "Name is required" } };
        }
        const model = loadDeckCardModel(bundlePath);
        if (findDeck(model.decks, body.Name)) {
          return { status: 400, body: { error: `deck "${body.Name}" already exists` } };
        }
        // ID is always server-assigned (never trusts a client-supplied
        // value) to guarantee uniqueness; every other field falls back to
        // NEW_DECK_DEFAULTS when the request omits or blanks it.
        const deck = { ID: nextDeckId(model.decks), Name: body.Name, Title: body.Title || "" };
        for (const [key, defaultValue] of Object.entries(NEW_DECK_DEFAULTS)) {
          deck[key] = body[key] !== undefined && body[key] !== "" ? body[key] : defaultValue;
        }
        deck.Cards = [];
        model.decks.push(deck);
        saveDeckCardModel(bundlePath, model);
        return { status: 201, body: deck };
      },
    },
    {
      method: "PUT",
      pattern: /^\/api\/decks\/([^/]+)$/,
      handler: (match, body) => {
        const name = decodeURIComponent(match[1]);
        const model = loadDeckCardModel(bundlePath);
        const deck = findDeck(model.decks, name);
        if (!deck) return { status: 404, body: { error: `no deck named "${name}"` } };
        // Only `Name` is protected — `Cards` is editable via direct API use
        // (the frontend never sends it), so an edit that leaves a reference
        // unresolved is caught by saveDeckCardModel's validation, not
        // blocked at the route level.
        Object.assign(deck, body, { Name: deck.Name });
        saveDeckCardModel(bundlePath, model);
        return { status: 200, body: deck };
      },
    },
    {
      method: "GET",
      pattern: /^\/api\/cards\/([^/]+)$/,
      handler: (match) => {
        const id = decodeURIComponent(match[1]);
        const { cards } = loadDeckCardModel(bundlePath);
        const card = findCard(cards, id);
        if (!card) return { status: 404, body: { error: `no card with id "${id}"` } };
        return { status: 200, body: card };
      },
    },
    {
      method: "POST",
      pattern: /^\/api\/cards$/,
      handler: (match, body) => {
        if (!body || typeof body.DECK_ID !== "string" || !body.DECK_ID) {
          return { status: 400, body: { error: "DECK_ID is required" } };
        }
        const model = loadDeckCardModel(bundlePath);
        const deck = findDeck(model.decks, body.DECK_ID);
        if (!deck) return { status: 400, body: { error: `no deck named "${body.DECK_ID}"` } };

        const id = nextCardId(deck.Name, model.cards);
        const card = {
          DECK_ID: deck.Name,
          ID: id,
          N: body.N ?? NEW_CARD_SKELETON.N,
          E: body.E ?? NEW_CARD_SKELETON.E,
          D: body.D ?? deck.Title ?? "",
          X: body.X ?? NEW_CARD_SKELETON.X,
          A: body.A ?? "X",
        };
        model.cards.push(card);
        // New cards get both a front (N) and a back (E) occurrence by
        // default, not just front.
        addOccurrence(deck, id, "N");
        addOccurrence(deck, id, "E");

        saveDeckCardModel(bundlePath, model);
        return { status: 201, body: card };
      },
    },
    {
      method: "PUT",
      pattern: /^\/api\/cards\/([^/]+)$/,
      handler: (match, body) => {
        const id = decodeURIComponent(match[1]);
        const model = loadDeckCardModel(bundlePath);
        const card = findCard(model.cards, id);
        if (!card) return { status: 404, body: { error: `no card with id "${id}"` } };
        // Only `ID` is protected — `DECK_ID` is editable (e.g. moving a
        // card between decks), so an edit that leaves it unresolved is
        // caught by saveDeckCardModel's referential-integrity check, not
        // blocked at the route level.
        Object.assign(card, body, { ID: card.ID });
        saveDeckCardModel(bundlePath, model);
        return { status: 200, body: card };
      },
    },
    {
      method: "DELETE",
      pattern: /^\/api\/cards\/([^/]+)$/,
      handler: (match) => {
        const id = decodeURIComponent(match[1]);
        const model = loadDeckCardModel(bundlePath);
        const card = findCard(model.cards, id);
        if (!card) return { status: 404, body: { error: `no card with id "${id}"` } };

        model.cards = model.cards.filter((c) => c.ID !== id);
        for (const deck of model.decks) {
          deck.Cards = deck.Cards.filter((ref) => ref.Card.slice(0, -1) !== id);
        }

        saveDeckCardModel(bundlePath, model);
        return { status: 200, body: { deleted: id } };
      },
    },
    {
      // Adds a new presentation occurrence of an existing card to a deck's
      // Cards[] sequence (e.g. "also quiz this card's back"), always
      // appended at the end — the UI never offers to pick a position.
      method: "POST",
      pattern: /^\/api\/decks\/([^/]+)\/occurrences$/,
      handler: (match, body) => {
        const name = decodeURIComponent(match[1]);
        const model = loadDeckCardModel(bundlePath);
        const deck = findDeck(model.decks, name);
        if (!deck) return { status: 404, body: { error: `no deck named "${name}"` } };

        const cardId = body && body.cardId;
        const letter = body && body.letter;
        if (!cardId) return { status: 400, body: { error: "cardId is required" } };
        const card = findCard(model.cards, cardId);
        if (!card) return { status: 400, body: { error: `no card with id "${cardId}"` } };
        if (card.DECK_ID !== deck.Name) {
          return {
            status: 400,
            body: { error: `card "${cardId}" belongs to deck "${card.DECK_ID}", not "${deck.Name}"` },
          };
        }

        addOccurrence(deck, cardId, letter);
        saveDeckCardModel(bundlePath, model);
        return { status: 201, body: { index: deck.Cards.length - 1, cardId, letter } };
      },
    },
    {
      method: "PUT",
      pattern: /^\/api\/decks\/([^/]+)\/occurrences\/(\d+)$/,
      handler: (match, body) => {
        const name = decodeURIComponent(match[1]);
        const index = Number(match[2]);
        const model = loadDeckCardModel(bundlePath);
        const deck = findDeck(model.decks, name);
        if (!deck) return { status: 404, body: { error: `no deck named "${name}"` } };

        updateOccurrenceLetter(deck, index, body && body.letter);
        saveDeckCardModel(bundlePath, model);
        const ref = deck.Cards[index];
        return { status: 200, body: { index, cardId: ref.Card.slice(0, -1), letter: ref.Card.slice(-1) } };
      },
    },
    {
      method: "DELETE",
      pattern: /^\/api\/decks\/([^/]+)\/occurrences\/(\d+)$/,
      handler: (match) => {
        const name = decodeURIComponent(match[1]);
        const index = Number(match[2]);
        const model = loadDeckCardModel(bundlePath);
        const deck = findDeck(model.decks, name);
        if (!deck) return { status: 404, body: { error: `no deck named "${name}"` } };

        removeOccurrence(deck, index);
        saveDeckCardModel(bundlePath, model);
        return { status: 200, body: { deleted: index } };
      },
    },
    {
      method: "POST",
      pattern: /^\/api\/decks\/([^/]+)\/shuffle$/,
      handler: (match) => {
        const name = decodeURIComponent(match[1]);
        const model = loadDeckCardModel(bundlePath);
        const deck = findDeck(model.decks, name);
        if (!deck) return { status: 404, body: { error: `no deck named "${name}"` } };

        shuffleOccurrences(deck);
        saveDeckCardModel(bundlePath, model);
        const cardsById = new Map(model.cards.map((c) => [c.ID, c]));
        return { status: 200, body: { occurrences: occurrenceSummaries(deck, cardsById) } };
      },
    },
    {
      method: "GET",
      pattern: /^\/api\/search$/,
      handler: (match, body, url) => {
        const q = url.searchParams.get("q") || "";
        if (!q.trim()) return { status: 200, body: { decks: [], cards: [], cardsTotal: 0 } };

        const { decks, cards } = loadDeckCardModel(bundlePath);
        const deckMatches = searchDecks(decks, q).map((d) => ({
          Name: d.Name,
          Title: d.Title,
          category: deckCategory(d),
        }));
        const cardMatches = searchCards(cards, q);
        return {
          status: 200,
          body: {
            decks: deckMatches,
            cards: cardMatches.slice(0, SEARCH_RESULT_LIMIT).map((c) => cardSummary(c)),
            cardsTotal: cardMatches.length,
          },
        };
      },
    },
  ];
}

export function createServer(bundlePath) {
  const routes = createRoutes(bundlePath);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");

    if (!url.pathname.startsWith("/api/")) {
      serveStatic(req, res, url.pathname);
      return;
    }

    const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
    if (!route) {
      sendError(res, 404, "no such route");
      return;
    }

    try {
      const body = ["POST", "PUT"].includes(req.method) ? await readJsonBody(req) : undefined;
      const match = url.pathname.match(route.pattern);
      const { status, body: resBody } = route.handler(match, body, url);
      sendJson(res, status, resBody);
    } catch (err) {
      sendError(res, 400, err.message);
    }
  });
}

export function runUi(bundlePath, { port = 0 } = {}) {
  const server = createServer(bundlePath);
  server.listen(port, "127.0.0.1", () => {
    const { port: boundPort } = server.address();
    console.log(`bundle-tool ui listening at http://127.0.0.1:${boundPort}`);
  });
  return server;
}
