## 0. Before you write any code

Read `design.md` in full, especially D-L1 (baked-constant stamping reuses
`src/commands/companion.js`'s existing mechanism — do not build a second
substitution path) and D-L4 (the stateless replay decision and the rejected
incremental-with-full-replay-on-switch alternative). Read
`tun/docs/07-decisions.md` D77, D91, D93 and `tun/docs/03-data-model.md`'s
"Content is regenerated fresh on every publish" section — this change
extends those rules, it must not contradict them. No data migration is
needed anywhere in this change (operator-confirmed: no note has been minted
into a real publish yet).

## 1. Schema

- [ ] 1.1 Migration: `logic_bundles` table (`id, base_version, patch_rev,
      file_path, bundle_sha, label, active, created_at`), per D-L1.
- [ ] 1.2 Migration: `card_content` table (`card_id PK/FK, n, e, x, a,
      updated_at`), per D-L3.
- [ ] 1.3 Migration: `publications.logic_bundle_id` FK to `logic_bundles`,
      per D-L6.
- [ ] 1.4 `hub/src/logicBundles.js`: CRUD + `activate(id)` (clears every
      other row's `active` flag in the same transaction) + `nextPatchRev()`
      (scan-for-max, same pattern as `builder/src/buildId.js`'s
      `nextBuildId`, per D-L2).
- [ ] 1.5 `hub/src/cardContent.js`: `upsert(cardId, {n,e,x,a})`,
      `getAll()` (keyed by card id, for replay).
- [ ] 1.6 Tests: activating a row clears every other row's `active` flag
      in one transaction; `nextPatchRev()` continues across a
      `base_version` change rather than resetting (D-L2's scenario).

## 2. Baked-constant stamping

- [ ] 2.1 `src/commands/companion.js`: extend the placeholder mechanism with
      `__MJOLNIR_BASE_VERSION__`/`__MJOLNIR_PATCH_REV__`, substituted the
      same way `__MJOLNIR_BUILD_ID__` already is. Confirm both can coexist
      in one companion append alongside `BUILD_ID` with no interaction.
- [ ] 2.2 `tool/src/otaPublish.js`: add `findBakedBaseVersion`/
      `findBakedPatchRev`, siblings to the existing `findBakedBuildId`, same
      regex-match-on-bundle-text approach.
- [ ] 2.3 Small `apktool.yml` reader: given a base folder path, return
      `versionInfo.versionName` (confirmed present — `base/smali.mjolnir
      .merged/apktool.yml` has `versionCode: 219` / `versionName: 1.5.12`
      today).
- [ ] 2.4 Tests: a bundle with both constants baked is read correctly by
      both finders; a bundle with neither present returns null from both
      (the "prompt the operator" case); the `apktool.yml` reader against the
      real base folder returns `1.5.12`.

## 3. `builder`'s stateless pipeline

- [ ] 3.1 `builder/src/logicBundle.js`: `loadActive(pool)` — reads the
      active `logic_bundles` row, loads its file fresh (read-only; never
      mutate the stored file in place).
- [ ] 3.2 `builder/src/replay.js`: given the loaded logic bundle + all
      `card_slots`/`card_content`/`occurrence_shipments` (ordered by id)/
      `pending_occurrences`, reconstruct the deck/card data exactly as D-L4
      describes — one card creation + content fill per `card_slots` row,
      occurrences appended to each deck's `Cards[]` in `occurrence_shipments`
      order. Reuses `createCard`/`addOccurrence`/`ensureDeck` from
      `src/injectDeck.js` and `src/deckData.js` — no new injection
      primitives.
- [ ] 3.3 `builder/src/pipeline.js`: `runPublish` calls `loadActive` +
      `replay` at the start of every run instead of `loadDeckCardModel
      (bundlePath)`; the already-minted regen loop now also upserts
      `card_content` (not just updating `card_slots.audio_sha256` as today);
      the newly-minted loop does the same at creation time. Remove
      `BUNDLE_PATH` from `builder/src/config.js`; the working file becomes a
      scratch path generated per run (e.g. a temp file), deleted or
      overwritten freely.
- [ ] 3.4 `builder/src/pipeline.js`: `runForecast` is unaffected in its own
      read-only logic, but confirm it still never touches `logic_bundles`'
      `active` flag or any replay path (it only predicts, per its existing
      spec).
- [ ] 3.5 Tests: a full run (mint → publish → activate a second, different
      logic bundle fixture → publish again) produces a second bundle whose
      deck/card data matches the first run's content and order exactly,
      built onto the new base. A tombstoned-note card's content survives a
      full replay unchanged (reads from `card_content`, not re-projected).
- [ ] 3.6 Re-run the full existing `builder` test suite (`pipeline.test.js`,
      `pendingOccurrences.test.js`, `audioSnapshot.test.js`, etc.) — this
      change touches code several of them already exercise.

## 4. hub's OTA console retarget

- [ ] 4.1 `hub/src/ota.js`: `submitBundle` now creates a `logic_bundles` row
      (reading baked constants per task 2.2, prompting via the UI only if
      absent) instead of writing to `current.json`.
- [ ] 4.2 New `hub/src/ota.js` function: `activateLogicBundle(id)` — thin
      wrapper over `logicBundles.activate`.
- [ ] 4.3 New `hub/src/ota.js` function: `forcePublish(bytes, buildId,
      label)` — the emergency path (D-L5): runs the same shared guards,
      publishes straight to `current.json`, and per the design's resolved
      open question, also writes an inactive `logic_bundles` row for
      provenance.
- [ ] 4.4 `hub/src/server.js` UI: logic-bundle history list (base_version,
      patch_rev, label, active indicator), "activate" action, "submit new"
      drop zone retargeted per 4.1, "force publish" kept as a visually
      distinct, separately-confirmed action per the `ota-console` spec.
- [ ] 4.5 Tests: submitting a bundle creates a `logic_bundles` row and does
      not change `current.json`; activating one does not publish anything on
      its own; force-publish changes `current.json` without touching
      `logic_bundles.active`.

## 5. bundle-workbench assembly UI

- [ ] 5.1 Multi-patch selection UI: pick a base folder, pick an ordered list
      of stored patches (reuses `patch-management`'s existing list/locate/
      apply primitives, looped).
- [ ] 5.2 "Assemble" action: applies the selected patches in order, appends
      the boot-ok companion with `BUILD_ID`/`base_version`/`patch_rev`
      placeholders filled (per task 2.1-2.3), and either saves the output
      locally or submits it directly to hub as a new `logic_bundles` row.
- [ ] 5.3 Tests: assembling from 3 patches against a known base produces one
      bundle reflecting all 3 changes, with baked `base_version` matching
      that base's `apktool.yml` and `patch_rev` one greater than the current
      global max; a patch that fails to locate aborts the assembly with no
      partial output written.

## 6. Sign-off

- [ ] 6.1 Re-run every affected suite in full: `builder`, `hub`, the main
      repo's `test/unit` (companion/otaPublish), bundle-workbench — confirm
      nothing else regressed.
- [ ] 6.2 Update `DEPLOY.md`/`.env.example`: remove `BUNDLE_PATH`, document
      the `logic_bundles` storage directory config and the one-time "submit
      your first logic bundle before builder can publish anything" bootstrap
      step for a fresh deployment.
- [ ] 6.3 If anything here contradicts or refines `design.md`'s decisions
      during implementation, record it as an ADR amendment in
      `tun/docs/07-decisions.md`, per this project's established practice.
