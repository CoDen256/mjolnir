## MODIFIED Requirements

### Requirement: Single persistent app server
The system SHALL provide a command that starts one HTTP server bound to
`127.0.0.1` without requiring a bundle path argument, serving a general
bundle-workbench UI, SHALL make that same UI reachable embedded within hub's
own operator console with no local invocation required (per
`builder-logic-bundle-store`'s embedding), and SHALL resolve its stored-
patches directory to a fixed, deployment-context-independent location rather
than the running process's current working directory.

#### Scenario: Starting the app without a bundle
- **WHEN** a user runs the UI command with no bundle argument
- **THEN** the system starts a local server bound to `127.0.0.1` and serves
  the app shell, with no bundle session open yet

#### Scenario: Patches resolve to the same directory regardless of deployment context
- **WHEN** a patch is saved via a locally-run CLI session and the same
  workbench is later reached embedded inside a deployed hub instance
- **THEN** both see the same patch — the stored-patches directory does not
  depend on either process's own working directory at the time it runs

## ADDED Requirements

### Requirement: Opening a bundle session from an uploaded file
The system SHALL let a user open a bundle session by dropping a file onto the
app (or choosing one via a file picker), without requiring that file to
already exist at a known path on the server's own filesystem.

#### Scenario: Dropping a bundle file
- **WHEN** a user drags a bundle file onto the app and drops it
- **THEN** the system stages the uploaded bytes and opens a session for them,
  identical in every other respect to a session opened by path

#### Scenario: Choosing a file via a file picker
- **WHEN** a user selects a bundle file through a file-picker control instead
  of dragging one
- **THEN** the system opens a session for it the same way a drop does

### Requirement: A catalogue of previously published artifacts is browsable and one-click openable
The system SHALL provide a view listing every previously-published OTA
bundle and every submitted logic bundle, each openable as a session in one
click, without the user needing to know or type its on-disk path.

#### Scenario: Opening a past OTA build from the catalogue
- **WHEN** a user selects a previously-published build from the catalogue
- **THEN** the system opens a session for that exact build's file

#### Scenario: Opening a logic bundle from the catalogue
- **WHEN** a user selects a logic bundle (active or not) from the catalogue
- **THEN** the system opens a session for that exact logic bundle's file

### Requirement: Repeated "open" actions reuse one workbench window
The system SHALL reuse a single, already-open workbench browser window for
subsequent "open this bundle in the workbench" actions, rather than opening
an additional new window or tab each time, so the most recently requested
bundle is always the one visibly selected.

#### Scenario: Opening a second bundle while a workbench window is already open
- **WHEN** a user triggers "open in workbench" for a different bundle while a
  workbench window from an earlier such action is still open
- **THEN** that same window navigates to and selects the newly requested
  bundle, rather than a separate new window opening
