import { loadDeckCardModel, saveDeckCardModel, addOccurrence } from "../../src/deckData.js";
import { createCard, upsertCardContent, ensureDeck } from "../../src/injectDeck.js";
import { publish, restampCompanionBuildId } from "../../tool/src/otaPublish.js";
import { pullNotes, filterAudioEligible } from "./stabburClient.js";
import { partitionByDeck } from "./eligibility.js";
import { project } from "./projector.js";
import { mintCardSlots, cardIdsForNotes, updateAudioSha256, allCardAudio, deckTitle } from "./mint.js";
import { queuePendingOccurrence, hasPendingOccurrence, drainPendingOccurrences, pendingQueueDepths } from "./pendingOccurrences.js";
import { stageOccurrence, stagedCount, flushShippable, peekStaged } from "./stagedOccurrences.js";
import { recordShipments } from "./occurrenceShipments.js";
import { previousVersions, writePublication } from "./publications.js";
import { createBuildJob, markSucceeded, markFailed } from "./buildJobs.js";
import { nextBuildId } from "./buildId.js";
import { ensureBlobsPresent, writeAudioManifest, writePublicAudioManifest } from "./audioSnapshot.js";
import { loadActive } from "./logicBundle.js";
import { replay } from "./replay.js";
import { upsert as upsertCardContentRow, getAll as getAllCardContent, contentChanged } from "./cardContent.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// Steps 1-4 of builder/README.md's "what a run does" — pull, filter, split
// into already-minted vs newly-eligible, group the latter by deck. Shared
// verbatim between the forecast and a real run (D-P5): one implementation of
// "which notes are eligible and where do they go," two call sites.
async function pullAndAssign(pool, { stabburBaseUrl, stabburAuthToken, sourceLang }) {
  // `since` is deliberately never passed: every run does a full pull, since
  // regenerating every already-minted card's content (not just new ones)
  // needs each note's current state anyway, and note counts are small
  // enough that this is cheap (task 4.1's finding).
  const notes = await pullNotes({ baseUrl: stabburBaseUrl, authToken: stabburAuthToken, sourceLang });
  const eligible = filterAudioEligible(notes);

  const { rows } = await pool.query("SELECT note_id FROM minted_notes WHERE note_id = ANY($1)", [
    eligible.map((n) => n.id),
  ]);
  const mintedNoteIds = new Set(rows.map((r) => r.note_id));

  return { eligibleNotesById: new Map(eligible.map((n) => [n.id, n])), ...partitionByDeck(eligible, mintedNoteIds) };
}

// D91: for a freshly-minted card, its `A` occurrence always ships this run
// ("A always first"); anything else in a multi-occurrence set (word/
// expression's `E`) is queued cross-batch instead. A single-occurrence
// type's one letter — whatever it is — always ships immediately, since
// there's nothing of its own to space against.
function splitOccurrences(occurrences) {
  if (occurrences.length <= 1) return { immediate: occurrences, queued: [] };
  return { immediate: occurrences.filter((l) => l === "A"), queued: occurrences.filter((l) => l !== "A") };
}

// builder-sliding-window-shipping (D-W3): stages `occurrences`' immediate
// letters instead of appending them straight to `deck.Cards[]` — minting
// stays exactly as fast/immediate as before this change; only the actual
// `Cards[]` append (and D93 shipment recording) moves to the once-per-deck
// flush step below. Returns the list of `{letter}` entries still to be
// queued, plus how many brand-new `A`'s were just staged (the drain step's
// decrement count).
async function stageImmediateOccurrences(pool, deckCode, cardId, occurrences) {
  const { immediate, queued } = splitOccurrences(occurrences);
  for (const letter of immediate) await stageOccurrence(pool, { deckCode, cardId, letter });
  return { queued, newACount: immediate.filter((l) => l === "A").length };
}

