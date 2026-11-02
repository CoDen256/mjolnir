## ADDED Requirements

### Requirement: Device-facing userdata endpoints
The system SHALL expose `GET`, `PATCH`, `POST`, and `DELETE` at
`/mjolnir/userdata/{uid}`, keyed by the real Firebase Auth uid (D-S1),
mirroring the document shape a Firestore `userData/{uid}` document would
have had.

#### Scenario: Reading an account's progress
- **WHEN** a `GET` request is made for a given uid
- **THEN** the system returns that account's stored document

#### Scenario: Updating an account's progress
- **WHEN** a `PATCH` request is made with a partial document
- **THEN** the system merges the provided fields into the existing stored
  document rather than replacing it

### Requirement: `GET` never reports a document as missing
The system SHALL auto-create a row with factory-default content the first
time `GET` is called for a given device id that has no existing row, and
SHALL respond identically to how it would for an existing row — never a
"not found" response for this endpoint.

#### Scenario: First-ever request for a device id
- **WHEN** `GET /mjolnir/userdata/{deviceId}` is called for a device id with
  no existing row
- **THEN** a new row is created with factory-default content and returned,
  with no "not found" response

### Requirement: Every write is recorded in an append-only history
The system SHALL insert a row into `userdata_history` (device id, the full
resulting document, a timestamp) on every `PATCH`/`POST`/`DELETE`, in
addition to updating the current `userdata` row.

#### Scenario: A progress update
- **WHEN** a `PATCH` request successfully updates a device's document
- **THEN** a new `userdata_history` row is written recording the resulting
  document and when it happened, and the previous history rows are never
  modified or removed

### Requirement: Stray device-status fields are stripped, never merged into the synced document
The system SHALL NOT merge `deviceId`, `activeBuildId`, `pendingBuildId`,
`audioCached`, `audioTotal`, or `lastFetchError` — if present on a `PATCH`
body — into the stored `userdata` document; these keys are discarded
rather than treated as progress content.

Note (D126): an earlier version of this requirement described these fields
being written to a `device_state` table, keyed by a separate per-device id,
on the same `PATCH`. That mechanism never actually populated in production
(the device side never sent the fields it needed) and was removed entirely
— see `tun/docs/07-decisions.md` D126. The fields are now stripped purely
for backward compatibility with an older installed build that might still
send them, not written anywhere.

#### Scenario: A PATCH carrying a stray device-status field
- **WHEN** a `PATCH` request includes `activeBuildId`/`audioCached`/`deviceId`/etc.
  alongside progress fields
- **THEN** the resulting stored document contains none of those keys
