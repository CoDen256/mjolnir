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

- [x] 1.1 Read `tun/bin/ota-publish.sh` in full (it currently lives in the
      `tun` repo — D75 moves it, but read it at its current location if the
      move hasn't happened yet). Port its guards exactly: buildId regex
      `^[A-Za-z0-9._-]{1,64}$`, no-reuse-with-different-bytes, magic-prefix
      check, https-only enforcement.
- [x] 1.2 Write `tool/src/otaPublish.js` exporting `validateBuildId`,
      `checkReuse`, `checkMagicPrefix`, `publish` as plain functions. No
      shelling out to bash from here — this is the canonical implementation.
- [x] 1.3 Add `bin/bundle-tool.js ota-publish <bundle> <buildId> [label]` as
      a thin CLI wrapper over 1.2.
- [x] 1.4 Replace `ota-publish.sh`'s body with a call to
      `node bin/bundle-tool.js ota-publish "$@"` (D-P4). Confirmed behavior-
      preserving locally (smoke test, task 1 unit tests); the on-VPS
      `bin/ota-verify.sh` re-run still needs to happen after deploying (noted
      in both repos' DEPLOY.md status banners).
- [x] 1.5 Move `ota-publish.sh`, `ota-verify.sh`, the `/ota/*`/`/blob/*`
      Caddyfile blocks, and the OTA half of `DEPLOY.md` from `tun` into this
      repo (D75). Done per operator confirmation. First pass (D81) kept `tun`
      owning the single compose/Caddy stack with `mjolnir`'s pieces mounted
      in via a sibling-checkout + Caddy `import` — the operator then
      corrected this: `tun` is never deployed at all, so `mjolnir` should own
      the **entire** deployable stack outright, not a piece of one split
      across repos. Redone per **D84** (supersedes D75/D81): `tun` now ships
      zero deployable artifacts — `compose.yaml`, `caddy/Caddyfile` (one
      file, no `import`), `DEPLOY.md`, `.env.example` all live here, nothing
      left behind. Not yet applied to the live VPS — these are repo changes
      only; actual deploy is a separate operator action.

## 2. `inject-deck` (D79, D-P1)

- [x] 2.1 **Read all of `src/deckData.js` and its tests
      (`test/unit/deckData.test.js`, `test/unit/deckSave.test.js`) before
      writing anything.** Confirm you understand `locateDeckCardModules`,
      `addOccurrence`, `regenerateModuleSource`, `saveDeckCardModel`,
      `nextDeckId`, `NEW_DECK_DEFAULTS` before proceeding — this task list
      assumes you do.
- [x] 2.2 Implement `createCard(cards, {id, deckId, N, E, D, X, A})` —
      externally-supplied id, no bundle scan. Validate the id is exactly 6
      characters before inserting (`findings.md` C3). (Signature uses `D`,
      not `type` — `D` is the persisted card field, findings.md §1; `type` is
      a stabbur-note concept the projector consumes upstream, not part of the
      card's own shape — `src/injectDeck.js`.)
- [x] 2.3 Implement `interleaveOccurrences(deck, newCardIds, occurrenceSetFor)`
      — compute an order achieving minimum lag 11 across the new block, then
      call the existing `addOccurrence` once per `(cardId, letter)` pair in
      that order. Do not modify `addOccurrence` itself.
- [x] 2.4 Implement `upsertCardContent(cards, id, {N, E, X, A})` — find by id,
      overwrite only content fields, throw on zero or multiple matches
      (never silently pick one).
- [x] 2.5 Wire a new case into `createNewDeck`-equivalent logic using the
      existing `nextDeckId`/`NEW_DECK_DEFAULTS` for the one-time creation of
      C20–C29 (only needed once; after that they exist in the bundle).
      (`ensureDeck` in `src/injectDeck.js`, mirroring `ui.js`'s `POST /decks`.)
- [x] 2.6 Unit tests for 2.2–2.4 against a fixture bundle, mirroring
      `deckData.test.js`'s existing style. Specifically test: lag-11 holds
      across a 6-card two-occurrence block; upsert on a nonexistent id
      throws; upsert never touches `Cards[]` or `DECK_ID`. (The 6-card/lag-11
      combination as literally stated is unreachable: 6 cards × 2 occurrences
      = 12 slots, and no arrangement can give every one of 6 pairs an 11-gap
      within a 12-slot sequence — the provable maximum minimum-lag for 6
      pairs is 6. Tested both: lag ≥ 11 on a block large enough to allow it
      (23 cards), and that the 6-card floor case reaches the maximum
      lag the slot count allows (6) without crashing or silently stalling —
      `test/unit/injectDeck.test.js`.)
- [x] 2.7 End-to-end test: create cards + interleave + upsert, then call the
      existing `saveDeckCardModel`, and confirm every module other than the
      two deck/card data modules is byte-identical to the pre-save bundle
      (reuses the guarantee `deck-card-save`'s spec already requires).

## 3. `hub` schema (D-P3)

- [x] 3.1 Stand up `hub/` as a new Node service (matches `builder`'s runtime
      — D76; `hub` and `builder` share this database, so keeping them in the
      same ecosystem's conventions avoids a second ORM/migration toolchain
      for one database). Confirm this runtime choice doesn't conflict with
      anything in `tun/docs/02-services.md`'s deployment plan before
      proceeding — if it does, flag it rather than silently pick.
      (`02-services.md` already specifies Node + a separate postgres logical
      DB for `mjolnir-hub` — no conflict. Plain `pg` + hand-rolled numbered-
      SQL migrations, no ORM, matching this project's "vendored, not a
      package" simplicity elsewhere. `docker compose` service entries for
      `mjolnir-hub`/`mjolnir-builder` are still commented out in `tun`'s
      `compose.yaml` — out of scope for this task, flagged for task 5.5.)
- [x] 3.2 Migrations for `card_slots`, `decks`, `publications`, `build_jobs`,
      `minted_notes` exactly as specified in `design.md` D-P3. No
      `/mjolnir/userdata`, no `device_state`, no `userdata_history` — those
      are P5, out of scope here. (`hub/migrations/001_init.sql`, applied via
      `hub/bin/migrate.js`; verified end-to-end against a throwaway postgres
      container, plus `hub/test/hub.test.js`, skipped gracefully without
      `DATABASE_URL`.)
- [x] 3.3 Seed `decks` with C20–C29 per the allocation table in
      `03-data-model.md` (`enabled` from the start; `Cards: []` until
      `builder`'s first run for each). (`hub/src/decks.js` + `hub/bin/seed.js`,
      idempotent — `ON CONFLICT DO NOTHING` so a re-run never clobbers an
      operator-edited pacing knob. The bundle-side `Cards: []`/deck creation
      is `ensureDeck`, task 2.5 — this table only holds hub's own metadata.)
- [x] 3.4 Minimal read API: list `publications`, ordered by `created_at` —
      this is all task 5 (hub's UI) needs. (`hub/src/publications.js`,
      `GET /mjolnir/api/publications`.)
- [x] 3.5 `hub`'s operator UI: a single page listing publish history
      (`build_id`, `base_version`, `patch_rev`, `data_rev`, `bundle_sha`,
      `created_at`). Read-only — no publish trigger here, that's `builder`'s
      UI (D80). (`hub/src/server.js`, `GET /mjolnir/`, server-rendered HTML
      table, no client JS needed for a read-only list.)

## 4. `builder` pipeline

- [x] 4.1 Write a fixture matching stabbur's `p4-notes` API contract
      (`GET /api/notes?source_lang=no&status=ready&since=…`) — do not wait
      for the real stabbur service to exist. Confirm the fixture shape
      against `p4-notes`'s `proposal.md`/specs in the `stabbur` repo.
      (`builder/test/fixtures/stabburNotes.js`, matched field-for-field
      against `stabbur/openspec/changes/p4-notes/design.md` D-N4. `since` is
      accepted by `stabburClient.js` but the pipeline itself never passes it
      — every run does a full pull, since regenerating *every* already-minted
      card's content (task 4.7) needs each one's current state anyway, and
      note counts are small enough that this is cheap. Checked: no
      `grammar_rule` content-fetch endpoint exists anywhere in `p4-notes`'s
      specs, only `grammar_rule_id` — flagged under 4.6.)
- [x] 4.2 Pull step against the fixture; filter out any note with no
      `audio_blob` (D74 — no type exception). (`stabburClient.js`.)
- [x] 4.3 Deck assignment: the type/PoS table from `builder/README.md`
      (already rewritten this session), including the C26 catch-all for any
      unmapped `pos`. (`deckAssignment.js` — scoped the catch-all to
      `type=word` notes only, matching `03-data-model.md`'s and
      `builder/README.md`'s own tables; a non-word type always goes to its
      fixed deck regardless of `pos`, never C26.)
- [x] 4.4 Floor check: hold any deck below 6 newly-eligible (unminted) notes;
      do not mint, do not publish for that deck this run. Persist held notes
      across runs (they're just notes that haven't been minted yet — no
      separate "held" state needed beyond "not yet in `minted_notes`").
      (`eligibility.js`.)
- [x] 4.5 Mint: for decks at/above the floor, insert `card_slots` rows and
      `minted_notes` rows for the newly-eligible notes only. (`mint.js`,
      row-locks the deck's own `decks` row to serialize concurrent mints into
      the same deck — answers the design.md Open Question on `build_jobs`
      locking: the publish path itself is synchronous end-to-end per request,
      so this lock is the only concurrency guard needed, not a job queue.)
- [x] 4.6 Projector: pure function, note type → `{N, E, X, A}` + occurrence
      set, per the table in `03-data-model.md` ("five note/card types").
      Unit-test all five types independently. (`projector.js`. **Gap found
      and flagged, not silently guessed around**: stabbur's p4-notes read API
      returns only `grammar_rule_id`, never the `grammar_rule` row's
      `title`/`html` — no endpoint in that change's specs exposes it. Until
      stabbur adds one, `type=grammar` notes project with a visible
      placeholder naming the rule id instead of its content; the projector
      accepts an optional `grammarRuleLookup(id)` so wiring the real content
      in later is a one-line change at the call site, not a rewrite. Needs a
      follow-up change in `stabbur` once this is noticed in practice.)
- [x] 4.7 Regenerate content for **every already-minted card**, not just
      the new ones this run — call `upsertCardContent` (task 2.4) for each.
      (`pipeline.js`'s `runPublish`; also refreshes `card_slots.audio_sha256`
      for any still-present note, task 4.10's follow-on.)
- [x] 4.8 Call `interleaveOccurrences` (task 2.3) for the newly-minted
      block, then `createCard` (task 2.2) for each new card. (`pipeline.js`.)
- [x] 4.9 Save via the existing `saveDeckCardModel` path. (`pipeline.js`.)
- [x] 4.10 Build `audio.json` (`{cardId: sha256}`) for every card in the
      bundle, and confirm every referenced blob is present at `/blob/<sha256>`
      — pull any missing blob from stabbur into hub's own per-build snapshot
      (D45). (`audioSnapshot.js`. Required a small schema addition beyond
      what task 3.2 scoped — `card_slots.audio_sha256` — since a card is
      permanent even after its source note is tombstoned on stabbur, and the
      manifest needs to cover the *whole* bundle, not just this run's pull;
      added as `hub/migrations/002_card_slots_audio.sql`, additive, no
      existing row's meaning changed.)
- [x] 4.11 Write the `publications` row (task 3.2's schema; version field
      rules from D77/D-P3) and publish via task 1's shared module.
      (`publications.js` + `buildId.js`, `pipeline.js` calls
      `tool/src/otaPublish.js`'s `publish()` in-process per D76/D-P2.)
- [x] 4.12 Write `build_jobs` status throughout (queued → running →
      succeeded/failed), surfaced in `builder`'s UI. (`buildJobs.js`,
      `server.js`'s `/builder` page. Simplification flagged: a job goes
      straight to `running` rather than sitting in `queued` first, since the
      whole pipeline runs synchronously within one HTTP request/the clock's
      own tick — there is no decoupled worker loop to queue in front of, per
      02-services.md's "no Redis/Celery for one operator." `queued` stays a
      valid `build_jobs.status` value for if that ever changes.)
- [x] 4.13 Nightly clock: run 4.2–4.12 on a schedule; no-op (no
      `build_jobs` row) if no deck has crossed the floor. (`clock.js`,
      `setInterval` — simplest thing that satisfies a single-operator nightly
      check; doesn't attempt wall-clock-midnight precision.)
- [x] 4.14 Forecast endpoint/UI: run 4.2–4.4 only (pull, filter, assign,
      floor-check), report per-deck counts, mint and write nothing. Must call
      the *same* functions as 4.2–4.4, not a reimplementation (D-P5) — this
      is the thing to get right, test explicitly that forecast and a
      subsequent real run agree. (`pipeline.js`'s `runForecast` and
      `runPublish` both call the same `pullAndAssign` helper — verified by
      `builder/test/pipeline.test.js`: a forecast reporting 4/6 mints
      nothing, and a subsequent run that crosses the floor mints exactly what
      the forecast counted.)
- [x] 4.15 "Publish now" button in the UI: triggers 4.2–4.12 immediately,
      independent of the clock, still subject to the floor. (`server.js`,
      `POST /builder/api/publish` calls the same `runPublish` the clock
      calls.)

## 5. Integration and sign-off

- [x] 5.1 End-to-end against the fixture: hand-craft ≥6 fixture notes for one
      deck, run the full pipeline, confirm the resulting bundle's deck/card
      modules are correct and every other module is untouched.
      (`builder/test/pipeline.test.js`, "crossing the floor mints,
      interleaves, saves, and publishes" — verified against a real postgres
      and a fake stabbur HTTP server, not mocks. Added an unrelated third
      module to the fixture bundle specifically to prove byte-identity,
      mirroring `test/e2e/injectDeck.test.js`'s existing pattern.)
- [x] 5.2 Edit one fixture note's content after its card is minted, re-run,
      confirm the regenerated content reaches the card while its id and
      `Cards[]` position stay fixed. (Same file, "editing an already-minted
      note's content..." — also confirms the deck's occurrence count doesn't
      grow from a content-only regen.)
- [ ] 5.3 Confirm `bin/ota-verify.sh` still passes 16/16 after the D75/D84
      move — this is the regression test that matters most, since it's the
      one thing that would silently break OTA for the already-installed app.
      **Blocked on operator action, current status:**
      - This environment has no network path to the live VPS — `ota-verify.sh`
        needs a real host with DNS + TLS already issued (`tun/DEPLOY.md`'s
        prior "deployed and verified, 2026-10-20" state, now superseded in
        layout by D84). Nothing to run it against from here.
      - What *is* verified here instead: `tool/src/otaPublish.js` reproduces
        `ota-publish.sh`'s exact guards byte-for-byte in behavior (unit tests,
        task 1 — buildId regex, magic prefix, no-reuse-with-different-bytes,
        https-only, companion-id match), and the moved
        `bin/ota-publish.sh`/`bin/ota-verify.sh` run end-to-end against a
        local fixture bundle + fixture data dir (task 1.4's smoke test, and
        `builder/test/pipeline.test.js`'s full publish flow).
      - **What the operator still needs to do**: deploy `mjolnir`'s new
        `compose.yaml`/`caddy/Caddyfile` (D84 — `tun`'s old stack must be
        torn down first if it's still running, since both would otherwise
        fight over ports 80/443 on the same box) and re-run
        `bin/ota-verify.sh` against the live host. Expected to still print
        16/16 — nothing in the Caddy routes or publish guards changed
        behaviorally, only which repo they live in — but this is the one
        claim in this whole change that only a live run can actually prove.
- [ ] 5.4 Once `stabbur`'s `p4-notes` change has actually shipped a real
      `GET /api/notes` endpoint, swap the fixture for the real service and
      re-run 5.1–5.2 against it. **Blocked**: `stabbur/openspec/changes/
      p4-notes` is still only proposed (proposal/design/specs exist, no
      implementation) as of this session — confirmed by reading that repo
      directly. `builder/test/fixtures/stabburNotes.js` was built field-for-
      field against that change's documented D-N4 contract specifically so
      this swap is mechanical once it ships: point `STABBUR_BASE_URL` at the
      real service, nothing in `builder`'s own code should need to change.
- [x] 5.5 Record any decision made during implementation that contradicts or
      refines this design as an ADR amendment in `tun/docs/07-decisions.md`
      — never a silent deviation. This project's established practice (D65,
      D71, D72, D73) treats "found a real gap while building" as a normal,
      expected outcome to document, not a failure to hide. (D81: the
      tun/mjolnir deploy-layout gap from task 1.5, itself superseded by
      **D84** once the operator corrected the premise — `tun` is never
      deployed, so `mjolnir` owns the whole stack, not a cross-repo split.
      D83: the grammar_rule content-fetch gap from task 4.6, a cross-repo
      follow-up for `stabbur`. Smaller in-repo findings — the
      `card_slots.audio_sha256` schema addition, the `build_jobs`
      queued-vs-running simplification, the per-deck row-lock answering
      D-P3's "does build_jobs need locking" open question — are recorded
      inline in this file at tasks 4.5/4.10/4.12 rather than as separate
      top-level ADRs, matching the scale of each.)

## 6. Findings from an independent architectural review (2026-10-25)

Four real, unaddressed gaps found reading the shipped implementation
end-to-end against the spec and `tun/docs`, after section 5 was closed out.
Recorded as **D86–D90** in `tun/docs/07-decisions.md` — read those for full
context before starting any of these; this section is the task-list
distillation, not the reasoning. **D87 and D88 (6.2/6.3 below) were since
resolved together as D91** — the mint floor is removed entirely and replaced
with a cross-batch persisted-queue mechanism; read D91 and
`03-data-model.md`'s rewritten interleave section before starting 6.2.

Two things raised by the same review were considered and explicitly
**declined** by the operator (D90): locking between concurrent publish runs,
and authentication on the operator-facing endpoints. Do not re-add these as
tasks — if you find yourself wanting to, re-read D90 first; the preconditions
it names (single operator, endpoints not yet wired into Caddy) are what would
need to change first.

- [ ] 6.1 **(D86 — fix the unbounded blast radius of a mid-run failure.)**
      `mintCardSlots` commits per-deck, independently of the bundle
      save/publish that happens once, after the whole loop in `runPublish`.
      A throw anywhere after an early deck's commit leaves `card_slots`/
      `minted_notes` naming a card that was never written into any bundle —
      and the next run's regeneration step throws on that id forever, with
      no self-recovery. Fix: either make the whole mint→save→publish
      sequence one transaction (requires `mintCardSlots` to accept a shared
      client instead of opening `BEGIN`/`COMMIT` itself), or make the
      regeneration path in `runPublish`'s `alreadyMinted` loop tolerant of
      "minted but missing from this bundle" by re-running `createCard`
      instead of `upsertCardContent` for that one id. Write a test that
      deliberately throws partway through a multi-deck publish and asserts
      the *next* run still succeeds.
- [ ] 6.2 **(D91 — resolves D87+D88 together. Remove the mint floor entirely;
      replace same-batch interleaving with a cross-batch persisted queue.)**
      Supersedes 6.2/6.3 as originally written — read `tun/docs/
      03-data-model.md`'s "Appending new cards to an existing deck" section
      (rewritten for D91) before starting; this task is its implementation,
      not a fresh design.
      1. **Schema**: new `pending_occurrences` table in `hub` (`deck_code,
         card_id, letter, remaining`), migration alongside the existing
         `card_slots`/`decks`/`publications`/`build_jobs`.
      2. **`eligibility.js`**: delete `MINT_FLOOR` and `decksCrossingFloor`
         entirely — every deck with ≥1 newly-eligible note mints and
         publishes this run, no threshold of any kind.
      3. **`projector.js`**: word/expression's `occurrences` becomes
         `["A", "E"]` (drop `"N"`). Confirm the `N` *field* stays in the
         projected `{N,E,X,A}` content — only the occurrence/quiz list
         shrinks, not the card's content shape.
      4. **Mint path** (`pipeline.js`/`mint.js`): on minting a new card,
         `createCard` + `addOccurrence(deck, cardId, "A")` happen
         immediately, same run. Do **not** call `addOccurrence` for `"E"`
         — instead insert `{deck_code, card_id, letter: "E", remaining: 11}`
         into `pending_occurrences`.
      5. **Drain step**, once per deck, per run, after the mint step: count
         new `A`'s added to that deck this run (`newACount`). If
         `newACount > 0`, run `UPDATE pending_occurrences SET remaining =
         remaining - $newACount WHERE deck_code = $deck`, then select every
         row now at `remaining <= 0`, call `addOccurrence(deck, cardId,
         "E")` for each, and delete those rows. A deck with `newACount = 0`
         this run touches nothing in its queue (correct — see the design
         doc's reasoning).
      6. **`interleaveOccurrences`** (`injectDeck.js`): this function's
         original job — ordering a same-batch block for 3-occurrence lag —
         no longer has a caller once step 4/5 land (every new occurrence
         append is now either a single immediate `A` or a single drained
         `E`, never a same-batch block needing internal ordering). Either
         delete it or repurpose it for the (now simpler) case of ordering
         multiple same-run `A`'s/drained `E`'s within one deck — check which
         before removing anything already tested.
      7. **Tests**: a 2-note publish immediately ships both `A`'s and queues
         both `E`'s at `remaining=11`; a subsequent run with 1 new note in
         the same deck decrements the two pending rows to 10 and queues the
         new card's own `E` at 11; a run with enough cumulative new cards to
         cross 11 drains the oldest `E` and nothing else; a deck with zero
         new cards in a run leaves its queue numerically unchanged; a
         `listening`/`pronunciation`/`grammar` note never touches
         `pending_occurrences` at all.
      8. **Forecast UI** (`server.js`/`runForecast`): since there's no floor
         to report crossing/not-crossing, replace that language with
         eligible-note counts per deck plus each deck's current
         `pending_occurrences` depth (useful operator signal: "C20 has 40
         E's queued, oldest one has 3 to go").
- [ ] 6.4 **(D89 — wire `grammarRuleLookup` to the endpoint that already
      exists.)** `stabbur`'s `GET /api/grammar_rules` has existed since
      `p4-notes`'s first implementation commit; nothing in `builder` calls
      it. Add a small client function alongside `stabburClient.js` (fetch
      the list once per run, build an `id → {title, html}` map), pass it as
      `grammarRuleLookup` from `server.js`/`clock.js`'s call sites into
      `runPublish`/`runForecast`. Confirm with a real `type=grammar` note
      (fixture or real) that the placeholder text never appears once this
      lands.
- [ ] 6.5 Minor, lower priority — pick up opportunistically, not blocking
      anything above: link `builder`'s forecast page and `hub`'s history
      page to each other (no shared nav today, despite `02-services.md`'s
      stated plan for one); show a one-line summary of what's about to
      publish in the "publish now" confirmation flow, not just a disabled
      button during the request; wire `pullNotes`'s unused `since` parameter
      or explicitly document why it's intentionally unused (full pull every
      run, relying on `minted_notes` rather than incremental fetch).
