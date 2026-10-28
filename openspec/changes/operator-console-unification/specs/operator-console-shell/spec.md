## ADDED Requirements

### Requirement: Hub, builder, and the workbench are presented as sections of one page
The system SHALL provide a single page presenting Cards, Builder, OTA, and
Tools as sections of one unified operator console, without requiring the
operator to navigate between separately-styled, separately-addressed service
endpoints to reach each one.

#### Scenario: Switching between sections
- **WHEN** the operator selects a different section (Cards, Builder, OTA, or
  Tools) on the unified console
- **THEN** that section's existing page is shown within the same overall
  page, with no full navigation to a visually distinct service endpoint

#### Scenario: Each section remains independently reachable
- **WHEN** the operator navigates directly to one service's own existing page
  (not through the unified console)
- **THEN** that page still works exactly as it did before the unified console
  existed

### Requirement: The unified console does not require merging hub and builder into one backend process
The system SHALL achieve the unified presentation without combining hub's and
builder's independently-deployed backend processes into a single process.

#### Scenario: Hub and builder remain independently deployable
- **WHEN** hub and builder are deployed as separate containers/processes, as
  before this change
- **THEN** the unified console still presents both correctly, with no
  requirement that they run as one process
