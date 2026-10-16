const state = {
  currentDeckName: null,
  currentCardId: null,
  currentDeck: null,
  deckViewMode: "card", // "card" | "order"
  cardSortBy: "id",
  occurrenceSortBy: "position",
  deckFormMode: "create", // "create" | "edit"
};

const el = (id) => document.getElementById(id);

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const PANELS = ["deck-view", "card-editor", "deck-form"];

function showPanel(id) {
  for (const panelId of PANELS) {
    el(panelId).classList.toggle("hidden", panelId !== id);
  }
  el("empty-state").classList.add("hidden");
}

function showEmptyState() {
  for (const panelId of PANELS) {
    el(panelId).classList.add("hidden");
  }
  el("empty-state").classList.remove("hidden");
}

async function loadSidebar() {
  const decks = await api("GET", "/api/decks");
  const byCategory = new Map();
  for (const deck of decks) {
    if (!byCategory.has(deck.category)) byCategory.set(deck.category, []);
    byCategory.get(deck.category).push(deck);
  }

  const container = el("categories");
  container.innerHTML = "";
  for (const [category, categoryDecks] of [...byCategory.entries()].sort()) {
    const section = document.createElement("div");
    section.className = "category";

    const heading = document.createElement("div");
    heading.className = "category-name";
    heading.textContent = `${category} (${categoryDecks.length})`;
    section.appendChild(heading);

    for (const deck of categoryDecks.sort((a, b) => a.Name.localeCompare(b.Name))) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "deck-item";
      btn.textContent = `${deck.Name} — ${deck.Title || ""} (${deck.cardCount})`;
      btn.dataset.deckName = deck.Name;
      btn.addEventListener("click", () => openDeck(deck.Name));
      section.appendChild(btn);
    }

    container.appendChild(section);
  }
}

function markActiveDeck(name) {
  for (const btn of document.querySelectorAll(".deck-item")) {
    btn.classList.toggle("active", btn.dataset.deckName === name);
  }
}

// Deck metadata (Title, Description, Counter1/Counter2, ...) comes straight
// from the deck-catalog module (2111) — rendered here both for the deck
// view itself and, compactly, alongside a card being edited so its deck
// context stays visible.
function renderDeckMeta(deck, targetId) {
  const target = el(targetId);
  target.innerHTML = "";
  if (!deck) return;

  if (deck.Description) {
    const p = document.createElement("p");
    p.className = "description";
    p.textContent = deck.Description;
    target.appendChild(p);
  }

  const counters = [deck.Counter1, deck.Counter2].filter(Boolean).map(stripHtml);
  if (counters.length) {
    const p = document.createElement("p");
    p.className = "counters";
    p.textContent = counters.join(" · ");
    target.appendChild(p);
  }

  const stats = [
    ["ID", deck.ID],
    ["PullCounter", deck.PullCounter],
    ["MaxInterval", deck.MaxInterval],
    ["AutoTickStreak", deck.AutoTickStreak],
    ["AutoHammerCount", deck.AutoHammerCount],
  ].filter(([, value]) => value !== undefined);
  if (stats.length) {
    const p = document.createElement("p");
    p.className = "stats";
    p.textContent = stats.map(([label, value]) => `${label}: ${value}`).join(" · ");
    target.appendChild(p);
  }
}

// --- "By card" view: one row per unique card, deduplicated across any
// multiple occurrences, with the set of direction letters it occurs with.

const CARD_SORTS = {
  id: { label: "Sort: Card ID", cmp: (a, b) => a.ID.localeCompare(b.ID) },
  preview: { label: "Sort: Preview (A–Z)", cmp: (a, b) => (a.preview || "").localeCompare(b.preview || "") },
};

function renderCardList(deck) {
  const list = el("card-list");
  list.innerHTML = "";
  const cards = [...deck.cards].sort(CARD_SORTS[state.cardSortBy].cmp);
  for (const card of cards) {
    const li = document.createElement("li");
    const idSpan = document.createElement("span");
    idSpan.className = "card-id";
    idSpan.textContent = card.ID;
    const directionsSpan = document.createElement("span");
    directionsSpan.className = "card-directions";
    directionsSpan.textContent = (card.directions || []).join("");
    directionsSpan.title = `direction letters: ${(card.directions || []).join(", ")}`;
    const previewSpan = document.createElement("span");
    previewSpan.className = "card-preview";
    previewSpan.textContent = card.preview || "";
    li.appendChild(idSpan);
    li.appendChild(directionsSpan);
    li.appendChild(previewSpan);
    li.addEventListener("click", () => openCard(card.ID));
    list.appendChild(li);
  }
}

