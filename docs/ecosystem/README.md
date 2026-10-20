# Tun — Norwegian learning ecosystem

*Tun: the farmyard — the shared centre every building faces.*

**Start here.** This directory is the single source of truth for the cross-repo
ecosystem (phonexa + mjølnir/bundle-tool + hover-translate + new services).
It is written to survive between sessions: if you remember nothing else,
read this file and `07-decisions.md`.

## The one-sentence goal

Hover a sentence in Norwegian video → it becomes a spaced-repetition card with
real audio in the modded Mjølnir app, and everything in between is inspectable
and editable by you.

## Map of documents

| File | What's in it | Read when |
|---|---|---|
| `01-vision-and-scope.md` | The five modules, what each does, the primary loop | Orienting / onboarding |
| `02-services.md` | Service boundaries, deployment, hosting sizing | Designing or deploying anything |
| `03-data-model.md` | capture / item / deck / card types, projection, ID scheme | Touching content or the DB |
| `04-delivery.md` | OTA bundle fetch, audio cache, versioning, rollback | Working on the device pipeline |
| `05-sync.md` | Progress backup, the Firestore shim, restore | Working on progress data |
| `06-smia.md` | Linguistics service (inflect/ipa/tts/stt/translate) | Working on enrichment |
| `07-decisions.md` | **ADR log — every decision + why** | Always. Before changing a decision. |
| `08-pitfalls.md` | Known traps, with handling | Before implementing any phase |
| `09-open-questions.md` | Unresolved, with enough context to resume | When picking up again |
| `10-roadmap.md` | Phases, ordering, what to do first | Deciding what to work on |

Mjølnir app internals (reverse-engineering findings) live in the **mjolnir**
repo as `docs/findings.md` (today: `bundle-tool/docs/mjolnir-findings.md`) — that is the authority on how the stock app behaves.

## Related repos

| Repo | Role |
|---|---|
| `tun` | deployment (compose, Caddy, backups), **these docs**, shared UI shell |
| `mjolnir` | `docs/findings.md`, tool, JS + native patches, apk pipeline, builder, hub |
| `stabbur` | captures, items, enrichment, triage UI, audio blobs |
| `smia` | linguistics providers (inflect / ipa / tts / stt / translate) |
| `phonexa` | phonetics lab (existing) |
| `hover-translate` | capture client (existing fork) |

**Repo moves are pending** — today everything still sits in
`/home/coden/dev/bundle-tool`, `/home/coden/dev/phonexa`,
`/home/coden/dev/hover-translate` and `/home/coden/rev/mjolnir/`.

## Status

Design phase. Nothing implemented yet. No OpenSpec change created yet.
See `10-roadmap.md` for the proposed first unit of work.
