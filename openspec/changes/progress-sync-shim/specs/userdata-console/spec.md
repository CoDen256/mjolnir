## ADDED Requirements

### Requirement: A read-only operator page for progress and device state
The system SHALL provide an operator-facing `hub` page showing an account's
progress and a device's OTA/audio state, with no write actions — the page
only ever reads `userdata`, `userdata_history`, and `device_state`.

#### Scenario: Viewing the page
- **WHEN** the operator opens the page
- **THEN** they see the currently-selected account's progress and the
  currently-selected device's OTA/audio state, with no controls that modify
  either

### Requirement: Account and device are selected independently
The system SHALL provide two independent selectors — one for the account
(`uid`), one for the device (`deviceId`) — rather than one combined picker,
and SHALL continue to list a device that has stopped syncing alongside
currently-active ones.

#### Scenario: Selecting a different device under the same account
- **WHEN** the operator changes the Device ID selector while leaving the
  Account selector unchanged
- **THEN** the progress panels (sourced from `userdata`) do not change, and
  only the device/OTA panels (sourced from `device_state`) update

#### Scenario: A retired device remains selectable
- **WHEN** the operator opens the Device ID selector
- **THEN** every device ever seen for the selected account is listed,
  including ones that have stopped syncing, each showing its own last-seen
  time

### Requirement: The per-card progress table shows card content, not only ids
The system SHALL display, for each entry in the account's per-card progress
list, the card's actual text content (joined from `card_content`), the
occurrence side, the deck, and its SRS state — not the card id alone.

#### Scenario: Viewing per-card progress
- **WHEN** the operator views the per-card progress table
- **THEN** each row shows readable content (e.g. a word or sentence) derived
  from the card's stored `N`/`E` fields, alongside its id, so the operator
  can tell what the card is about without navigating elsewhere

### Requirement: The occurrence direction field is labeled correctly
The system SHALL label the per-card table's occurrence-direction column by
what it represents (e.g. "Side"), and SHALL NOT label it "language" or
otherwise imply it names a spoken language.

#### Scenario: Reading the per-card table
- **WHEN** the operator reads the per-card progress table's column headers
- **THEN** the direction column is labeled in a way that does not suggest
  it holds a language

### Requirement: Sync history is shown as deltas, not raw documents
The system SHALL render `userdata_history` entries as a summary of what
changed relative to the previous entry (e.g. session count, card count),
with the full stored document available on demand rather than shown by
default.

#### Scenario: Viewing sync history
- **WHEN** the operator views the sync history panel
- **THEN** each entry shows a short summary of what changed, and the full
  underlying document is reachable only by explicitly expanding that entry
