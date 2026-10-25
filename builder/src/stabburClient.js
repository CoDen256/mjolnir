// Pull step (task 4.2): `GET /api/notes?source_lang=no&status=ready&since=…`
// (D-N4, stabbur's p4-notes read API). `status=ready` is always sent, though
// the contract hard-filters to ready regardless (D-N4 notes-read-api).
export async function pullNotes({ baseUrl, sourceLang = "no", since } = {}) {
  if (!baseUrl) throw new Error("pullNotes requires baseUrl");
  const url = new URL("/api/notes", baseUrl);
  url.searchParams.set("source_lang", sourceLang);
  url.searchParams.set("status", "ready");
  if (since) url.searchParams.set("since", since);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`stabbur pull failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// D74: audio is mandatory for every Mjølnir card, no type-based exception. A
// `ready` note with no `audio_blob` simply isn't eligible yet.
export function filterAudioEligible(notes) {
  return notes.filter((n) => !!n.audio_blob);
}
