## ADDED Requirements

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

### Requirement: A deck publishes only once it has at least 6 newly-eligible notes
The system SHALL NOT mint card_slots or publish any new cards for a deck
whose count of newly-eligible (unminted) notes is below 6, and SHALL
reconsider that deck's held notes on every subsequent run without losing
them.

#### Scenario: A deck with 4 newly-eligible notes
- **WHEN** a run finds 4 unminted, eligible notes assigned to a deck
- **THEN** none of them are minted this run, and all 4 remain eligible for
  the next run

#### Scenario: A deck crosses the floor
- **WHEN** a deck accumulates a 6th newly-eligible note since its last
  publish
- **THEN** all currently-held eligible notes for that deck (6 or more) are
  minted and published together in one run

### Requirement: Every publish regenerates all existing minted cards' content
The system SHALL regenerate the `N`/`E`/`X`/`A` content of every
previously-minted card from stabbur's current note state on every publish
that runs, not only for newly-minted cards, while never altering an existing
card's id, deck assignment, or `Cards[]` position.

#### Scenario: A note is edited after being minted
- **WHEN** a note whose card was minted in an earlier publish is edited on
  stabbur before the next publish
- **THEN** the next publish's bundle reflects the edited content for that
  card's existing id, with its `Cards[]` position and `card_slots` row
  unchanged

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
with both paths subject to the same 6-note floor and eligibility rules.

#### Scenario: Scheduled run with no eligible decks
- **WHEN** the scheduled run executes and no deck has crossed its floor
- **THEN** no build_jobs row is created and no publish occurs

#### Scenario: Operator requests an immediate publish
- **WHEN** the operator triggers a publish from the UI
- **THEN** the pipeline runs immediately, independent of the schedule, and is
  still subject to the 6-note floor

### Requirement: The forecast reflects the same logic as a real run, without minting
The system SHALL expose a dry-run view that executes the same pull,
eligibility, and deck-assignment logic as a real publish, reporting per-deck
counts toward the floor, while performing no writes to `card_slots`, `decks`,
`Cards[]`, or any card content.

#### Scenario: Forecast after a real publish
- **WHEN** the operator views the forecast immediately after a run that
  published everything currently eligible
- **THEN** every deck shows 0 newly-eligible notes, matching the real run's
  outcome

#### Scenario: Forecast does not mutate state
- **WHEN** the operator views the forecast any number of times
- **THEN** no `card_slots` row, `publications` row, or bundle file is created
  as a result
