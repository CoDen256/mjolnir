## ADDED Requirements

### Requirement: mod 2080's sync handle is replaced with a work-alike shim
The system SHALL replace mod 2080's `userDataCollection` field with a shim
object exposing the same `.doc(id).get()` / `.ref.set()` / `.ref.update()` /
`.ref.delete()` shape as the Firestore collection it replaces, and SHALL NOT
modify any method body in mod 2080.

#### Scenario: An existing sync call after patching
- **WHEN** `updateSessionUserData` (or any other mod 2080 method) is called
  after this patch is applied
- **THEN** it executes with no code changes to its own body, operating on
  the shim instead of Firestore

### Requirement: The shim is keyed by the real Firebase Auth uid
The system SHALL use whatever id mod 2080 passes to `.doc(id)` (the real
Firebase Auth `uid`) as the server-side key, with no new locally-generated
device identifier and no call-site changes.

#### Scenario: Signing in on a replacement device
- **WHEN** the operator signs in with the same Google/Apple account on a
  different device
- **THEN** the shim resolves to the same server-side document as the
  original device, continuing the same progress history

### Requirement: The shim never reports a document as not existing
The system SHALL NOT ever return a "does not exist" result from the shim's
`.get()` — every write method in mod 2080 is unconditionally gated on
`doc.exists` with no recovery path, so a false negative here silently and
permanently blocks every future sync.

#### Scenario: The very first sync for a given uid
- **WHEN** a device's uid has never been seen by the server before and a
  mod 2080 method calls `.get()` on it
- **THEN** the shim returns a result reporting the document exists, with
  factory-default content

### Requirement: Timestamp fields expose `.toDate()`
The system SHALL return any timestamp-shaped field (e.g.
`accountCreationDate`) from the shim's `data()` as an object exposing a
`.toDate()` method, matching Firestore's `Timestamp` interface, since mod
2080 calls `.toDate()` directly on it.

#### Scenario: Reading accountCreationDate
- **WHEN** `updateSessionUserData` reads `f.accountCreationDate.toDate()`
  from a document the shim returned
- **THEN** the call succeeds and returns a `Date`

### Requirement: A startup module restores local state when none exists yet, independent of sign-in
The system SHALL run a module at every app launch, before redux-persist
rehydration, that writes the server's document into `persist:primary` if no
local restore has happened yet and the server has a document for this
device's uid, and SHALL NOT repeat this check once local data exists.

#### Scenario: First launch of the patched app on a device with existing local progress
- **WHEN** the patched app launches on a device whose local `persist:primary`
  already has progress
- **THEN** the startup module takes no restorative action beyond recording
  that the check has run, and existing local data is undisturbed

#### Scenario: A fresh install or reinstall with no local progress
- **WHEN** the patched app launches with no local `persist:primary` data and
  the server already has a document for the signed-in uid
- **THEN** the startup module writes that document into `persist:primary`
  before redux-persist rehydrates

### Requirement: Sign-in-triggered restore continues to work unmodified
The system SHALL NOT modify the sign-in success handlers (mods 2114, 2205)
that call `initUserData()` followed by `getUserData()` — this restore path
continues to work against the shim exactly as it worked against Firestore.

#### Scenario: Signing in after this change
- **WHEN** the operator completes a Google or Apple sign-in after this
  change is installed
- **THEN** `initUserData()` and `getUserData()` fire exactly as before,
  now reading/writing through the shim
