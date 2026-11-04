## 0. Before you write any code

**Confirm `deck-rollover` and `deck-descriptions` are both fully
implemented and tested first** — this change depends on both (D-DC1 needs
`resolveActiveDeckCode`; the two new decks need real descriptions from
day one, not blank ones). Read `design.md` in full, especially D-DC1 (the
exact per-card migration sequencing — insert-new-before-repoint-before-
delete-old, never the reverse) and the Migration Plan's dry-run
requirement. Read `hub/migrations/001_init.sql`/`003_pending_occurrences.
sql`/`004_occurrence_shipments.sql`/`011_card_content.sql`/
`016_staged_occurrences.sql` in full to confirm the exact FK shape design.md
describes before writing any migration code against it.

## 1. Family definitions

- [ ] 1.1 `builder/src/deckFamilies.js`'s `DECK_FAMILIES` (from
      `deck-rollover`): define `lexic` (title "Lexic", starting code C30)
      and `practice` (title "Practice", starting code C20), each with a
      real sequence of overflow codes.
- [ ] 1.2 `builder/src/deckAssignment.js`'s `assignDeck`: collapse
      `WORD_POS_DECK`/`TYPE_DECK` into the 2-family mapping (any `type=word`
      PoS → `lexic`; `type=expression` → `lexic`; `type=grammar`/
      `listening`/`pronunciation` → `practice`). Update its existing tests
      for the new return shape (a family key, not a literal deck code).
- [ ] 1.3 `hub/src/decks.js`'s `DECK_ALLOCATION`: becomes the 2 starting
      codes (C20 "Practice", C30 "Lexic") with real descriptions (per
      `deck-descriptions`).

## 2. Migration script — dry-run mode

- [ ] 2.1 New script (e.g. `hub/scripts/migrate-deck-consolidation.js`,
      operator-triggered, NOT part of `hub/src/migrate.js`'s auto-run
      migrations) that, given the current `card_slots` table, computes the
      full old-id → new-id mapping per D-DC1 (grouped by old deck_code,
      ordered by old card_no, assigned sequentially into each card's new
      family via `resolveActiveDeckCode`) — read-only, writes nothing.
- [ ] 2.2 Dry-run output: a clear, complete report — every old id → new id
      pair, a per-table row-count summary of what WOULD change
      (`card_slots`, `card_content`, `pending_occurrences`,
      `staged_occurrences`, `occurrence_shipments`, `minted_notes`), and
      whether `lexic`'s migration would trigger an immediate rollover
      (more than 999 cards migrating into it).
- [ ] 2.3 Tests: dry-run against a synthetic fixture mirroring real
      table shapes (not the real DB) produces the correct mapping and
      counts, confirmed against hand-computed expected output; dry-run
      writes nothing (every table's row count is unchanged after running
      it).

## 3. Migration script — apply mode

- [ ] 3.1 The same mapping computed in 2.1, applied for real: one
      transaction, in the exact per-card order from D-DC1 (insert new
      `card_slots` + `card_content` rows, repoint every referencing table,
      delete old `card_content` + `card_slots` rows).
- [ ] 3.2 A full-migration failure (any error mid-transaction) rolls back
      completely — no partial state.
- [ ] 3.3 After migration: delete the `decks` table row for any code with
      zero remaining `card_slots` references (D-DC5), via the new
      `deck-removal` capability (section 4).
- [ ] 3.4 Tests: applying the migration against a synthetic fixture
      produces exactly the mapping the dry-run reported; every table ends
      up internally consistent (no `pending_occurrences`/
      `staged_occurrences` row referencing a nonexistent `card_slots.id`,
      no `card_content` row with a stale id); a forced failure partway
      through leaves zero rows changed (full rollback verified by
      comparing full-table contents before/after the forced-failure
      attempt).

## 4. Deck removal

- [ ] 4.1 `src/injectDeck.js`: `removeDeck(decks, name)` — removes the
      named deck's entry; refuses (throws) if hub reports any `card_slots`
      row still referencing it.
- [ ] 4.2 Tests: removing a deck with zero remaining references succeeds
      and the remaining "C"-prefixed decks still form one contiguous block
      (test this directly — build a decks array matching the real pre-
      migration shape, remove the 8 retired codes, assert the array's
      "C"-prefixed entries are contiguous by index); removing a deck that
      still has a referencing card_slots row throws and changes nothing.

## 5. End-to-end verification

- [ ] 5.1 A full pipeline test: migrate a synthetic pre-consolidation
      fixture (card_slots/card_content/occurrence_shipments/
      pending_occurrences/staged_occurrences populated across the old 10
      deck codes, including one deck with 999 cards to confirm rollover
      triggers for `lexic`), then run a real publish — confirm the
      resulting bundle has exactly the expected "C"-prefixed decks (2, or
      3+ if rollover triggered), each with the expected `Cards.length` and
      card content, and the 8 retired codes are absent from `model.decks`.
- [ ] 5.2 Confirm a NEW note arriving after migration mints correctly into
      the right family's currently-active code (not accidentally reusing a
      retired code).

## 6. Sign-off

- [ ] 6.1 If anything here contradicts or refines `design.md` during
      implementation, record it as an ADR amendment in
      `tun/docs/07-decisions.md`.
- [ ] 6.2 **(Operator, outside this change — follow design.md's Migration
      Plan exactly)**: run the dry-run against the REAL database, review
      the full mapping report by hand; take a `pg_dump` backup; run the
      real migration; trigger one real publish; confirm on-device the app
      shows exactly the new 2(+rollover) decks, study works normally, and
      the 8 retired decks are gone from the deck-selection screen.
