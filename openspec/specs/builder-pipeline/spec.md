# builder-pipeline

## Purpose

Defines the publish pipeline that pulls ready notes from stabbur, determines
eligibility and deck assignment, mints and regenerates card content, and
drives both scheduled and on-demand publishing, including the dry-run
forecast view.

## Requirements

### Requirement: Only audio-bearing ready notes are eligible
The system SHALL exclude any note lacking an `audio_blob` from eligibility,
regardless of its `type`, with no exception for any note type.

#### Scenario: A ready note with no audio
- **WHEN** builder pulls notes from stabbur and a returned note has
  `status=ready` but no `audio_blob`
- **THEN** that note is excluded from the current run and reconsidered on the
  next run

### Requirement: Deck assignment by type, then by PoS, with a catch-all
The system SHALL assign each eligible `type=word` note to a deck based on its
`pos` using the fixed substantiv/adjektiv/verb/adverb/preposisjon/
konjunksjon-subjunksjon mapping, SHALL assign every other type to its fixed
deck, and SHALL assign any note whose `pos` does not match the word-deck
mapping to the `expression` deck (C26), regardless of its `type`.

#### Scenario: A word note with an unmapped PoS
- **WHEN** an eligible `type=word` note's `pos` is not substantiv, adjektiv,
  verb, adverb, preposisjon, or konjunksjon/subjunksjon
- **THEN** it is assigned to the expression deck (C26) rather than left
  unassigned

