## Why

`runPublish` consumes occurrences durably long before it records where they
went, with no transaction spanning the gap. `flushShippable`
(`builder/src/stagedOccurrences.js`) `DELETE`s the rows it returns, and
`drainPendingOccurrences` (`builder/src/pendingOccurrences.js`) deletes the
queue rows that reached `remaining <= 0`. Both run inside `flushDeck`, which
`runPublish` calls *before* `publish()`, `writePublication` and
`recordShipments`. A failure anywhere in that window destroys occurrences
that were never written to `occurrence_shipments` — and since `replay()`
rebuilds every deck's `Cards[]` purely from `occurrence_shipments`, there is
nothing left to reconstruct them from. The in-memory model that held them is
discarded by `runPublish`'s own `finally`.

This is not theoretical. It fired on 2026-11-09 18:59:50, where an unrelated
ffmpeg failure in `ensureBlobsPresent` (fixed separately in 8152076e /
e60bdd36) killed a run after this log line:

```
ship: C30 — 140 occurrence(s) flushed (105 -> 245)
ship: C20 — 40 occurrence(s) flushed (5 -> 45)
```

180 occurrences were deleted from `staged_occurrences`; `occurrence_shipments`
still held 110 rows afterwards, exactly its pre-run count. Most of the loss
self-healed on the next publish via the D86 path (card in hub's ledger, absent
from the bundle, so its occurrences are re-staged from scratch), which is
precisely why this gap has gone unnoticed. What does *not* self-heal is any
occurrence belonging to a card that already has a shipped occurrence: `replay`
recreates that card, so the D86 "is it missing from the model?" check sees it
as present and never re-stages it. Thirteen `E` occurrences (C30049–C30061)
were lost that way and had to be restored by hand from a database backup.
Verified both directions against a real Postgres: with the queue row deleted,
no subsequent publish ever brings the occurrence back (`pending 0, staged 0,
shipped 0` after a run with 15 fresh `A`s landing in the same deck);
re-inserting the pre-crash row returns it to the pipeline and it ships.

D-H1 already establishes the intended invariant for the *shipment log* — "a
run that fails anywhere above this line leaves zero shipment rows" — but the
converse is unprotected: a run that fails can leave *negative* shipment rows,
in the sense of occurrences consumed and never logged. D-F1's "one bad note
must not fail the whole publish" principle makes this worse, not better: the
failure modes it tolerates are exactly the ones that leave the gap half-open.

## What Changes

- Make occurrence consumption and occurrence recording atomic with respect to
  one another, so no publish can delete a staged or pending row without
  durably recording where that occurrence went.
- The preferred shape (to be settled in `design.md`) is to move the whole
  mutate-and-record span into a single Postgres transaction, rather than to
  add compensating cleanup on the error path — a transaction is the only
  version that is also correct when the process is killed outright, which is
  the case a `catch` block cannot cover. This conflicts with the current
  `pool`-per-query style throughout `pipeline.js` and with
  `occurrence_shipments.build_id`'s FK to `publications` (the shipment rows
  cannot be written before the publication row exists), so the design has to
  resolve ordering, not just wrap the existing calls.
- Add a regression test that kills a run between flush and record and asserts
  no occurrence is lost — the failing-run case the suite currently has no
  coverage for at all. `builder/test/pipeline.test.js`'s existing D86 case
  covers the *self-healing* half of this and passes today, which is what made
  the non-self-healing half invisible.
- Out of scope: the already-committed audio fixes, and the separate
  `drainThenQueue` ordering question noted below.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `builder-pipeline`: a publish run either completes, or leaves
  `staged_occurrences`/`pending_occurrences` exactly as it found them. No
  partial run may consume an occurrence without recording it.

## Open Questions

- **Ordering vs the FK.** `occurrence_shipments.build_id` references
  `publications.build_id`, so shipments cannot be recorded until the
  publication row exists, but the flush that consumes them currently runs
  much earlier (the bundle has to contain the occurrences before it can be
  built and published). Options: defer the deletes to after
  `writePublication`; write shipments with the publication row in one
  transaction; or stage a "claimed" marker that a later step converts.
- **Related but distinct.** On the recovery run after this failure, the 127
  `E` rows the crashed run had durably queued at `remaining = 11` were
  decremented by the D86 path's *per-card* `drainThenQueue` calls, so they all
  drained in the same run that re-staged their own cards' `A`s. That breaks
  `drainThenQueue`'s documented guarantee that "a card's own just-queued `E`
  is never decremented by the very batch of `A`s that created it" — the
  per-deck ordering that guarantees it does not hold on the per-card recovery
  path. Worth deciding whether that belongs in this change or its own.