// --- "By order" view: deck.Cards[]'s own array order *is* the real
// presentation sequence, which the grouped "by card" view above collapses
// away — one row per occurrence (a card can occur more than once, once per
// side it's presented on). Sorting here is purely a display reorder — each
// occurrence still carries its true `index` for the edit/delete API calls,
// independent of how it's currently sorted on screen.

const ORDER_SORTS = {
  position: { label: "Sort: Position (presentation order)", cmp: (a, b) => a.index - b.index },
  id: { label: "Sort: Card ID", cmp: (a, b) => a.cardId.localeCompare(b.cardId) || a.index - b.index },
  letter: { label: "Sort: Letter", cmp: (a, b) => a.letter.localeCompare(b.letter) || a.index - b.index },
};

function renderOccurrences(deck) {
  const list = el("occurrence-list");
  list.innerHTML = "";
  const occurrences = [...(deck.occurrences || [])].sort(ORDER_SORTS[state.occurrenceSortBy].cmp);
  for (const occ of occurrences) {
    const li = document.createElement("li");

    const posSpan = document.createElement("span");
    posSpan.className = "occurrence-pos";
    posSpan.textContent = `#${occ.index + 1}`;

    const idSpan = document.createElement("span");
    idSpan.className = "card-id";
    idSpan.textContent = occ.cardId;

    const letterSelect = document.createElement("select");
    for (const letter of ["N", "E", "A"]) {
      const option = document.createElement("option");
      option.value = letter;
      option.textContent = letter;
      letterSelect.appendChild(option);
    }
    letterSelect.value = occ.letter;
    letterSelect.addEventListener("change", () =>
      updateOccurrenceLetter(deck.Name, occ.index, letterSelect.value)
    );

    const previewSpan = document.createElement("span");
    previewSpan.className = "card-preview";
    previewSpan.textContent = occ.preview || "";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger small";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", () => deleteOccurrence(deck.Name, occ.index));

    li.appendChild(posSpan);
    li.appendChild(idSpan);
    li.appendChild(letterSelect);
    li.appendChild(previewSpan);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

function populateAddOccurrenceCardOptions(deck) {
  const select = el("add-occurrence-card");
  select.innerHTML = "";
  for (const card of deck.cards || []) {
    const option = document.createElement("option");
    option.value = card.ID;
    option.textContent = `${card.ID} — ${card.preview || ""}`;
    select.appendChild(option);
  }
}

function populateSortSelect() {
  const sorts = state.deckViewMode === "order" ? ORDER_SORTS : CARD_SORTS;
  const currentKey = state.deckViewMode === "order" ? state.occurrenceSortBy : state.cardSortBy;
  const select = el("sort-select");
  select.innerHTML = "";
  for (const [key, { label }] of Object.entries(sorts)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = currentKey;
}

function handleSortChange() {
  const value = el("sort-select").value;
  if (state.deckViewMode === "order") {
    state.occurrenceSortBy = value;
    renderOccurrences(state.currentDeck);
  } else {
    state.cardSortBy = value;
    renderCardList(state.currentDeck);
  }
}

async function updateOccurrenceLetter(deckName, index, letter) {
  try {
    await api("PUT", `/api/decks/${encodeURIComponent(deckName)}/occurrences/${index}`, { letter });
  } catch (err) {
    alert(err.message);
  }
  await openDeck(deckName);
  showOrderView();
}

async function deleteOccurrence(deckName, index) {
  await api("DELETE", `/api/decks/${encodeURIComponent(deckName)}/occurrences/${index}`);
  await openDeck(deckName);
  showOrderView();
}

async function addOccurrence() {
  const cardId = el("add-occurrence-card").value;
  const letter = el("add-occurrence-letter").value;
  if (!cardId) return;
  await api("POST", `/api/decks/${encodeURIComponent(state.currentDeckName)}/occurrences`, {
    cardId,
    letter,
  });
  await openDeck(state.currentDeckName);
  showOrderView();
}

function toggleAddOccurrenceBar() {
  el("add-occurrence").classList.toggle("hidden");
}

async function shuffleDeck() {
  if (!state.currentDeckName) return;
  await api("POST", `/api/decks/${encodeURIComponent(state.currentDeckName)}/shuffle`, {});
  await openDeck(state.currentDeckName);
  showOrderView();
}

function showCardListView() {
  state.deckViewMode = "card";
  el("view-by-card-btn").classList.add("active");
  el("view-by-order-btn").classList.remove("active");
  el("shuffle-btn").classList.add("hidden");
  el("card-list").classList.remove("hidden");
  el("order-view").classList.add("hidden");
  populateSortSelect();
  if (state.currentDeck) renderCardList(state.currentDeck);
}

function showOrderView() {
  state.deckViewMode = "order";
  el("view-by-order-btn").classList.add("active");
  el("view-by-card-btn").classList.remove("active");
  el("shuffle-btn").classList.remove("hidden");
  el("card-list").classList.add("hidden");
  el("order-view").classList.remove("hidden");
  populateSortSelect();
  if (state.currentDeck) renderOccurrences(state.currentDeck);
}

async function openDeck(name) {
  state.currentDeckName = name;
  state.currentCardId = null;
  markActiveDeck(name);

  const deck = await api("GET", `/api/decks/${encodeURIComponent(name)}`);
  state.currentDeck = deck;
  el("deck-title").textContent = `${deck.Name} — ${deck.Title || ""}`;
  renderDeckMeta(deck, "deck-meta");

  populateAddOccurrenceCardOptions(deck);
  el("add-occurrence").classList.add("hidden");

  if (state.deckViewMode === "order") {
    showOrderView();
  } else {
    showCardListView();
  }

  showPanel("deck-view");
}

function setPreview(fieldId, previewId) {
  el(previewId).innerHTML = el(fieldId).value;
}

function wireLivePreview() {
  for (const field of ["N", "E", "X"]) {
    el(`field-${field}`).addEventListener("input", () => setPreview(`field-${field}`, `preview-${field}`));
  }
}

async function openCard(id) {
  const card = await api("GET", `/api/cards/${encodeURIComponent(id)}`);
  state.currentCardId = card.ID;
  const owningDeck =
    state.currentDeck && state.currentDeck.Name === card.DECK_ID ? state.currentDeck : null;
  el("card-editor-title").textContent = owningDeck
    ? `${card.ID} — ${owningDeck.Title || ""}`
    : card.ID;
  el("card-error").classList.add("hidden");
  renderDeckMeta(owningDeck, "card-deck-meta");

  for (const field of ["N", "E", "D", "X", "A"]) {
    el(`field-${field}`).value = card[field] || "";
  }
  for (const field of ["N", "E", "X"]) {
    setPreview(`field-${field}`, `preview-${field}`);
  }

  showPanel("card-editor");
}

async function saveCard() {
  const body = {};
  for (const field of ["N", "E", "D", "X", "A"]) {
    body[field] = el(`field-${field}`).value;
  }
  try {
    await api("PUT", `/api/cards/${encodeURIComponent(state.currentCardId)}`, body);
    el("card-error").classList.add("hidden");
    await openDeck(state.currentDeckName);
    await openCard(state.currentCardId);
  } catch (err) {
    el("card-error").textContent = err.message;
    el("card-error").classList.remove("hidden");
  }
}

async function deleteCard() {
  if (!confirm(`Delete card ${state.currentCardId}?`)) return;
  await api("DELETE", `/api/cards/${encodeURIComponent(state.currentCardId)}`);
  await openDeck(state.currentDeckName);
  showPanel("deck-view");
}

async function createCard() {
  if (!state.currentDeckName) return;
  const card = await api("POST", "/api/cards", { DECK_ID: state.currentDeckName });
  await loadSidebar();
  await openDeck(state.currentDeckName);
  await openCard(card.ID);
}

// --- Deck create/edit form. Both share the same field set and markup;
// create prefills NEW_DECK_DEFAULTS-matching values client-side (the
// server fills the same defaults for anything omitted/blank anyway) and
// leaves `ID` for the server to assign, edit prefills the deck's current
// values and leaves every field (including `ID`) editable.

const NEW_DECK_FORM_DEFAULTS = {
  Enabled: true,
  PullCounter: 0,
  MaxInterval: 10,
  AutoTickStreak: 1,
  AutoHammerCount: 2,
};

function setDeckFormValues(deck) {
  el("df-Name").value = deck.Name || "";
  el("df-Title").value = deck.Title || "";
  el("df-ID").value = deck.ID ?? "";
  el("df-Code").value = deck.Code || "";
  el("df-Enabled").checked = deck.Enabled !== false;
  el("df-PullCounter").value = deck.PullCounter ?? "";
  el("df-MaxInterval").value = deck.MaxInterval ?? "";
  el("df-AutoTickStreak").value = deck.AutoTickStreak ?? "";
  el("df-AutoHammerCount").value = deck.AutoHammerCount ?? "";
  el("df-Counter1").value = deck.Counter1 || "";
  el("df-Counter2").value = deck.Counter2 || "";
  el("df-Description").value = deck.Description || "";
}

function readDeckFormValues() {
  const numberOrUndefined = (value) => (value === "" ? undefined : Number(value));
  return {
    Name: el("df-Name").value.trim(),
    Title: el("df-Title").value.trim(),
    ID: numberOrUndefined(el("df-ID").value),
    Code: el("df-Code").value.trim(),
    Enabled: el("df-Enabled").checked,
    PullCounter: numberOrUndefined(el("df-PullCounter").value),
    MaxInterval: numberOrUndefined(el("df-MaxInterval").value),
    AutoTickStreak: numberOrUndefined(el("df-AutoTickStreak").value),
    AutoHammerCount: numberOrUndefined(el("df-AutoHammerCount").value),
    Counter1: el("df-Counter1").value.trim(),
    Counter2: el("df-Counter2").value.trim(),
    Description: el("df-Description").value.trim(),
  };
}

function openNewDeckForm() {
  state.deckFormMode = "create";
  el("deck-form-title").textContent = "New deck";
  el("deck-form-submit-btn").textContent = "Create";
  el("df-Name").disabled = false;
  setDeckFormValues(NEW_DECK_FORM_DEFAULTS);
  el("df-ID").placeholder = "(auto-assigned)";
  el("deck-form-error").classList.add("hidden");
  showPanel("deck-form");
}

function openEditDeckForm() {
  if (!state.currentDeck) return;
  state.deckFormMode = "edit";
  el("deck-form-title").textContent = `Edit ${state.currentDeck.Name}`;
  el("deck-form-submit-btn").textContent = "Save";
  el("df-Name").disabled = true;
  el("df-ID").placeholder = "";
  setDeckFormValues(state.currentDeck);
  el("deck-form-error").classList.add("hidden");
  showPanel("deck-form");
}

async function submitDeckForm() {
  const values = readDeckFormValues();
  if (state.deckFormMode === "create" && !values.Name) return;

  try {
    if (state.deckFormMode === "create") {
      const deck = await api("POST", "/api/decks", values);
      await loadSidebar();
      await openDeck(deck.Name);
    } else {
      await api("PUT", `/api/decks/${encodeURIComponent(state.currentDeck.Name)}`, values);
      await loadSidebar();
      await openDeck(state.currentDeck.Name);
    }
    el("deck-form-error").classList.add("hidden");
  } catch (err) {
    el("deck-form-error").textContent = err.message;
    el("deck-form-error").classList.remove("hidden");
  }
}

let searchDebounceTimer = null;

function renderSearchResults(results) {
  const container = el("search-results");
  container.innerHTML = "";
  const hasResults = results.decks.length > 0 || results.cards.length > 0;
  container.classList.toggle("hidden", !hasResults);
  if (!hasResults) return;

  for (const deck of results.decks) {
    const item = document.createElement("div");
    item.className = "search-result";
    item.textContent = `Deck: ${deck.Name} — ${deck.Title || ""}`;
    item.addEventListener("click", () => {
      el("search-input").value = "";
      container.classList.add("hidden");
      openDeck(deck.Name);
    });
    container.appendChild(item);
  }

  for (const card of results.cards) {
    const item = document.createElement("div");
    item.className = "search-result";
    item.textContent = `Card ${card.ID} (${card.DECK_ID}): ${card.preview}`;
    item.addEventListener("click", async () => {
      el("search-input").value = "";
      container.classList.add("hidden");
      await openDeck(card.DECK_ID);
      await openCard(card.ID);
    });
    container.appendChild(item);
  }

  if (results.cardsTotal > results.cards.length) {
    const more = document.createElement("div");
    more.className = "search-result-more";
    more.textContent = `+ ${results.cardsTotal - results.cards.length} more cards — refine your search`;
    container.appendChild(more);
  }
}

async function runSearch(query) {
  if (!query.trim()) {
    el("search-results").classList.add("hidden");
    return;
  }
  const results = await api("GET", `/api/search?q=${encodeURIComponent(query)}`);
  renderSearchResults(results);
}

function wireSearch() {
  el("search-input").addEventListener("input", (e) => {
    clearTimeout(searchDebounceTimer);
    const query = e.target.value;
    searchDebounceTimer = setTimeout(() => runSearch(query), 200);
  });
}

function init() {
  wireLivePreview();
  wireSearch();
  el("new-card-btn").addEventListener("click", createCard);
  el("save-card-btn").addEventListener("click", saveCard);
  el("delete-card-btn").addEventListener("click", deleteCard);
  el("new-deck-btn").addEventListener("click", openNewDeckForm);
  el("edit-deck-btn").addEventListener("click", openEditDeckForm);
  el("deck-form-submit-btn").addEventListener("click", submitDeckForm);
  el("view-by-card-btn").addEventListener("click", showCardListView);
  el("view-by-order-btn").addEventListener("click", showOrderView);
  el("shuffle-btn").addEventListener("click", shuffleDeck);
  el("sort-select").addEventListener("change", handleSortChange);
  el("add-occurrence-toggle-btn").addEventListener("click", toggleAddOccurrenceBar);
  el("add-occurrence-btn").addEventListener("click", addOccurrence);

  showEmptyState();
  loadSidebar();
}

init();
