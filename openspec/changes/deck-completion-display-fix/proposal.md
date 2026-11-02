## Why

The app's deck-list screen displays a per-deck "Completion" percentage that
can exceed 100% (e.g. "166%") for custom-published decks. Root cause
(confirmed from the decompiled bundle, mod 2119): `Completion` is computed
as `(5 * PullCounter / Cards.length) * 100`, where `PullCounter` counts
whole batches-of-up-to-5 cards drawn, not actual individual cards — it
increments by a full `+1` even on a final, partial batch, and the formula
is never clamped. Stock decks never trip this because they were authored in
clean multiples of 5 occurrences; custom decks grow in small, irregular
counts (this project's own occurrence-shipment design, D91, ships a card's
second occurrence in a later batch) and essentially never land on a
multiple of 5.

Separately, the same screen gates the "Start today's session" button on
`Completion >= 100` across every selected deck: the first press shows a
"you've completed your selected topics" popup instead of starting a
session, if every selected deck's (possibly wrong) `Completion` reads
`>= 100`. A second press proceeds normally, since the actual card-draw
logic (`drawNewCards`) never consults `Completion` at all — but the
popup is confusing and, for a deck that is only *apparently* at >=100%
due to the display bug, an unnecessary extra tap.

## What Changes

- Clamp the displayed `Completion` percentage to a maximum of 100 — the
  underlying `PullCounter`-based formula is NOT being replaced with a
  per-card-accurate calculation (that was considered and explicitly
  declined as too complex for the value it adds); this is a display-only
  cosmetic cap.
- Remove the `Completion >= 100` gate on "Start today's session" entirely —
  always proceed to attempt the draw. The existing, already-correct
  "No new cards for today!" alert (driven by the real draw result, not by
  `Completion`) remains the one and only signal for "nothing left to
  draw" — removing the gate does not remove any real feedback, since the
  gate was redundant with (and less trustworthy than) that existing check.

## Capabilities

### New Capabilities
- `deck-completion-display`: the deck-list screen's completion percentage
  and session-start gating behavior.

### Modified Capabilities
(none — no existing main spec described this screen's prior behavior)

## Impact

- A patch-back pair against module 2119 (the deck list / "Choose your
  topics" / "Start today's session" screen) — two small, independent edits
  in the same module: the `Completion` assignment, and the `Vt()`/button
  handler's early-return gate.
- No changes to `builder/`, no changes to how occurrences are published or
  counted — the deck totals themselves were already confirmed accurate.
