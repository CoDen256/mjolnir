## ADDED Requirements

### Requirement: Device-facing userdata endpoints
The system SHALL expose `GET`, `PATCH`, `POST`, and `DELETE` at
`/mjolnir/userdata/{deviceId}`, mirroring the document shape a Firestore
`userData/{uid}` document would have had.

#### Scenario: Reading a device's progress
- **WHEN** a `GET` request is made for a given device id
- **THEN** the system returns that device's stored document

#### Scenario: Updating a device's progress
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

### Requirement: Device status piggybacks on the same PATCH payload
The system SHALL accept `activeBuildId`, `pendingBuildId`, `audioCached`,
`audioTotal`, and `lastFetchError` fields on the same `PATCH` request used
for progress sync, and SHALL store them in `device_state` rather than
requiring a separate request.

#### Scenario: A sync request carrying device status
- **WHEN** a `PATCH` request includes `activeBuildId`/`audioCached`/etc.
  alongside progress fields
- **THEN** `device_state` for that device is updated from the same request,
  with no second endpoint call required
