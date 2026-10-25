## 0. Before you write any code — read this first

This change was planned in a long design conversation; these artifacts are
its distillation, but they are not a substitute for the source material. In
order:

1. `tun/docs/03-data-model.md` — the data model. Everything about note
   types, deck allocation, lag-11, and the permanence rules lives here.
2. `tun/docs/07-decisions.md`, **D74 through D80** specifically — every
   design choice in this change traces back to one of these seven ADRs.
   Read them before second-guessing any decision below; if you still think
   one is wrong, record an amendment there (the project's established
   practice — see D65, D71, D72 for the pattern), don't silently diverge.
3. `design.md` in this change, **Context §5 above all** — it points at
   `src/deckData.js` and says, in effect, "a working implementation of the
   hard part already exists, read it before building anything new."
   **Do this. Do not skip it and rebuild shape-matching from scratch.**
4. `mjolnir/docs/findings.md` §1 and C3–C7 — the actual deck/card shapes as
   shipped, and why reordering/renumbering is catastrophic.
5. The parallel change in the `stabbur` repo, `p4-notes` — this change
   depends on its API contract (not its implementation). Read its
   `proposal.md` for the exact `GET /api/notes` response shape before writing
   the fixture in task 4.1.

This change ships **no native code and no new APK**. Nothing here is
irreversible the way P2 was — normal review and iteration applies.

## 1. The shared publish module (D76, D-P2)

