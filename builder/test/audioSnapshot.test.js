import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { ensureBlobsPresent } from "../src/audioSnapshot.js";
import { startFakeStabbur, shaOf } from "./helpers/fakeStabbur.js";

function ffmpegAvailable() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function probeDurationMs(filePath) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
    { encoding: "utf8" }
  );
  return Math.round(parseFloat(out.trim()) * 1000);
}

const describe = ffmpegAvailable() ? test : test.skip;

describe("audioSnapshot: D-F1 trims a card's audio to its note's audio_sel_ms", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mjolnir-audio-trim-"));
  // A 2.000s sine-wave clip, deterministic and ffmpeg-generated — no
  // external fixture file needed.
  const sourcePath = path.join(tmpDir, "source.mp3");
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=2",
    sourcePath,
  ]);
  const sourceBytes = fs.readFileSync(sourcePath);
  const originalSha = shaOf(sourceBytes);

  const fake = startFakeStabbur({ blobs: {} });
  fake.addBlob(originalSha, sourceBytes);
  const stabburBaseUrl = await fake.listen();
  const dataDir = path.join(tmpDir, "data");

  await t.test("a card with audio_sel_ms gets a derived, trimmed hash whose duration matches the selection", async () => {
    const cardAudio = { CARDTRIM: originalSha };
    const result = await ensureBlobsPresent(cardAudio, {
      stabburBaseUrl,
      dataDir,
      selMsByCardId: { CARDTRIM: [500, 1500] },
    });
    assert.notEqual(result.CARDTRIM, originalSha, "trimmed hash must differ from the original");
    const trimmedPath = path.join(dataDir, "blob", result.CARDTRIM);
    assert.ok(fs.existsSync(trimmedPath));
    const durationMs = probeDurationMs(trimmedPath);
    assert.ok(Math.abs(durationMs - 1000) < 150, `expected ~1000ms, got ${durationMs}ms`);

    // The original must still be present on disk, byte-identical — D45:
    // this only ever reads stabbur's canonical blob, never mutates it.
    const originalPath = path.join(dataDir, "blob", originalSha);
    assert.ok(fs.existsSync(originalPath));
    assert.deepEqual(fs.readFileSync(originalPath), sourceBytes);
  });

  await t.test("a card with no audio_sel_ms keeps the original hash unchanged", async () => {
    const cardAudio = { CARDPLAIN: originalSha };
    const result = await ensureBlobsPresent(cardAudio, { stabburBaseUrl, dataDir, selMsByCardId: {} });
    assert.equal(result.CARDPLAIN, originalSha);
  });

  await t.test("an out-of-range selection is clamped to the clip's actual duration, not thrown", async () => {
    const cardAudio = { CARDCLAMP: originalSha };
    const result = await ensureBlobsPresent(cardAudio, {
      stabburBaseUrl,
      dataDir,
      selMsByCardId: { CARDCLAMP: [1800, 10000] },
    });
    assert.notEqual(result.CARDCLAMP, originalSha);
    const durationMs = probeDurationMs(path.join(dataDir, "blob", result.CARDCLAMP));
    assert.ok(Math.abs(durationMs - 200) < 150, `expected ~200ms (clamped from 1800-10000 on a 2000ms clip), got ${durationMs}ms`);
  });

  await t.test("a selection entirely past the clip's duration collapses to the untrimmed original, not an empty file", async () => {
    const cardAudio = { CARDPAST: originalSha };
    const result = await ensureBlobsPresent(cardAudio, {
      stabburBaseUrl,
      dataDir,
      selMsByCardId: { CARDPAST: [5000, 9000] },
    });
    assert.equal(result.CARDPAST, originalSha, "clamping start and end both to duration collapses the range — ship the original");
  });

  t.after(async () => {
    await fake.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
