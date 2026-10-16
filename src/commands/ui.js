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
  NEW_CARD_SKELETON,
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

function cardSummary(card) {
  const plainText = stripHtml(card.N);
  const preview =
    plainText.length > PREVIEW_MAX_LENGTH
      ? `${plainText.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
      : plainText;
  return { ID: card.ID, DECK_ID: card.DECK_ID, N: card.N, preview };
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
        const deckCards = cards.filter((c) => c.DECK_ID === name).map(cardSummary);
        return { status: 200, body: { ...deck, category: deckCategory(deck), cards: deckCards } };
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
        const deck = { ...body, Cards: [] };
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
        deck.Cards.push({ Card: `${id}N`, P: "N" });

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
      const { status, body: resBody } = route.handler(match, body);
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
