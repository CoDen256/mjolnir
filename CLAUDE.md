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
Its §2 and §6 contain two errors corrected in the appended "Corrections"
section — always read that section.

`openspec/` holds specs for the bundle tool itself.

## Note on naming

The directory is `mjolnir`, but the npm package, the CLI binary
(`bin/bundle-tool.js`) and the GitHub remote are still called `bundle-tool`.
That is deliberate — the tool keeps its own name; only the repo was regrouped.
