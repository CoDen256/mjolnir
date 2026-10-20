# builder

Background worker, no web interface. Polls `build_jobs`, pulls ready items and
audio blobs from `stabbur`, projects them into Mjølnir's deck/card format,
assembles a bundle plus an audio manifest, and writes status back.

Owns (D43): `card_slots` (permanent 6-char ids, never reused), deck assignment
C20–C29, card types a–e, projection to N/E/X/A, occurrences, lag-11 interleave.

Hard rules — violating these corrupts device progress:
- card ids are **exactly 6 chars** and permanent
- published cards are **append-only**
- **never reorder** a published deck's `Cards[]` (`PullCounter` is a block index)

See `tun/docs/03-data-model.md` and `../docs/findings.md` C3–C7.