- [ ] 1.1 Read `tun/bin/ota-publish.sh` in full (it currently lives in the
      `tun` repo — D75 moves it, but read it at its current location if the
      move hasn't happened yet). Port its guards exactly: buildId regex
      `^[A-Za-z0-9._-]{1,64}$`, no-reuse-with-different-bytes, magic-prefix
      check, https-only enforcement.
- [ ] 1.2 Write `tool/src/otaPublish.js` exporting `validateBuildId`,
      `checkReuse`, `checkMagicPrefix`, `publish` as plain functions. No
      shelling out to bash from here — this is the canonical implementation.
- [ ] 1.3 Add `bin/bundle-tool.js ota-publish <bundle> <buildId> [label]` as
      a thin CLI wrapper over 1.2.
- [ ] 1.4 Replace `ota-publish.sh`'s body with a call to
      `node bin/bundle-tool.js ota-publish "$@"` (D-P4). Confirm identical
      behavior against the existing `bin/ota-verify.sh` acceptance test.
- [ ] 1.5 Move `ota-publish.sh`, `ota-verify.sh`, the `/ota/*`/`/blob/*`
      Caddyfile blocks, and the OTA half of `DEPLOY.md` from `tun` into this
      repo (D75). This is a real deploy-config move — confirm with the
      operator before touching the live VPS config, per this project's
      standing practice around deployment changes.

## 2. `inject-deck` (D79, D-P1)

- [ ] 2.1 **Read all of `src/deckData.js` and its tests
      (`test/unit/deckData.test.js`, `test/unit/deckSave.test.js`) before
      writing anything.** Confirm you understand `locateDeckCardModules`,
      `addOccurrence`, `regenerateModuleSource`, `saveDeckCardModel`,
      `nextDeckId`, `NEW_DECK_DEFAULTS` before proceeding — this task list
      assumes you do.
- [ ] 2.2 Implement `createCard(cards, {id, deckId, type, N, E, X, A})` —
      externally-supplied id, no bundle scan. Validate the id is exactly 6
      characters before inserting (`findings.md` C3).
- [ ] 2.3 Implement `interleaveOccurrences(deck, newCardIds, occurrenceSetFor)`
      — compute an order achieving minimum lag 11 across the new block, then
      call the existing `addOccurrence` once per `(cardId, letter)` pair in
      that order. Do not modify `addOccurrence` itself.
- [ ] 2.4 Implement `upsertCardContent(cards, id, {N, E, X, A})` — find by id,
      overwrite only content fields, throw on zero or multiple matches
      (never silently pick one).
- [ ] 2.5 Wire a new case into `createNewDeck`-equivalent logic using the
      existing `nextDeckId`/`NEW_DECK_DEFAULTS` for the one-time creation of
      C20–C29 (only needed once; after that they exist in the bundle).
- [ ] 2.6 Unit tests for 2.2–2.4 against a fixture bundle, mirroring
      `deckData.test.js`'s existing style. Specifically test: lag-11 holds
      across a 6-card two-occurrence block; upsert on a nonexistent id
      throws; upsert never touches `Cards[]` or `DECK_ID`.
- [ ] 2.7 End-to-end test: create cards + interleave + upsert, then call the
      existing `saveDeckCardModel`, and confirm every module other than the
      two deck/card data modules is byte-identical to the pre-save bundle
      (reuses the guarantee `deck-card-save`'s spec already requires).

## 3. `hub` schema (D-P3)

- [ ] 3.1 Stand up `hub/` as a new Node service (matches `builder`'s runtime
      — D76; `hub` and `builder` share this database, so keeping them in the
      same ecosystem's conventions avoids a second ORM/migration toolchain
      for one database). Confirm this runtime choice doesn't conflict with
      anything in `tun/docs/02-services.md`'s deployment plan before
      proceeding — if it does, flag it rather than silently pick.
- [ ] 3.2 Migrations for `card_slots`, `decks`, `publications`, `build_jobs`,
      `minted_notes` exactly as specified in `design.md` D-P3. No
      `/mjolnir/userdata`, no `device_state`, no `userdata_history` — those
      are P5, out of scope here.
- [ ] 3.3 Seed `decks` with C20–C29 per the allocation table in
      `03-data-model.md` (`enabled` from the start; `Cards: []` until
      `builder`'s first run for each).
- [ ] 3.4 Minimal read API: list `publications`, ordered by `created_at` —
      this is all task 5 (hub's UI) needs.
- [ ] 3.5 `hub`'s operator UI: a single page listing publish history
      (`build_id`, `base_version`, `patch_rev`, `data_rev`, `bundle_sha`,
      `created_at`). Read-only — no publish trigger here, that's `builder`'s
      UI (D80).

## 4. `builder` pipeline

- [ ] 4.1 Write a fixture matching stabbur's `p4-notes` API contract
      (`GET /api/notes?source_lang=no&status=ready&since=…`) — do not wait
      for the real stabbur service to exist. Confirm the fixture shape
      against `p4-notes`'s `proposal.md`/specs in the `stabbur` repo.
- [ ] 4.2 Pull step against the fixture; filter out any note with no
      `audio_blob` (D74 — no type exception).
- [ ] 4.3 Deck assignment: the type/PoS table from `builder/README.md`
      (already rewritten this session), including the C26 catch-all for any
      unmapped `pos`.
- [ ] 4.4 Floor check: hold any deck below 6 newly-eligible (unminted) notes;
      do not mint, do not publish for that deck this run. Persist held notes
      across runs (they're just notes that haven't been minted yet — no
      separate "held" state needed beyond "not yet in `minted_notes`").
- [ ] 4.5 Mint: for decks at/above the floor, insert `card_slots` rows and
      `minted_notes` rows for the newly-eligible notes only.
- [ ] 4.6 Projector: pure function, note type → `{N, E, X, A}` + occurrence
      set, per the table in `03-data-model.md` ("five note/card types").
      Unit-test all five types independently.
- [ ] 4.7 Regenerate content for **every already-minted card**, not just
      the new ones this run — call `upsertCardContent` (task 2.4) for each.
- [ ] 4.8 Call `interleaveOccurrences` (task 2.3) for the newly-minted
      block, then `createCard` (task 2.2) for each new card.
- [ ] 4.9 Save via the existing `saveDeckCardModel` path.
- [ ] 4.10 Build `audio.json` (`{cardId: sha256}`) for every card in the
      bundle, and confirm every referenced blob is present at `/blob/<sha256>`
      — pull any missing blob from stabbur into hub's own per-build snapshot
      (D45).
- [ ] 4.11 Write the `publications` row (task 3.2's schema; version field
      rules from D77/D-P3) and publish via task 1's shared module.
- [ ] 4.12 Write `build_jobs` status throughout (queued → running →
      succeeded/failed), surfaced in `builder`'s UI.
- [ ] 4.13 Nightly clock: run 4.2–4.12 on a schedule; no-op (no
      `build_jobs` row) if no deck has crossed the floor.
- [ ] 4.14 Forecast endpoint/UI: run 4.2–4.4 only (pull, filter, assign,
      floor-check), report per-deck counts, mint and write nothing. Must call
      the *same* functions as 4.2–4.4, not a reimplementation (D-P5) — this
      is the thing to get right, test explicitly that forecast and a
      subsequent real run agree.
- [ ] 4.15 "Publish now" button in the UI: triggers 4.2–4.12 immediately,
      independent of the clock, still subject to the floor.

## 5. Integration and sign-off

- [ ] 5.1 End-to-end against the fixture: hand-craft ≥6 fixture notes for one
      deck, run the full pipeline, confirm the resulting bundle's deck/card
      modules are correct and every other module is untouched.
- [ ] 5.2 Edit one fixture note's content after its card is minted, re-run,
      confirm the regenerated content reaches the card while its id and
      `Cards[]` position stay fixed.
- [ ] 5.3 Confirm `bin/ota-verify.sh` still passes 16/16 after the D75 move
      — this is the regression test that matters most, since it's the one
      thing that would silently break OTA for the already-installed app.
- [ ] 5.4 Once `stabbur`'s `p4-notes` change has actually shipped a real
      `GET /api/notes` endpoint, swap the fixture for the real service and
      re-run 5.1–5.2 against it.
- [ ] 5.5 Record any decision made during implementation that contradicts or
      refines this design as an ADR amendment in `tun/docs/07-decisions.md`
      — never a silent deviation. This project's established practice (D65,
      D71, D72, D73) treats "found a real gap while building" as a normal,
      expected outcome to document, not a failure to hide.
