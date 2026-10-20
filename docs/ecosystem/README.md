# Norwegian learning ecosystem — documentation index

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

Mjølnir app internals (reverse-engineering findings) live one level up in
`../mjolnir-findings.md` — that is the authority on how the stock app behaves.

## Related repos

| Repo | Role |
|---|---|
| `/home/coden/dev/bundle-tool` | Mjølnir bundle analysis/patching + these docs |
| `/home/coden/dev/phonexa` | Phonetics lab (Flask + Postgres); future home of lexis |
| `/home/coden/dev/hover-translate` | Chrome/Firefox/Edge MV3 capture client |
| `/home/coden/rev/mjolnir/0306.orig/orig` | Decompiled APK, smali, rebuild pipeline |

## Status

Design phase. Nothing implemented yet. No OpenSpec change created yet.
See `10-roadmap.md` for the proposed first unit of work.
