## ADDED Requirements

### Requirement: A deck's displayed completion percentage never exceeds 100%
The system SHALL cap the displayed completion percentage for any deck at
100, regardless of the underlying batch-counted value that drives it.

#### Scenario: A deck whose total occurrence count isn't a multiple of 5
- **WHEN** a deck's occurrence count is such that the underlying
  `PullCounter`-based calculation would exceed 100 once the deck is fully
  exhausted of new cards
- **THEN** the displayed completion percentage reads 100, not a value above
  it

#### Scenario: A deck that is only partially drawn
- **WHEN** a deck still has undrawn new cards remaining
- **THEN** the displayed completion percentage is unchanged from current
  behavior (this requirement only caps the ceiling, it does not alter
  in-progress values)

### Requirement: Starting a session never shows a false "already completed" interstitial
The system SHALL always attempt to draw new cards when the user starts a
session, regardless of any deck's displayed completion percentage. The
"No new cards for today" result SHALL be determined solely by whether the
draw itself returns any cards, never by a deck's completion percentage.

#### Scenario: Starting a session when a deck's completion reads 100% but new cards remain
- **WHEN** the user presses "Start today's session" and a selected deck's
  displayed completion is at or above 100%, due to the batch-counting
  imprecision
- **THEN** the session starts immediately, with no interstitial blocking
  the first press, and any cards the deck genuinely still has to offer are
  drawn normally

#### Scenario: Starting a session when every selected deck is genuinely exhausted
- **WHEN** the user presses "Start today's session" and every selected deck
  has no new cards left to draw
- **THEN** the existing "No new cards for today!" message is shown, driven
  by the actual draw result — not by any deck's completion percentage