// Drains `deckCode`'s *existing* queue by `newACount`, staging every row
// that reaches `remaining <= 0` (D-W3 — same staging step as fresh
// immediate letters, not appended directly), then queues `toQueue`'s rows
// fresh at `remaining: 11` — in that order, so a card's own just-queued `E`
// is never decremented by the very batch of `A`'s that created it
// (03-data-model.md's worked example: "a queued E draining in the same run
// does not count toward another queued E's countdown"). `hasPendingOccurrence`
// guards the D86 recovery path against double-queuing a row a prior, crashed
// run may already have written durably before failing.
async function drainThenQueue(pool, deckCode, newACount, toQueue) {
  if (newACount > 0) {
    const drained = await drainPendingOccurrences(pool, deckCode, newACount);
    for (const { cardId, letter } of drained) {
      await stageOccurrence(pool, { deckCode, cardId, letter });
    }
  }
  for (const { cardId, letter } of toQueue) {
    if (!(await hasPendingOccurrence(pool, cardId, letter))) {
      await queuePendingOccurrence(pool, { deckCode, cardId, letter, remaining: 11 });
    }
  }
}

// builder-sliding-window-shipping (D-W2): once per deck per run, after that
// deck's minting/draining/staging is done — flushes the largest multiple of
// 5 it currently holds into `deck.Cards[]`, pushing each onto `shipments`
// (D93's log, now recorded only for what's actually flushed this run, per
// `occurrence-shipment-log`'s MODIFIED delta). Logs instead, no other
// action, when the deck has staged occurrences but not enough to reach the
// next multiple of 5 yet.
async function flushDeck(pool, model, deckCode, deckTitleCache, shipments, log, buildJobId) {
  if (!deckTitleCache.has(deckCode)) deckTitleCache.set(deckCode, await deckTitle(pool, deckCode));
  const deck = ensureDeck(model.decks, { name: deckCode, title: deckTitleCache.get(deckCode) });
  // The deck's REAL current total matters, not just what's sitting staged —
  // see stagedOccurrences.js's flushShippable for why (a deck that was
  // already off the 5-grid before this mechanism existed needs the target
  // computed against its true total to ever land back on the grid).
  const alreadyShipped = deck.Cards.length;
  const shippable = await flushShippable(pool, deckCode, alreadyShipped);
  if (shippable.length === 0) {
    const staged = await stagedCount(pool, deckCode);
    if (staged > 0) {
      await log(
        buildJobId,
        `ship: ${deckCode} — ${staged} occurrence(s) staged (${alreadyShipped} already shipped), short of the next multiple of 5, held`
      );
    }
    return;
  }
  for (const { cardId, letter } of shippable) {
    addOccurrence(deck, cardId, letter);
    shipments.push({ cardId, letter });
  }
  await log(buildJobId, `ship: ${deckCode} — ${shippable.length} occurrence(s) flushed (${alreadyShipped} -> ${deck.Cards.length})`);
}

