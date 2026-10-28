## MODIFIED Requirements

### Requirement: Device status piggybacks on the same PATCH payload, keyed by device id
The system SHALL accept `deviceId` (a locally-generated identifier,
independent of the uid), `activeBuildId`, `pendingBuildId`, `audioCached`,
`audioTotal`, and `lastFetchError` fields on the same `PATCH` request used
for progress sync, and SHALL store them in `device_state` keyed by
`deviceId` — never by the uid in the request path — rather than requiring a
separate request.

#### Scenario: A sync request carrying device status
- **WHEN** a `PATCH` request includes `deviceId`, `activeBuildId`,
  `audioCached`/etc. alongside progress fields
- **THEN** `device_state` for that `deviceId` is updated from the same
  request, with no second endpoint call required, and `userdata` for the
  path's uid is updated independently of which device sent the request

#### Scenario: Two devices on one account report different state
- **WHEN** two devices with different `deviceId`s, both signed into the
  same uid, each send a `PATCH` with their own device status
- **THEN** `device_state` ends up with two separate rows, one per
  `deviceId`, neither overwriting the other

#### Scenario: A retired device's last state is still readable
- **WHEN** a device stops syncing (e.g. replaced by a new one) and a
  different device continues syncing under the same uid
- **THEN** the retired device's `device_state` row keeps its last-reported
  values rather than being overwritten or removed
