import { loadDeckCardModel, saveDeckCardModel, addOccurrence } from "../../src/deckData.js";
import { createCard, upsertCardContent, ensureDeck } from "../../src/injectDeck.js";
import { publish } from "../../tool/src/otaPublish.js";
import { pullNotes, filterAudioEligible } from "./stabburClient.js";
import { partitionByDeck } from "./eligibility.js";
import { project } from "./projector.js";
import { mintCardSlots, cardIdsForNotes, updateAudioSha256, allCardAudio, deckTitle } from "./mint.js";
import { queuePendingOccurrence, hasPendingOccurrence, drainPendingOccurrences, pendingQueueDepths } from "./pendingOccurrences.js";
import { previousVersions, writePublication } from "./publications.js";
import { createBuildJob, markSucceeded, markFailed } from "./buildJobs.js";
import { nextBuildId } from "./buildId.js";
import { ensureBlobsPresent, writeAudioManifest } from "./audioSnapshot.js";
import fs from "node:fs";
import crypto from "node:crypto";

// Steps 1-4 of builder/README.md's "what a run does" — pull, filter, split
// into already-minted vs newly-eligible, group the latter by deck. Shared
// verbatim between the forecast and a real run (D-P5): one implementation of
// "which notes are eligible and where do they go," two call sites.
async function pullAndAssign(pool, { stabburBaseUrl, sourceLang }) {
  // `since` is deliberately never passed: every run does a full pull, since
  // regenerating every already-minted card's content (not just new ones)
  // needs each note's current state anyway, and note counts are small
  // enough that this is cheap (task 4.1's finding).
  const notes = await pullNotes({ baseUrl: stabburBaseUrl, sourceLang });
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

// Appends `occurrences`' immediate letters to `deck` now and returns the
// list of `{letter}` entries still to be queued, plus how many brand-new
// `A`'s were just appended (the drain step's decrement count).
function appendImmediateOccurrences(deck, cardId, occurrences) {
  const { immediate, queued } = splitOccurrences(occurrences);
  for (const letter of immediate) addOccurrence(deck, cardId, letter);
  return { queued, newACount: immediate.filter((l) => l === "A").length };
}

// Drains `deckCode`'s *existing* queue by `newACount`, appending every row
// that reaches `remaining <= 0`, then queues `toQueue`'s rows fresh at
// `remaining: 11` — in that order, so a card's own just-queued `E` is never
// decremented by the very batch of `A`'s that created it
// (03-data-model.md's worked example: "a queued E draining in the same run
// does not count toward another queued E's countdown"). `hasPendingOccurrence`
// guards the D86 recovery path against double-queuing a row a prior, crashed
// run may already have written durably before failing.
async function drainThenQueue(pool, deck, deckCode, newACount, toQueue) {
  if (newACount > 0) {
    const drained = await drainPendingOccurrences(pool, deckCode, newACount);
    for (const { cardId, letter } of drained) addOccurrence(deck, cardId, letter);
  }
  for (const { cardId, letter } of toQueue) {
    if (!(await hasPendingOccurrence(pool, cardId, letter))) {
      await queuePendingOccurrence(pool, { deckCode, cardId, letter, remaining: 11 });
    }
  }
}

// Task 4.14: dry run of steps 1-4 only — reports per-deck counts, mints and
// writes nothing. Calls the exact same `pullAndAssign` the real run uses.
// D91: there's no floor to report crossing/not-crossing any more — just
// eligible-note counts plus each deck's current `pending_occurrences` depth
// (an operator signal: "C20 has 40 E's queued, oldest one has 3 to go").
export async function runForecast(pool, { stabburBaseUrl, sourceLang = "no" } = {}) {
  const { newlyEligibleByDeck } = await pullAndAssign(pool, { stabburBaseUrl, sourceLang });
  const queueDepths = await pendingQueueDepths(pool);
  const decks = [...newlyEligibleByDeck.entries()].map(([deckCode, notes]) => {
    const queue = queueDepths.get(deckCode);
    return {
      deckCode,
      newlyEligibleCount: notes.length,
      pendingQueueDepth: queue ? queue.depth : 0,
      pendingOldestRemaining: queue ? queue.oldestRemaining : null,
    };
  });
  return { decks };
}

// The real run: tasks 4.2-4.12. No floor (D91) — triggered by either the
// nightly clock or the manual button (task 4.13/4.15), this function is the
// one thing both call.
export async function runPublish(
  pool,
  { stabburBaseUrl, sourceLang = "no", bundlePath, dataDir, publicBase, grammarRuleLookup } = {}
) {
  const { eligibleNotesById, alreadyMinted, newlyEligibleByDeck } = await pullAndAssign(pool, {
    stabburBaseUrl,
    sourceLang,
  });
  const decksToMint = [...newlyEligibleByDeck.entries()];

  if (decksToMint.length === 0) {
    // "no build_jobs row is created and no publish occurs" — spec, scenario
    // "Scheduled run with no eligible decks".
    return { published: false, decksMinted: [] };
  }

  const buildJobId = await createBuildJob(pool);
  try {
    const model = loadDeckCardModel(bundlePath);

    // Regenerate every already-minted card's content fresh (not just new
    // ones) — 03-data-model.md's central rule. Only touches cards whose
    // note is still present in this pull; a tombstoned note's card keeps
    // whatever content it last had, which is correct (it's permanent).
    const alreadyMintedIds = alreadyMinted.map((n) => n.id);
    const cardIdByNoteId = await cardIdsForNotes(pool, alreadyMintedIds);
    const deckTitleCache = new Map();
    async function ensureDeckByCode(deckCode) {
      if (!deckTitleCache.has(deckCode)) deckTitleCache.set(deckCode, await deckTitle(pool, deckCode));
      return ensureDeck(model.decks, { name: deckCode, title: deckTitleCache.get(deckCode) });
    }
    for (const note of alreadyMinted) {
      const entry = cardIdByNoteId.get(note.id);
      if (!entry) continue;
      const { cardId, deckCode } = entry;
      const content = project(note, { grammarRuleLookup });
      if (model.cards.some((c) => c.ID === cardId)) {
        upsertCardContent(model.cards, cardId, { N: content.N, E: content.E, X: content.X, A: content.A });
      } else {
        // D86: hub's ledger names this card as already minted, but it's
        // missing from the bundle — a prior run committed the mint and then
        // failed before the save/publish that was supposed to follow.
        // Recreate it fresh instead of throwing on the missing match, so
        // this run self-heals rather than failing identically forever.
        const deck = await ensureDeckByCode(deckCode);
        const title = deckTitleCache.get(deckCode);
        createCard(model.cards, { id: cardId, deckId: deckCode, N: content.N, E: content.E, D: title, X: content.X, A: content.A });
        const { queued, newACount } = appendImmediateOccurrences(deck, cardId, content.occurrences);
        await drainThenQueue(pool, deck, deckCode, newACount, queued.map((letter) => ({ cardId, letter })));
      }
      await updateAudioSha256(pool, cardId, note.audio_blob);
    }

    const decksMinted = [];
    for (const [deckCode, notes] of decksToMint) {
      const title = await deckTitle(pool, deckCode);
      const deck = ensureDeck(model.decks, { name: deckCode, title });

      const minted = await mintCardSlots(pool, deckCode, notes);
      let newACount = 0;
      const toQueue = [];
      for (const { note, cardId } of minted) {
        const content = project(note, { grammarRuleLookup });
        createCard(model.cards, { id: cardId, deckId: deckCode, N: content.N, E: content.E, D: title, X: content.X, A: content.A });
        const result = appendImmediateOccurrences(deck, cardId, content.occurrences);
        newACount += result.newACount;
        for (const letter of result.queued) toQueue.push({ cardId, letter });
      }
      await drainThenQueue(pool, deck, deckCode, newACount, toQueue);
      decksMinted.push({ deckCode, count: minted.length });
    }

    saveDeckCardModel(bundlePath, model);

    const cardAudio = await allCardAudio(pool);
    await ensureBlobsPresent(cardAudio, { stabburBaseUrl, dataDir });

    const { baseVersion, patchRev, dataRev } = await previousVersions(pool);
    const buildId = await nextBuildId(pool);
    writeAudioManifest(cardAudio, { dataDir, buildId });

    const bundleBytes = fs.readFileSync(bundlePath);
    const bundleSha = crypto.createHash("sha256").update(bundleBytes).digest("hex");
    const result = publish(bundlePath, buildId, `base ${baseVersion} · logic ${patchRev} · data ${dataRev + 1}`, {
      dataDir,
      publicBase,
    });

    await writePublication(pool, { buildId, baseVersion, patchRev, dataRev: dataRev + 1, bundleSha: result.sha256 });
    await markSucceeded(pool, buildJobId);

    return { published: true, buildId, decksMinted, eligibleCount: eligibleNotesById.size };
  } catch (err) {
    await markFailed(pool, buildJobId, err);
    throw err;
  }
}
