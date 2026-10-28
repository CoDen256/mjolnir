## ADDED Requirements

### Requirement: A card's rendered content can be previewed in the stock app's own visual style
The system SHALL provide, for any card, a preview of its N/E/X content
rendered using the real Mjølnir app's own extracted colors, fonts, and
emphasis styling, not an approximation invented independently of the app.

#### Scenario: Previewing a card with multiple styled fields
- **WHEN** the operator opens the preview for a card whose content uses the
  app's own emphasis classes (e.g. bold, teal, red, left-aligned text)
- **THEN** the preview renders each field with those same visual treatments,
  matching the colors/weights the real app itself uses for them

#### Scenario: Previewing a card with no special styling
- **WHEN** the operator opens the preview for a card with plain, unstyled
  content
- **THEN** the preview still renders using the app's base font and text color

### Requirement: The preview indicates which face carries the card's audio
The system SHALL visually flag whichever of the card's N/E/X faces its audio
is attached to, and SHALL offer real playback of that audio when the
underlying clip is available on disk, degrading to a non-playable indicator
when it is not.

#### Scenario: Audio is available
- **WHEN** the card's audio clip exists in the audio blob cache
- **THEN** the preview's flagged face offers a working audio player for that
  clip

#### Scenario: Audio is not available
- **WHEN** the card's audio clip is not present in the audio blob cache
- **THEN** the preview's flagged face still shows which face the audio
  belongs to, with no non-functional player presented as if it worked