// Task 4.14/3.2 (modified builder-pipeline spec): dry run of steps 1-4 only —
// mints and writes nothing, but now reports the actual `(card, side, note)`
// occurrences that would become eligible and the ones that would be newly
// queued, instead of a per-deck count (D-H2: a card's two sides routinely
// belong to different batches, so a count can't represent the real unit).
// Predicted card ids use the exact same `deck_code||card_no` scheme
// `mintCardSlots` uses, read-only (no row inserted) — D-P5's "one
// implementation, two call sites" extends to card-id prediction too, not
// just eligibility.
//
// builder-sliding-window-shipping (task 3.1): becoming eligible no longer
// means shipping immediately — it means getting staged, and only the
// largest multiple of 5 a deck holds (existing staged rows + what this run
// would newly stage) actually flushes. `wouldShip` entries now carry
// `willShipThisRun` so a caller can't mistake "eligible" for "ships today";
// `byDeck` gains `stagedBeforeThisRun`/`wouldFlushCount`/`wouldHoldCount` so
// the sliding-window state is visible without inspecting `wouldShip` at all.
export async function runForecast(pool, { stabburBaseUrl, stabburAuthToken, sourceLang = "no" } = {}) {
  const { newlyEligibleByDeck, alreadyMinted } = await pullAndAssign(pool, { stabburBaseUrl, stabburAuthToken, sourceLang });
  const queueDepths = await pendingQueueDepths(pool);

  const wouldShip = [];
  const wouldQueue = [];
  const byDeck = [];

  // A deck with a real, nonzero pending-occurrence queue depth but zero
  // newly-eligible notes today must still be reported — `queueDepths` is
  // computed independently of `newlyEligibleByDeck`, so iterating only the
  // latter silently dropped such decks from the forecast entirely (the
  // confirmed bug: data was always correct in `pending_occurrences`, it was
  // just never reaching this loop to be reported).
  const deckCodes = new Set([...newlyEligibleByDeck.keys(), ...queueDepths.keys()]);
  for (const deckCode of deckCodes) {
    const notes = newlyEligibleByDeck.get(deckCode) || [];
    const { rows } = await pool.query("SELECT COALESCE(MAX(card_no), 0) AS max_no FROM card_slots WHERE deck_code = $1", [
      deckCode,
    ]);
    let nextNo = Number(rows[0].max_no) + 1;
    let newACount = 0;
    const deckEligible = [];

    for (const note of notes) {
      const cardId = `${deckCode}${String(nextNo).padStart(3, "0")}`;
      nextNo += 1;
      const { immediate, queued } = splitOccurrences(project(note, {}).occurrences);
      for (const letter of immediate) {
        deckEligible.push({ cardId, letter, deckCode, noteId: note.id, noteText: note.text, reason: "new card" });
        if (letter === "A") newACount += 1;
      }
      for (const letter of queued) {
        wouldQueue.push({ cardId, letter, deckCode, noteId: note.id, noteText: note.text, remaining: 11 });
      }
    }

    if (newACount > 0) {
      const { rows: pending } = await pool.query(
        "SELECT card_id, letter, remaining FROM pending_occurrences WHERE deck_code = $1",
        [deckCode]
      );
      for (const p of pending) {
        if (p.remaining - newACount <= 0) {
          deckEligible.push({
            cardId: p.card_id,
            letter: p.letter,
            deckCode,
            noteId: null,
            noteText: null,
            reason: "queue drained",
          });
        }
      }
    }

    // D-W2 simulated: existing staged rows ship first (FIFO), then whatever
    // this run would newly stage, in the same order the real pipeline
    // stages it (fresh immediate letters before queue-drained ones — matches
    // `deckEligible`'s own push order above). The flush target is computed
    // against the deck's REAL current total (already-shipped + staged), not
    // just the staged count in isolation — same fix as `flushShippable`
    // itself, so the forecast never shows a deck "flushing" an amount that
    // wouldn't actually land it on the next multiple of 5.
    const existingStaged = await peekStaged(pool, deckCode);
    const { rows: shippedRows } = await pool.query(
      "SELECT count(*) AS count FROM occurrence_shipments os JOIN card_slots cs ON cs.id = os.card_id WHERE cs.deck_code = $1",
      [deckCode]
    );
    const alreadyShipped = Number(shippedRows[0].count);
    const stagedTotal = existingStaged.length + deckEligible.length;
    const target = Math.floor((alreadyShipped + stagedTotal) / 5) * 5;
    const shipCount = Math.max(0, Math.min(stagedTotal, target - alreadyShipped));
    const newlyStagedShipCount = Math.max(0, shipCount - existingStaged.length);
    deckEligible.forEach((entry, i) => {
      wouldShip.push({ ...entry, willShipThisRun: i < newlyStagedShipCount });
    });

    const queue = queueDepths.get(deckCode);
    byDeck.push({
      deckCode,
      newlyEligibleCount: notes.length,
      pendingQueueDepth: queue ? queue.depth : 0,
      pendingOldestRemaining: queue ? queue.oldestRemaining : null,
      alreadyShipped,
      stagedBeforeThisRun: existingStaged.length,
      wouldFlushCount: shipCount,
      wouldHoldCount: stagedTotal - shipCount,
    });
  }

  // D-C2: which already-minted cards would have their content actually
  // changed by the next publish — a note edit, or a projector/template
  // change, both show up here identically, since this is a pure
  // project()-then-compare, the same content a real publish would write.
  const cardIdByNoteId = await cardIdsForNotes(pool, alreadyMinted.map((n) => n.id));
  const existingContent = await getAllCardContent(pool);
  const wouldUpdate = [];
  for (const note of alreadyMinted) {
    const entry = cardIdByNoteId.get(note.id);
    if (!entry) continue;
    const content = project(note, {});
    if (contentChanged(existingContent.get(entry.cardId), content)) {
      wouldUpdate.push({ cardId: entry.cardId, deckCode: entry.deckCode, noteId: note.id, noteText: note.text });
    }
  }

  return { wouldShip, wouldQueue, byDeck, wouldUpdate };
}

