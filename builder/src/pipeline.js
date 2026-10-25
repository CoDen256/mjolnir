import { loadDeckCardModel, saveDeckCardModel } from "../../src/deckData.js";
import { createCard, interleaveOccurrences, upsertCardContent, ensureDeck } from "../../src/injectDeck.js";
import { publish } from "../../tool/src/otaPublish.js";
import { pullNotes, filterAudioEligible } from "./stabburClient.js";
import { partitionByDeck, decksCrossingFloor, MINT_FLOOR } from "./eligibility.js";
import { project } from "./projector.js";
import { mintCardSlots, cardIdsForNotes, updateAudioSha256, allCardAudio, deckTitle } from "./mint.js";
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
  const notes = await pullNotes({ baseUrl: stabburBaseUrl, sourceLang });
  const eligible = filterAudioEligible(notes);

  const { rows } = await pool.query("SELECT note_id FROM minted_notes WHERE note_id = ANY($1)", [
    eligible.map((n) => n.id),
  ]);
  const mintedNoteIds = new Set(rows.map((r) => r.note_id));

  return { eligibleNotesById: new Map(eligible.map((n) => [n.id, n])), ...partitionByDeck(eligible, mintedNoteIds) };
}

// Task 4.14: dry run of steps 1-4 only — reports per-deck counts, mints and
// writes nothing. Calls the exact same `pullAndAssign` the real run uses.
export async function runForecast(pool, { stabburBaseUrl, sourceLang = "no" } = {}) {
  const { newlyEligibleByDeck } = await pullAndAssign(pool, { stabburBaseUrl, sourceLang });
  const decks = [...newlyEligibleByDeck.entries()].map(([deckCode, notes]) => ({
    deckCode,
    newlyEligibleCount: notes.length,
    floor: MINT_FLOOR,
    crossed: notes.length >= MINT_FLOOR,
  }));
  return { decks };
}

// The real run: tasks 4.2-4.12. Subject to the same floor as the forecast,
// triggered by either the nightly clock or the manual button (task
// 4.13/4.15) — this function is the one thing both call.
export async function runPublish(
  pool,
  { stabburBaseUrl, sourceLang = "no", bundlePath, dataDir, publicBase, grammarRuleLookup } = {}
) {
  const { eligibleNotesById, alreadyMinted, newlyEligibleByDeck } = await pullAndAssign(pool, {
    stabburBaseUrl,
    sourceLang,
  });
  const crossing = decksCrossingFloor(newlyEligibleByDeck);

  if (crossing.length === 0) {
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
    for (const note of alreadyMinted) {
      const cardId = cardIdByNoteId.get(note.id);
      if (!cardId) continue;
      const content = project(note, { grammarRuleLookup });
      upsertCardContent(model.cards, cardId, { N: content.N, E: content.E, X: content.X, A: content.A });
      await updateAudioSha256(pool, cardId, note.audio_blob);
    }

    const decksMinted = [];
    for (const [deckCode, notes] of crossing) {
      const title = await deckTitle(pool, deckCode);
      const deck = ensureDeck(model.decks, { name: deckCode, title });

      const minted = await mintCardSlots(pool, deckCode, notes);
      const occurrencesByCardId = new Map();
      for (const { note, cardId } of minted) {
        const content = project(note, { grammarRuleLookup });
        createCard(model.cards, { id: cardId, deckId: deckCode, N: content.N, E: content.E, D: title, X: content.X, A: content.A });
        occurrencesByCardId.set(cardId, content.occurrences);
      }
      interleaveOccurrences(
        deck,
        minted.map((m) => m.cardId),
        (cardId) => occurrencesByCardId.get(cardId)
      );
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
