## 0. Before you write any code

Read `design.md` D-F1 in full — the choice to trim downstream into a derived
hash rather than destructively in stabbur is deliberate (reversibility), not
an arbitrary pick. Read `tun/docs/07-decisions.md` D45 for why stabbur's
canonical audio must stay untouched by this change.

## 1. Audio trim

- [ ] 1.1 Confirm `ffmpeg` availability as a build/runtime dependency of
      `builder`'s deployment (it's present on this dev machine; confirm it
      lands in whatever container image `builder` eventually ships in —
      cross-reference with the `hub-builder-operator-console` proposal's
      Dockerfile task, since both touch `builder`'s image).
- [ ] 1.2 Write a small wrapper: given a source file + `[startMs, endMs]`,
      produce a trimmed file via `ffmpeg -ss -to`, clamping bounds to
      `[0, duration]` so a stale/out-of-range selection can't fail the whole
      publish.
- [ ] 1.3 Wire it into `ensureBlobsPresent`: after fetching+verifying the
      original blob, if the card's note has `audio_sel_ms`, trim, hash the
      result, store under the derived hash (idempotent — skip if already
      present), and use that hash in the manifest instead of the original.
- [ ] 1.4 `writeAudioManifest` needs no change in shape — it already just
      takes `{cardId: sha256}`; the sha256 it receives is now sometimes a
      derived one. Confirm this doesn't require changing its signature.
- [ ] 1.5 Tests: a note with `audio_sel_ms` produces a manifest entry whose
      hash differs from the original blob's hash and whose duration matches
      the selection; a note with `audio_sel_ms: null` produces the unchanged
      original-hash path; an out-of-range selection is clamped, not thrown.

## 2. Drain order

- [ ] 2.1 Add `ORDER BY id ASC` to the `SELECT` in
      `drainPendingOccurrences` (`pendingOccurrences.js`).
- [ ] 2.2 Test: insert multiple pending rows for one deck out of id order,
      decrement past zero for more than one, confirm they drain (and get
      appended to `Cards[]`) in ascending `id` order every time.

## 3. Sign-off

- [ ] 3.1 Re-run the existing `pipeline.test.js` suite in full — this change
      touches two functions several other tests already exercise; confirm
      nothing else regressed.
- [ ] 3.2 If anything here contradicts or refines `design.md`'s D-F1 choice
      during implementation, record it as an ADR amendment in
      `tun/docs/07-decisions.md` — this project's established practice, not
      a suggestion.
