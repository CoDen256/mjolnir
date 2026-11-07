# CLAUDE.md

## mjolnir — part of the Tun ecosystem

This repo owns **everything that knows the Mjølnir bundle format or talks to the
device**: the bundle tool, the JS patch set, the native patch source, the APK
rebuild pipeline, the builder, and the device-facing hub.

Sibling repos: `tun` (deployment + ecosystem docs), `stabbur` (learning content),
`smia` (linguistics), `phonexa` (phonetics lab), `hover-translate` (capture client).

**Cross-repo design, decisions, pitfalls and the roadmap live in
`/home/coden/dev/tun/docs/` — start at `README.md`, then `07-decisions.md`.**
Do not re-derive settled decisions.

**Mjølnir app internals (reverse-engineering record): `docs/findings.md`.**
It has **two** appended correction sections and both supersede the body —
always read them before trusting §2 or §6:

- "Corrections and additional findings (2026-10-20)" (C1–C12), bundle-derived.
- "Corrections from real device data (2026-11-07)" (R1–R10), derived from a
  real 4,510-occurrence synced account. R1–R3 overturn §6's reading of
  `Time`, `Stage` and (against C2) `CF`; R4–R5 pin down the auto-park and
  auto-tag rules §6 left untraced.

`openspec/` holds specs for the bundle tool itself.

## Note on naming

The directory is `mjolnir`, but the npm package, the CLI binary
(`bin/bundle-tool.js`) and the GitHub remote are still called `bundle-tool`.
That is deliberate — the tool keeps its own name; only the repo was regrouped.
