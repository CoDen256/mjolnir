## Context

Module 2119 of the decompiled bundle is the deck-list / "Choose your
topics" / "Start today's session" screen. Two pieces of logic in it are in
scope:

1. The `Completion` calculation (confirmed in this session, exploded bundle
   around line 272 of `2119.js`):
   ```js
   var e = function (e) {
     var n = A.find(t => t.ID === e.ID),      // this deck's decksInfo entry
         r = e.Cards.length,                   // total occurrences in the deck
         a = ((5 * (n?.PullCounter ?? 0)) / r) * 100;
     e.Completion = parseInt(Math.round(100 * a) / 100);
   };
   ```
   `PullCounter` (mutated in module 2110's `drawNewCards`) counts whole
   batches-of-up-to-5 cards, incrementing even on a final partial batch, and
   stopping only once a pull returns zero new cards — so at full exhaustion
   `PullCounter = ceil(Cards.length / 5)`, which overshoots 100% whenever
   `Cards.length` isn't a multiple of 5. Confirmed this never happens for
   stock decks (authored in round multiples of 5) and reliably happens for
   custom decks (grown in small, irregular increments per this project's
   own staggered occurrence-shipment design, D91).

2. The session-start gate (`Vt()`, same module, ~line 447 of the exploded
   file):
   ```js
   Vt = function () {
     var e = true;
     var t = function (deckId) {
       if (findDeck(deckId).Completion < 100) { e = false; return true; }
     };
     for (var deckId of selectedDecks) if (t(deckId)) break;
     return e;
   };
   // in the button handler:
   if (Vt() && !alreadyShownThisVisit) return showPopup("completed your topics");
   callDrawNewCards();  // never itself consults Completion
   if (drawnCards.length === 0) Alert.alert("No new cards for today!");
   ```
   Confirmed (separate investigation, this session): `drawNewCards` only
   ever returns zero new cards when the deck's own `Cards[]` is genuinely
   exhausted — it does not consult `Completion`, a daily cap, rest days, or
   anything else. So the `Vt()` gate is strictly redundant with (and, due to
   the formula bug, less trustworthy than) the `drawnCards.length === 0`
   check that already runs immediately after.

## Goals / Non-Goals

**Goals:**
- The displayed percentage never shows above 100%.
- "Start today's session" never shows a possibly-false "you've completed
  your topics" interstitial — pressing it always attempts the real draw,
  and the existing, already-accurate "No new cards for today!" alert is the
  sole signal for "nothing left."

**Non-Goals:**
- NOT computing a per-card-accurate completion percentage (would require
  deduping `Cards[]`/`totalCards` by base card ID across N/E/A occurrence
  suffixes — a real, non-trivial addition; explicitly declined by the
  operator as more complexity than the cosmetic bug warrants).
- NOT touching `drawNewCards` (module 2110) or the deck/occurrence data
  model at all — the bug is entirely contained in module 2119's own display
  and gating logic.
- NOT touching the freemium `P`-field gating logic in `drawNewCards`
  (confirmed unrelated — `P` is a static paid-content flag, not a progress
  indicator, and already works correctly).

## Decisions

### D-D1 — Clamp, don't recompute

`e.Completion = parseInt(Math.round(100 * a) / 100)` becomes
`e.Completion = Math.min(100, parseInt(Math.round(100 * a) / 100))` — a
one-line change. The underlying `a`/`PullCounter`-based math is left
exactly as-is; only the final displayed number is capped.

Alternative considered: compute true completion from deduped
`Cards[]`/`totalCards` (see the accurate-percentage design discussed and
declined during exploration). Rejected per the operator's explicit call —
cosmetic clamp is good enough, real complexity not justified.

### D-D2 — Remove the `Vt()` gate entirely, don't fix its threshold

The gate is deleted outright (the `if (Vt() && !alreadyShown) return
showPopup(...)` branch is removed), not adjusted to use a different
threshold or a "true" completion value — because `drawNewCards`'s own
`drawnCards.length === 0` check already correctly handles "nothing left,"
unconditionally, with no dependency on `Completion` at all. Keeping a
second, redundant gate whose correctness depends on a value we've just
decided NOT to make accurate (D-D1) would reintroduce the same class of
bug the moment any deck's real `Cards.length` isn't a multiple of 5 — it
would just be rarer, not fixed.

Note: removing this gate also means the one-time "you've completed your
selected topics" positive-feedback moment disappears from the UI (it was
also a real user-facing message when `Completion` was genuinely accurate at
exactly 100%, not just when it was wrong). Flagged in Risks below.

## Risks / Trade-offs

- **Losing the (occasionally correct) "you've completed your topics"
  congratulatory message** → mitigation: none planned — the operator chose
  "suppress the popup" explicitly, accepting this trade-off in exchange for
  removing the false-positive case, rather than trying to distinguish a
  true 100% from a false one (which would require the accurate-percentage
  work declined in D-D1).
- **`Math.min(100, …)` is a display-only patch — intermediate (not-yet-
  exhausted) completion values stay batch-granular, not card-accurate**
  (e.g. a deck might jump from 71% to 100% in one batch, skipping values in
  between, rather than advancing smoothly per card) → unchanged from
  current behavior; `5 * PullCounter / Cards.length` is mathematically
  guaranteed to reach `>= 100` exactly when the deck is genuinely exhausted
  (never gets permanently stuck below), so the only effect of this
  imprecision is a slightly lumpy progression toward 100%, never an
  incorrect "stuck" state or a final value below 100% for a truly-finished
  deck. Consistent with the stated Non-Goal (not solving this precision
  gap, just removing the overshoot past 100%).