// The real run: tasks 4.2-4.12. No floor (D91) — triggered by either the
// nightly clock or the manual button (task 4.13/4.15), this function is the
// one thing both call.
export async function runPublish(
  pool,
  {
    stabburBaseUrl,
    stabburAuthToken,
    sourceLang = "no",
    dataDir,
    publicBase,
    grammarRuleLookup,
    // D-H4: `(buildJobId, line) => {}` — called at each narration checkpoint
    // once a build job exists. `buildJobId` is passed to every call since
    // the caller can't know it in advance (it's created inside this
    // function); `server.js` passes one that inserts a `job_logs` row, a
    // scheduled-run caller can layer stdout printing on top of the same call.
    log = () => {},
  } = {}
) {
  const { eligibleNotesById, alreadyMinted, newlyEligibleByDeck } = await pullAndAssign(pool, {
    stabburBaseUrl,
    stabburAuthToken,
    sourceLang,
  });
  const decksToMint = [...newlyEligibleByDeck.entries()];

  // Skip only when there is truly nothing to do: no newly-eligible decks
  // AND nothing has ever been minted. The original condition skipped
  // whenever there was nothing *new*, even if already-minted content was
  // sitting unpublished — which silently defeats "every publish
  // regenerates all existing minted cards' content" the moment a mint
  // succeeds but a later step (the OTA publish itself) fails: the next run
  // would see zero newly-eligible notes and bail before ever reaching the
  // regenerate+publish step again, with no way to make forward progress.
  // Found live, 2026-10-26: a mint committed successfully, the bundle was
  // saved with the new cards, but the publish() call failed (a stale
  // same-buildId collision) — every subsequent run returned
  // `{published:false}` and never retried publishing the already-minted,
  // already-saved content, because "nothing new" was mistaken for
  // "nothing to do".
  if (decksToMint.length === 0 && alreadyMinted.length === 0) {
    // Nothing minted anywhere, nothing new either — genuinely a no-op.
    // Nothing to log either — there is no build job for a line to attach
    // to, and nothing a job-detail view could ever show for a run that
    // didn't happen.
    return { published: false, decksMinted: [] };
  }

  const buildJobId = await createBuildJob(pool);
  let scratchPath = null;
  try {
    // D-H4: these two checkpoints only make sense once a build_jobs row
    // exists to attach them to (pull/assign for a no-op run are never
    // logged, matching the no-op run having no job at all, above).
    await log(buildJobId, `pulled ${eligibleNotesById.size} eligible notes from stabbur (source_lang=${sourceLang})`);
    await log(
      buildJobId,
      `assign: ${decksToMint.reduce((n, [, notes]) => n + notes.length, 0)} newly-eligible across ${decksToMint.length} deck(s): ${decksToMint.map(([d, notes]) => `${d}×${notes.length}`).join(", ")}`
    );

    // D-H1: computed up front (not after mint/drain, as before this change)
    // so every occurrence shipped this run — whether newly minted or
    // drained from an old queue — can be recorded against the id of the
    // build it's actually shipping in. Reassigning `publications`' max+1
    // this early is safe: nothing reads or writes `publications` for this
    // run until `writePublication` at the very end, same as before.
    const buildId = await nextBuildId(pool);
    const shipments = [];

    // D-L4: every run starts fresh from whichever `logic_bundles` row is
    // active — the mutable, long-lived `BUNDLE_PATH` working file this
    // replaced is gone entirely. The active bundle's own file is immutable
    // (never mutated in place); this run's scratch copy is what
    // `loadDeckCardModel`/`saveDeckCardModel` actually operate on, and it's
    // discarded in the `finally` below regardless of outcome — every run
    // fully reconstructs it, so nothing is lost by throwing it away.
    const active = await loadActive(pool);
    scratchPath = path.join(os.tmpdir(), `mjolnir-builder-scratch-${process.pid}-${buildId}.js`);
    fs.writeFileSync(scratchPath, active.bytes);
    const model = loadDeckCardModel(scratchPath);
    await replay(pool, model);

    // Regenerate every already-minted card's content fresh (not just new
    // ones) — 03-data-model.md's central rule. Only touches cards whose
    // note is still present in this pull; a tombstoned note's card keeps
    // whatever content it last had, which is correct (it's permanent).
    const alreadyMintedIds = alreadyMinted.map((n) => n.id);
    const cardIdByNoteId = await cardIdsForNotes(pool, alreadyMintedIds);
    // D-C2: snapshot before this run's upserts overwrite it, so the
    // comparison is against what was actually stored coming into this run.
    const existingContentBeforeRegen = await getAllCardContent(pool);
    const changedCardIds = [];
    const deckTitleCache = new Map();
    async function ensureDeckByCode(deckCode) {
      if (!deckTitleCache.has(deckCode)) deckTitleCache.set(deckCode, await deckTitle(pool, deckCode));
      return ensureDeck(model.decks, { name: deckCode, title: deckTitleCache.get(deckCode) });
    }
    const selMsByCardId = {};
    // builder-sliding-window-shipping (D-W2): every deck touched by either
    // loop below needs exactly one flush pass, after ALL staging/draining
    // for this run is done — not one flush per loop, or a deck touched by
    // both the recovery path and the decksToMint loop would flush twice in
    // the same run against a half-staged count.
    const touchedDeckCodes = new Set();
    for (const note of alreadyMinted) {
      const entry = cardIdByNoteId.get(note.id);
      if (!entry) continue;
      const { cardId, deckCode } = entry;
      if (note.audio_sel_ms) selMsByCardId[cardId] = note.audio_sel_ms;
      const content = project(note, { grammarRuleLookup });
      if (contentChanged(existingContentBeforeRegen.get(cardId), content)) changedCardIds.push(cardId);
      await upsertCardContentRow(pool, cardId, { N: content.N, E: content.E, X: content.X, A: content.A });
      if (model.cards.some((c) => c.ID === cardId)) {
        upsertCardContent(model.cards, cardId, { N: content.N, E: content.E, X: content.X, A: content.A });
      } else {
        // D86: hub's ledger names this card as already minted, but it's
        // missing from the bundle — a prior run committed the mint and then
        // failed before the save/publish that was supposed to follow.
        // Recreate it fresh instead of throwing on the missing match, so
        // this run self-heals rather than failing identically forever.
        await ensureDeckByCode(deckCode);
        const title = deckTitleCache.get(deckCode);
        createCard(model.cards, { id: cardId, deckId: deckCode, N: content.N, E: content.E, D: title, X: content.X, A: content.A });
        const { queued, newACount } = await stageImmediateOccurrences(pool, deckCode, cardId, content.occurrences);
        await drainThenQueue(pool, deckCode, newACount, queued.map((letter) => ({ cardId, letter })));
        touchedDeckCodes.add(deckCode);
      }
      await updateAudioSha256(pool, cardId, note.audio_blob, note.grammar_rule_id ?? null);
    }
    await log(
      buildJobId,
      `regenerate: ${changedCardIds.length} of ${alreadyMinted.length} existing card(s) actually changed content` +
        (changedCardIds.length ? `: ${changedCardIds.join(", ")}` : "")
    );

    const decksMinted = [];
    for (const [deckCode, notes] of decksToMint) {
      const title = await deckTitle(pool, deckCode);
      deckTitleCache.set(deckCode, title);
      ensureDeck(model.decks, { name: deckCode, title });
      touchedDeckCodes.add(deckCode);

      const minted = await mintCardSlots(pool, deckCode, notes);
      await log(buildJobId, `mint: ${deckCode} — card_slots ${minted.map((m) => m.cardId).join(", ")}`);
      let newACount = 0;
      const toQueue = [];
      for (const { note, cardId } of minted) {
        if (note.audio_sel_ms) selMsByCardId[cardId] = note.audio_sel_ms;
        const content = project(note, { grammarRuleLookup });
        await upsertCardContentRow(pool, cardId, { N: content.N, E: content.E, X: content.X, A: content.A });
        createCard(model.cards, { id: cardId, deckId: deckCode, N: content.N, E: content.E, D: title, X: content.X, A: content.A });
        const result = await stageImmediateOccurrences(pool, deckCode, cardId, content.occurrences);
        newACount += result.newACount;
        for (const letter of result.queued) toQueue.push({ cardId, letter });
      }
      const stagedBeforeDrain = await stagedCount(pool, deckCode);
      await drainThenQueue(pool, deckCode, newACount, toQueue);
      const stagedAfterDrain = await stagedCount(pool, deckCode);
      await log(buildJobId, `drain: ${deckCode} — ${stagedAfterDrain - stagedBeforeDrain} row(s) reached remaining<=0, staged`);
      decksMinted.push({ deckCode, count: minted.length });
    }

    // builder-sliding-window-shipping (D-W2): one flush pass per deck
    // touched this run, after minting/draining/staging is fully done for
    // every deck — ships the largest multiple of 5 each deck currently
    // holds, logs and holds the remainder otherwise.
    for (const deckCode of touchedDeckCodes) {
      await flushDeck(pool, model, deckCode, deckTitleCache, shipments, log, buildJobId);
    }

    saveDeckCardModel(scratchPath, model);

    // The scratch bundle's boot-ok companion bakes a BUILD_ID that never
    // moves on its own — re-stamp it to this run's buildId on every publish,
    // not just the first, or publish()'s own checkCompanionMatch refuses
    // every run after the one where it happened to already match.
    // base_version/patch_rev need no restamp: they came from the active
    // logic bundle this run started from and never change mid-run (D-L4).
    restampCompanionBuildId(scratchPath, buildId);

    const cardAudio = await allCardAudio(pool);
    const finalCardAudio = await ensureBlobsPresent(cardAudio, { stabburBaseUrl, dataDir, selMsByCardId });
    await log(buildJobId, `snapshot: audio manifest covers ${Object.keys(finalCardAudio).length} card(s)`);

    // D-L6: base_version/patch_rev now come from the logic bundle this run
    // built onto, not copied forward from the previous publication —
    // `previousVersions` exists only for `data_rev` now.
    const { baseVersion, patchRev } = active;
    const { dataRev } = await previousVersions(pool);
    writeAudioManifest(finalCardAudio, { dataDir, buildId });
    writePublicAudioManifest(finalCardAudio, { dataDir, buildId });

    const bundleBytes = fs.readFileSync(scratchPath);
    const bundleSha = crypto.createHash("sha256").update(bundleBytes).digest("hex");
    const result = publish(scratchPath, buildId, `base ${baseVersion} · logic ${patchRev} · data ${dataRev + 1}`, {
      dataDir,
      publicBase,
    });
    await log(buildJobId, `published ${buildId} — sha256 ${result.sha256}`);

    await writePublication(pool, {
      buildId,
      baseVersion,
      patchRev,
      dataRev: dataRev + 1,
      bundleSha: result.sha256,
      logicBundleId: active.id,
    });
    // D-H1: only after `publish()` *and* `writePublication` have succeeded —
    // never speculatively, and never before the `publications` row exists
    // (occurrence_shipments.build_id has an FK to it). A run that fails
    // anywhere above this line leaves zero shipment rows.
    await recordShipments(pool, shipments, buildId);
    await markSucceeded(pool, buildJobId, buildId);

    return { published: true, buildId, decksMinted, eligibleCount: eligibleNotesById.size };
  } catch (err) {
    await markFailed(pool, buildJobId, err);
    throw err;
  } finally {
    // Safe to discard unconditionally — every run fully reconstructs its
    // own scratch copy from the active logic bundle + hub's ledger tables
    // (D-L4); nothing is ever lost by deleting it here.
    if (scratchPath) fs.rmSync(scratchPath, { force: true });
  }
}
