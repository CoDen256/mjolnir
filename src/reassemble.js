import fs from "node:fs";

// Byte-copies every module not in `patches` from its original offsets in
// `bundlePath`, splicing in the already-re-minified patched modules in
// their place. The prelude (before the first module) and trailer (the
// __r(...) entry call and anything after the last module) are untouched
// since they fall outside every manifest entry's [start, end) range.
export function reassembleBundle(bundlePath, manifest, patches) {
  const original = fs.readFileSync(bundlePath);
  const patchByModuleId = new Map(patches.map((p) => [String(p.moduleId), p.newSource]));

  const entries = Object.entries(manifest)
    .map(([id, mod]) => ({ id, ...mod }))
    .sort((a, b) => a.start - b.start);

  const chunks = [];
  let cursor = 0;

  for (const mod of entries) {
    if (mod.start > cursor) {
      chunks.push(original.subarray(cursor, mod.start));
    }
    const patch = patchByModuleId.get(mod.id);
    chunks.push(
      patch !== undefined ? Buffer.from(patch, "utf8") : original.subarray(mod.start, mod.end)
    );
    cursor = mod.end;
  }

  if (cursor < original.length) {
    chunks.push(original.subarray(cursor));
  }

  return Buffer.concat(chunks);
}
