## ADDED Requirements

### Requirement: Stock card playback is unaffected
The system SHALL play a stock-prefixed card's audio (`a`, `b`, `c01`–`c17`,
`z`) via the existing local `playSoundFile` path, byte-identical to
unpatched behavior, regardless of network state.

#### Scenario: Playing a stock card
- **WHEN** a card id with a stock prefix is played
- **THEN** the app calls the native module's `playSoundFile`, exactly as
  before this change

### Requirement: Any non-stock card plays via URL
The system SHALL play any card id that does not match a known stock prefix
via the native module's `playUrl`, built from a configured base URL, the
card id, and its file extension.

#### Scenario: Playing a custom card
- **WHEN** a card id that is not a stock prefix is played (including any
  future rollover deck beyond C20–C29)
- **THEN** the app calls the native module's `playUrl` with a URL built from
  the card id, rather than `playSoundFile`

### Requirement: No reachability check or fallback in this version
The system SHALL NOT perform a reachability check before attempting URL
playback, and SHALL NOT fall back to any other playback path if the URL is
unreachable — the clip simply does not play.

#### Scenario: The audio URL is unreachable
- **WHEN** a non-stock card is played while the device has no connectivity
  to the audio URL's host
- **THEN** no audio plays and no fallback attempt is made, with no crash or
  visible error

### Requirement: Every published card's audio is also available at a predictable, card-id-keyed static URL
The system SHALL write, as part of every publish that includes audio, a
static file reachable at a predictable URL derived from the card id, in
addition to the existing content-addressed blob.

#### Scenario: A card is published with audio
- **WHEN** `builder` publishes a build including a card with audio
- **THEN** that card's audio bytes are available both at the existing
  `/blob/<sha256>` path and at a static, card-id-keyed path, serving
  identical bytes

### Requirement: The card-id-keyed audio path requires no authentication
The system SHALL serve the card-id-keyed audio path as a plain static file,
reachable with no operator authentication, consistent with every other
device-facing path.

#### Scenario: A device requests a card's audio with no credentials
- **WHEN** the device requests the card-id-keyed audio URL with no
  authentication header or cookie
- **THEN** the file is served successfully
