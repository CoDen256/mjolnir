import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

function sha256OfFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function probeDurationMs(filePath) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
    { encoding: "utf8" }
  );
  return Math.round(parseFloat(out.trim()) * 1000);
}

// D-F1: trims `srcPath` to `[startMs, endMs]`, clamped to the file's actual
// duration so a stale/out-of-range selection (a clip replaced without
// clearing the selection, or stale metadata) can't fail the whole publish
// over one bad note. If clamping collapses the range to nothing, ships the
// untrimmed original instead of an invalid/empty clip.
function trimToRange(srcPath, destPath, [startMs, endMs]) {
  const durationMs = probeDurationMs(srcPath);
  const clampedStart = Math.max(0, Math.min(startMs, durationMs));
  const clampedEnd = Math.max(clampedStart, Math.min(endMs, durationMs));
  if (clampedEnd <= clampedStart) {
    fs.copyFileSync(srcPath, destPath);
    return;
  }
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    srcPath,
    "-ss",
    String(clampedStart / 1000),
    "-to",
    String(clampedEnd / 1000),
    // Blobs are stored by hash with no file extension — ffmpeg can't infer
    // the output container from the filename, so it has to be told. Every
    // blob in this system is mp3 (stabbur's authoring UI only ever uploads
    // mp3, same as the original's own format).
    "-f",
    "mp3",
    destPath,
  ]);
}

// hub keeps its own per-build audio snapshot (D45) so studying never depends
// on stabbur being reachable. `cardAudio` is `{cardId: sha256}` — every card
// in the bundle, not just this run's new ones, since the whole bundle ships
// together. `stabburBaseUrl`/`dataDir` mirror `tool/src/otaPublish.js`'s own
// `/blob/<sha256>` convention (02-services.md).
//
// `selMsByCardId` (`{cardId: [startMs, endMs]}`, D-F1) trims a card's audio
// to its note's `audio_sel_ms` selection — only ever populated for cards
// whose note is present in *this* pull (a tombstoned note's selection isn't
// known any more, so its card keeps whatever hash it last had, same
// permanence rule as its content). The trimmed result is a *derived* hash
// living only in hub's own blob cache here — the original stays exactly
// where D45 says it should, in stabbur's canonical store, untouched by this
// (this function only ever reads it). Returns `{cardId: finalSha256}` —
// trimmed where applicable, the original hash otherwise — for the caller to
// hand to `writeAudioManifest`.
export async function ensureBlobsPresent(cardAudio, { stabburBaseUrl, dataDir, selMsByCardId = {} } = {}) {
  const blobDir = path.join(dataDir, "blob");
  fs.mkdirSync(blobDir, { recursive: true });

  for (const sha256 of new Set(Object.values(cardAudio))) {
    const dest = path.join(blobDir, sha256);
    if (fs.existsSync(dest)) continue;

    const res = await fetch(new URL(`/blob/${sha256}`, stabburBaseUrl));
    if (!res.ok) {
      throw new Error(`could not fetch blob ${sha256} from stabbur: ${res.status} ${res.statusText}`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const actualSha = crypto.createHash("sha256").update(bytes).digest("hex");
    if (actualSha !== sha256) {
      throw new Error(`blob ${sha256} hash mismatch after download (got ${actualSha}) — refusing to snapshot it`);
    }
    const tmp = `${dest}.tmp`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, dest);
  }

  const finalCardAudio = {};
  for (const [cardId, originalSha] of Object.entries(cardAudio)) {
    const selMs = selMsByCardId[cardId];
    if (!selMs) {
      finalCardAudio[cardId] = originalSha;
      continue;
    }
    const originalPath = path.join(blobDir, originalSha);
    const tmp = path.join(blobDir, `${originalSha}.trim.tmp`);
    trimToRange(originalPath, tmp, selMs);
    const trimmedSha = sha256OfFile(tmp);
    const dest = path.join(blobDir, trimmedSha);
    if (fs.existsSync(dest)) {
      fs.rmSync(tmp);
    } else {
      fs.renameSync(tmp, dest);
    }
    finalCardAudio[cardId] = trimmedSha;
  }
  return finalCardAudio;
}

// D-A3: a second, card-id-keyed static copy of the same bytes already at
// `/blob/<sha256>`, so the device can hit a predictable, name-based URL
// with no manifest fetch and no sha256 lookup of its own — a plain file
// Caddy serves directly (see `caddy/Caddyfile`'s `/audio-by-card/*` block),
// never touching hub's Node process. Takes `finalCardAudio` (the
// already-trimmed-where-applicable result of `ensureBlobsPresent`), not the
// raw `cardAudio`, so the copy matches whatever was actually snapshotted to
// `/blob/<sha256>`. Idempotent: skips a card whose file already has the
// right bytes, so republishing unchanged audio is a no-op.
export function writeAudioByCardFiles(finalCardAudio, { dataDir }) {
  const blobDir = path.join(dataDir, "blob");
  const audioByCardDir = path.join(dataDir, "audio-by-card");
  fs.mkdirSync(audioByCardDir, { recursive: true });

  for (const [cardId, sha256] of Object.entries(finalCardAudio)) {
    const src = path.join(blobDir, sha256);
    const dest = path.join(audioByCardDir, `${cardId}.mp3`);
    if (fs.existsSync(dest) && sha256OfFile(dest) === sha256) continue;
    const tmp = `${dest}.tmp`;
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, dest);
  }
}

export function writeAudioManifest(cardAudio, { dataDir, buildId }) {
  const dir = path.join(dataDir, "ota", buildId);
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, "audio.json");
  const tmp = `${manifestPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cardAudio, null, 2) + "\n");
  fs.renameSync(tmp, manifestPath);
  return manifestPath;
}