### Requirement: Every deck with at least one newly-eligible note mints that run
The system SHALL NOT withhold minting a newly-eligible note based on how
many other notes are newly-eligible in the same deck — **superseded by
D91** (operator decision, 2026-10-25): the original 6-note floor is removed
entirely. A card's first occurrence (`A`, or a single-occurrence type's own
letter) becomes eligible — and is staged — the run it is minted (see
`occurrence-shipment-windowing`: staging ≠ shipping, builder-sliding-
window-shipping); any remaining occurrence for a multi-occurrence type is
queued in a persisted, cross-batch table and drained (then itself staged,
not appended) once 11 other occurrences have landed in that deck, across
however many subsequent publishes that takes (see
`tun/docs/03-data-model.md`'s "Appending new cards to an existing deck").

#### Scenario: A deck with 1 newly-eligible note
- **WHEN** a run finds exactly 1 unminted, eligible note assigned to a deck
- **THEN** it is minted and its first occurrence is staged this run, with no
  minimum batch size required for minting itself (whether it also flushes
  into `Cards[]` this run depends on `occurrence-shipment-windowing`'s
  multiple-of-5 rule, independent of minting)

#### Scenario: A multi-occurrence card's second occurrence is queued, not dropped
- **WHEN** a word/expression note is minted and its card's occurrence set is
  `{A, E}`
- **THEN** `A` is staged this run (not appended directly), and `E` is queued
  at `remaining = 11` rather than staged immediately

#### Scenario: A queued occurrence drains once enough new occurrences land
- **WHEN** a deck's cumulative count of newly-staged occurrences since a
  pending row was queued reaches 11
- **THEN** the pending row is removed and its occurrence is staged (not
  appended directly to `Cards[]` — occurrence-shipment-windowing)

#### Scenario: A deck with no new cards in a run leaves its queue untouched
- **WHEN** a run mints no new cards for a given deck
- **THEN** that deck's pending occurrence rows are not decremented this run

### Requirement: Every publish regenerates all existing minted cards' content
The system SHALL regenerate the `N`/`E`/`X`/`A` content of every
previously-minted card from stabbur's current note state on every publish
that runs, not only for newly-minted cards, while never altering an existing
card's id, deck assignment, or `Cards[]` position, and SHALL persist each
regenerated card's content into `card_content` so it survives independently
of any bundle file.

#### Scenario: A note is edited after being minted
- **WHEN** a note whose card was minted in an earlier publish is edited on
  stabbur before the next publish
- **THEN** the next publish's bundle reflects the edited content for that
  card's existing id, with its `Cards[]` position and `card_slots` row
  unchanged, and `card_content` for that card is overwritten with the new
  content

#### Scenario: A note is tombstoned after being minted
- **WHEN** a note whose card was minted in an earlier publish is later
  tombstoned on stabbur (excluded from every future pull)
- **THEN** the next publish's bundle still includes that card with its last
  known content, read from `card_content`, not blank or missing

### Requirement: The pipeline is a stateless projection onto the active logic bundle
The system SHALL NOT depend on any single persistent, incrementally-mutated
bundle file to carry forward deck/card state between publishes. Every
publish run SHALL start from the currently-active `logic_bundles` entry and
fully reconstruct the deck/card data from `card_slots`, `card_content`,
`occurrence_shipments`, and `pending_occurrences`, before minting or
appending anything newly eligible.

#### Scenario: The active logic bundle changes between two publishes
- **WHEN** an operator activates a different `logic_bundles` row between one
  publish and the next
- **THEN** the next publish builds its deck/card data onto the newly-active
  bundle, with every previously-minted card's content and occurrence order
  reconstructed from `hub`'s own tables, not read from any file left behind
  by the previous publish

#### Scenario: Occurrence order is reconstructed, not read from a file
- **WHEN** a publish run reconstructs a deck's `Cards[]` array
- **THEN** the order matches `occurrence_shipments` ordered by id for that
  deck, exactly as it was when each occurrence actually shipped

### Requirement: Projection from note type to card shape is pure and stateless
The system SHALL derive a card's `{N, E, X, A}` fields and its occurrence set
solely from the note's `type` (and its content), computing this fresh on
every run rather than reading a stored projection.

#### Scenario: Re-running projection on unchanged input
- **WHEN** the same note is projected twice with no change to its content or
  type
- **THEN** both projections produce identical `{N, E, X, A}` output

### Requirement: Publishing triggers on a schedule and on demand
The system SHALL run the full pipeline automatically on a recurring schedule,
and SHALL additionally run it immediately on an explicit operator request,
with both paths subject to the same eligibility rules (no floor — D91).

#### Scenario: Scheduled run with no eligible notes anywhere and nothing ever minted
- **WHEN** the scheduled run executes, no deck has any newly-eligible note,
  and no note has ever been minted
- **THEN** no build_jobs row is created and no publish occurs

#### Scenario: Scheduled run with nothing new but something already minted (D103)
- **WHEN** the scheduled run executes, no deck has any newly-eligible note,
  but at least one note has been minted previously
- **THEN** a build job still runs: already-minted content is regenerated and
  a publish is still attempted — "nothing new" is not treated as "nothing
  to do," since an earlier run's mint may have succeeded while its publish
  step failed, and no later run may otherwise ever retry completing it

#### Scenario: Operator requests an immediate publish
- **WHEN** the operator triggers a publish from the UI
- **THEN** the pipeline runs immediately, independent of the schedule

### Requirement: The forecast reflects the same logic as a real run, without minting
The system SHALL expose a dry-run view that executes the same pull,
eligibility, and deck-assignment logic as a real publish, reporting the
actual `(card, side, note)` occurrences that would become eligible and the
occurrences that would be newly queued (eligible in a later run, not this
one) — not a per-deck count — while performing no writes to `card_slots`,
`decks`, `Cards[]`, `pending_occurrences`, `occurrence_shipments`,
`staged_occurrences`, or any card content. Because becoming eligible no
longer means shipping immediately (occurrence-shipment-windowing), each
eligible entry SHALL also report whether this run's flush would actually
ship it or merely stage-and-hold it, and the per-deck report SHALL surface
each deck's staged-before-this-run/would-flush/would-hold counts so an
operator can't mistake "eligible" for "ships today."

#### Scenario: Forecast after a real publish
- **WHEN** the operator views the forecast immediately after a run that
  published everything currently eligible
- **THEN** no occurrences appear in the "would become eligible" list,
  matching the real run's outcome

#### Scenario: Forecast distinguishes becoming eligible from queuing
- **WHEN** the forecast includes a newly-eligible word-type note
- **THEN** its `A` occurrence appears in the eligible list and its `E`
  occurrence appears separately in the "would queue" list

#### Scenario: Forecast distinguishes shipping from staging-and-holding
- **WHEN** a deck's existing staged count plus what this run would newly
  stage reaches a multiple of 5
- **THEN** the eligible entries within that flushed window are reported as
  actually shipping this run; any entries beyond it are reported as staged
  and held, not shipping

#### Scenario: Forecast does not mutate state
- **WHEN** the operator views the forecast any number of times
- **THEN** no `card_slots` row, `publications` row, or bundle file is created
  as a result

#### Scenario: A deck's pending queue depth is shown even with zero newly-eligible notes today
- **WHEN** a deck has one or more rows in `pending_occurrences` but zero
  newly-eligible notes in the current forecast
- **THEN** that deck still appears in the forecast's per-deck report, with its
  real, current pending-occurrence queue depth — not omitted

#### Scenario: The forecast predicts which existing cards' content would change
- **WHEN** an already-minted note's content (or the projection logic itself)
  has changed since that card's content was last stored
- **THEN** the forecast reports that card's id among the cards whose content
  would be updated by the next publish, distinct from newly-minted cards

#### Scenario: The forecast reports no content changes when nothing changed
- **WHEN** no already-minted note's content differs from what's currently
  projected for it
- **THEN** the forecast's would-update list is empty

### Requirement: Audio manifest entries respect a note's trim selection
The system SHALL produce a card's audio manifest entry from the bytes
selected by `audio_sel_ms` when present, rather than the full original blob,
and SHALL leave the original blob in stabbur's canonical store untouched.

#### Scenario: A note with a trim selection
- **WHEN** a card's source note has `audio_sel_ms` set to a sub-range of its
  `audio_blob`
- **THEN** the audio manifest entry for that card references bytes trimmed
  to that range, and the original untrimmed blob remains available and
  unmodified

#### Scenario: A note with no trim selection
- **WHEN** a card's source note has `audio_sel_ms` null
- **THEN** the audio manifest entry references the original blob unchanged

### Requirement: Draining the occurrence queue is deterministic
The system SHALL drain pending occurrences in a fixed, reproducible order
(insertion order) when multiple rows reach `remaining <= 0` in the same run.

#### Scenario: Two rows cross zero in the same run
- **WHEN** two pending occurrences in the same deck both reach
  `remaining <= 0` during one run's drain step
- **THEN** the one queued earlier is always appended to `Cards[]` before the
  one queued later, on every run given the same inputs
