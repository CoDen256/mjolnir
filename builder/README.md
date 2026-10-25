# builder

Background worker with a small operator UI (D80), **written in Node — the
same runtime as `bundle-tool`** (D76), specifically so it can import
`inject-deck` and the OTA publish guards as in-process library calls, not a
subprocess and not an HTTP hop. Polls `build_jobs` (in `hub`'s database —
builder has no schema of its own), pulls `ready` notes with audio from
`stabbur`, projects them into Mjølnir's deck/card format, assembles a bundle
plus an audio manifest, and writes status back.

**`hub` owns the schema** (`card_slots`, `decks`, `publications`, `build_jobs`,
and its own ledger of which note ids are already minted — never pushed back to
stabbur, D44). **`builder` is the only thing that writes into it.** Two
separate deployed processes, one database.

## What a run does

1. **Pull.** `GET stabbur/api/notes?source_lang=no&status=ready&since=…`, then
   drop any note with no `audio_blob` — audio is mandatory for every Mjølnir
   card, no type-based exception (D74).
2. **Assign a deck**, by `type`, then by `pos` for `type=word`:

   | `type` / `pos` | deck |
   |---|---|
   | substantiv | C20 |
   | adjektiv | C21 |
   | verb | C22 |
   | adverb | C23 |
   | preposisjon | C24 |
   | konjunksjon / subjunksjon | C25 |
   | `type=expression`, **or any `pos` not listed above** | C26 |
   | `type=listening` | C27 |
   | `type=pronunciation` | C28 |
   | `type=grammar` | C29 |

   Any PoS Norsk ordbank can hand back that isn't one of the six word-decks
   above (pronomen, interjeksjon, numeral, …) falls through to C26 rather than
   being silently ineligible.
3. **Hold until a deck has ≥6 newly-eligible notes.** This is a hard floor, not
   a suggestion — lag-11 interleave needs room to separate a card's own
   occurrences by at least two pull-blocks (`03-data-model.md`), and one
   `EN`/`AEN` card alone cannot do that against itself. A deck under threshold
   just waits for its next run; nothing is lost, nothing is published early.
4. **Mint `card_slots`** for the (now ≥6) newly-eligible notes only — a
   permanent 6-char id, never reused, assigned once and never touched again.
5. **Project.** Pure function of `type`: note → `{N, E, X, A}` + the
   occurrence set (word/expression/listening/pronunciation/grammar each have a
   fixed shape — `03-data-model.md` §"five note/card types"). Stateless,
   computed every run, never stored.
6. **Interleave** the new block's occurrences into the target deck's `Cards[]`
   at minimum lag 11, append-only.
7. **Regenerate content for every already-minted card, not just the new
   ones.** A note can be edited after being minted; the fix must reach the
   device on the next publish. `Cards[]` positions and `card_slots` are frozen
   forever — only the `N`/`E`/`X` text of an existing id is overwritten.
   Two different operations, not one: **append** new occurrences, **upsert**
   existing content by id.
8. **`bundle-tool inject-deck`** performs both of those against the base
   bundle's deck/card data modules (locating them by shape, as `patchback`
   already does for JS — `findings.md` §1).
9. **Build `audio.json`** (`{cardId: sha256, …}`) and make sure every
   referenced blob exists at `/blob/<sha256>` — `hub` keeps its own per-build
   snapshot of exactly the audio the device needs, so studying never depends
   on `stabbur` being reachable (D45).
10. Assemble, hash, write a `publications` row (`build_id`, `base_version`,
    `patch_rev`, `data_rev`, `bundle_sha`), then **publish by calling the same
    `tool/` publish module `bin/bundle-tool.js ota-publish` wraps as a CLI**
    (D76) — the buildId regex, the no-reuse-with-different-bytes guard, and
    the magic-prefix check live in exactly one place, in-process for builder,
    shelled out to for the manual path. Write `build_jobs` status.

## When a run happens (D78)

A nightly clock checks every deck against its 6-note floor and runs the
pipeline above automatically for any deck that's crossed it. The operator UI
exposes the same check live — which decks are close, how many notes each
still needs, computed the same way as the real run but **without minting
anything** (a dry run of steps 1–3 only) — plus a "publish now" button to run
immediately instead of waiting for the clock. `hub`'s own UI shows the
resulting history once a publish has actually happened — see
`../hub/README.md`.

## Hard rules — violating these corrupts device progress

- Card ids are **exactly 6 characters** and **permanent**, minted once.
- Published cards are **append-only** — retire via a disabled deck, never by
  removal.
- **Never reorder** a published deck's `Cards[]` — `PullCounter` is a block
  index into it, not a pointer into a stable sort.
- Category deck blocks (C20–C29) stay **contiguous**, appended after C17.

See `tun/docs/03-data-model.md`, `tun/docs/02-services.md`, and
`../docs/findings.md` §1 and C3–C7.
