## ADDED Requirements

### Requirement: Device-facing userdata endpoints, keyed by account
The system SHALL expose `GET`, `PATCH`, `POST`, and `DELETE` at
`/mjolnir/userdata/{uid}`, mirroring the document shape a Firestore
`userData/{uid}` document would have had, where `{uid}` is the real Firebase
Auth uid — not a per-device identifier — so progress follows the account
across devices.

#### Scenario: Reading an account's progress
- **WHEN** a `GET` request is made for a given uid
- **THEN** the system returns that account's stored document

#### Scenario: Updating an account's progress
- **WHEN** a `PATCH` request is made with a partial document
- **THEN** the system merges the provided fields into the existing stored
  document rather than replacing it

#### Scenario: The same account synced from two devices
- **WHEN** two different devices, both signed into the same account, send
  `PATCH` requests to the same uid
- **THEN** both merge into the same stored document, with no separate
  per-device progress record

### Requirement: `GET` never reports a document as missing
The system SHALL auto-create a row with factory-default content the first
time `GET` is called for a uid that has no existing row, and SHALL respond
identically to how it would for an existing row — never a "not found"
response for this endpoint.

#### Scenario: First-ever request for a uid
- **WHEN** `GET /mjolnir/userdata/{uid}` is called for a uid with no
  existing row
- **THEN** a new row is created with factory-default content and returned,
  with no "not found" response

### Requirement: Every write is recorded in an append-only history
The system SHALL insert a row into `userdata_history` (uid, the full
resulting document, a timestamp) on every `PATCH`/`POST`/`DELETE`, in
addition to updating the current `userdata` row.

#### Scenario: A progress update
- **WHEN** a `PATCH` request successfully updates an account's document
- **THEN** a new `userdata_history` row is written recording the resulting
  document and when it happened, and the previous history rows are never
  modified or removed

### Requirement: Device status is keyed by device id, independently of the account
The system SHALL accept a `deviceId` field (a locally-generated identifier,
not the uid) on the same `PATCH` request used for progress sync, alongside
`activeBuildId`, `pendingBuildId`, `audioCached`, `audioTotal`, and
`lastFetchError`, and SHALL store these in `device_state` keyed by
`deviceId`, never by the uid in the request path.

#### Scenario: A sync request carrying device status
- **WHEN** a `PATCH` request to `/mjolnir/userdata/{uid}` includes a
  `deviceId` plus `activeBuildId`/`audioCached`/etc.
- **THEN** `device_state` for that `deviceId` is updated from the same
  request, with no second endpoint call required, and `userdata` for `{uid}`
  is updated independently of which `deviceId` sent the request

#### Scenario: Two devices on one account report different state
- **WHEN** two devices with different `deviceId`s, both signed into the same
  uid, each send a `PATCH` with their own device status
- **THEN** `device_state` ends up with two separate rows, one per
  `deviceId`, neither overwriting the other

#### Scenario: A retired device's last state is still readable
- **WHEN** a device stops syncing (e.g. replaced by a new one) and a
  different device continues syncing under the same uid
- **THEN** the retired device's `device_state` row keeps its last-reported
  values rather than being overwritten or removed
