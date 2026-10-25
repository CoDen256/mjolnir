import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// hub keeps its own per-build audio snapshot (D45) so studying never depends
// on stabbur being reachable. `cardAudio` is `{cardId: sha256}` — every card
// in the bundle, not just this run's new ones, since the whole bundle ships
// together. `stabburBaseUrl`/`dataDir` mirror `tool/src/otaPublish.js`'s own
// `/blob/<sha256>` convention (02-services.md).
export async function ensureBlobsPresent(cardAudio, { stabburBaseUrl, dataDir }) {
  const blobDir = path.join(dataDir, "blob");
  fs.mkdirSync(blobDir, { recursive: true });

  const fetched = [];
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
    fetched.push(sha256);
  }
  return fetched;
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
