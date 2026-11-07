## 1. Safety precondition

- [ ] 1.1 Add a function querying every `userdata` row for a given source
      deck code: any `decksStatus` entry with `PullCounter > 0` for that
      deck's numeric `ID`, or any `totalCards[].ID` prefixed with that deck
      code. Return the blocking evidence (device id + what matched), not
      just a boolean.
- [ ] 1.2 Resolve a deck code's numeric `ID` (the `decksStatus`-shape id)
      from the active logic bundle's deck catalog — confirm where this
      mapping already lives (`logicBundle.js`/`loadActive`) before adding a
      new lookup.
- [ ] 1.3 Unit tests: source deck with zero evidence (proceeds), source deck
      with a `PullCounter > 0` entry (blocks), source deck with only a
      `totalCards` id match and `PullCounter` still 0 (blocks — either
      signal alone is sufficient).

## 2. Reassignment operation

- [ ] 2.1 Extract `deckConsolidationMigration.js`'s per-row move logic
      (insert new `card_slots`/`card_content`, repoint
      `minted_notes`/`pending_occurrences`/`staged_occurrences`/
      `occurrence_shipments`, delete old rows) into a shared helper usable
      by both that migration and this new tool.
- [ ] 2.2 Implement the reassignment function: given explicit card ids and
      a destination deck, run the 1.1 precondition check first (refuse with
      no bypass if it fails), then perform the move in one transaction
      using the 2.1 helper, assigning new ids via the destination deck's
      normal next-`card_no` allocation.
- [ ] 2.3 Unit tests: happy path (old rows gone, new rows present under new
      ids, every referencing table repointed); precondition failure (no
      rows touched, transaction never opened); partial-failure rollback
      (simulate a mid-transaction error, confirm no referencing row is left
      pointing at a nonexistent id).

## 3. One-time correction

- [ ] 3.1 Run the precondition check for `C30` against the current
      production `userdata` state; confirm it still passes (re-verify at
      run time, not just against the earlier review's snapshot).
- [ ] 3.2 Run the reassignment for `C30011`→`C20` and `C30012`→`C20`
      (expected new ids `C20005`/`C20006`).
- [ ] 3.3 Run a normal publish; confirm the resulting bundle shows `C30`
      with 33 occurrences and `C20` with 6, and that `C30`'s remaining
      occurrences retain their relative order.
- [ ] 3.4 Spot-check the two reassigned cards' content (`N`/`E`/`X`/`A`)
      matches their current note state post-move.

## 4. Follow-up (tracked, not implemented here)

- [ ] 4.1 File the stabbur-side proposal for preventing a note's `type`
      from being edited once minted, informed by this change's finding that
      stabbur has no current notion of "minted" status.
