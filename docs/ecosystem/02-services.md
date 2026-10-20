# Services, boundaries and hosting

## Why these seams

The cut lines are chosen by **blast radius and change cadence**, not by domain
tidiness:

- The **device-facing contract is effectively frozen** (the phone is hard to
  update, and a broken sync loses study progress). It must not share a process
  with code you iterate on daily.
- **Bundle building is a job, not a request** (parses/reassembles a 6 MB bundle,
  may synthesize audio; 30–60 s). It must not run inside a web request.
- **Linguistics providers are shared** by two different clients (lexis triage and
  the browser extension) and are rate-limited/expensive → one cached service.
- **phonexa has frozen parts** (`/stream`, `js/realtime.js`) and a 92 KB
  `formanter.py`. New domains must not be added to that file.

## Service list

| Service | Faces | Contains | Change cadence |
|---|---|---|---|
| **mjolnir-hub** | the phone | `/ota/current.json`, bundle+manifest serving, `/mjolnir/userdata`, device heartbeat | frozen protocol, rare |
| **lexis** | your browser + extension | capture intake, triage UI, items, decks, publish trigger, device status panel | constant |
| **smia** | lexis + extension | `/inflect`, `/ipa`, `/tts`, `/stt`, `/translate` + provider-health UI | occasional |
| **builder** | nothing (worker) | polls `build_jobs`, runs bundle-tool as a library, emits bundle + audio manifest | occasional |
| **phonexa** | your browser | existing phonetics lab, unchanged | rare |
| **postgres** | internal | all schemas | — |
| **caddy** (or nginx) | internet | TLS, routing, **static serving of bundles and blobs** | — |

### Recommended packaging for v1

Run **phonexa + lexis in one container** (separate Flask blueprint, separate
schema, separate module tree `lexis/` — never inside `formanter.py`). Keep
**mjolnir-hub separate**. That preserves the one separation that actually
matters (device-facing vs everything else) while keeping ops small. Split lexis
out later if it grows.

So: `caddy`, `phonexa+lexis`, `smia`, `mjolnir-hub`, `builder`, `postgres` — six
containers.

### What "builder" means

A plain background process with no web interface. Pressing **Publish** in lexis
writes a row into `build_jobs`; the builder notices it, does the work, writes
status/progress back; the web page polls and shows it. Exactly the CI-job
pattern. No Redis/Celery needed for a single user — table polling is enough.

### What caddy/nginx is for

1. **TLS** — one certificate for the whole domain (Caddy does this automatically).
2. **Routing** — `/lexis/*` → lexis, `/ota/*` → hub, `/smia/*` → smia.
3. **Static serving** — the 6 MB bundle and thousands of small mp3s are served
   straight off disk. Python is bad at shoving bytes; a web server is built for
   it. Blobs are immutable and content-addressed, so they get
   `Cache-Control: immutable` and are never revalidated.

Caddy is the better choice here purely because HTTPS is automatic.

## Database layout (one Postgres, several schemas)

```
phonetics : languages, vowels, consonants, samples, tokens,
            sample_analyses, shadowing_media, shadowing_segments, users, settings
lexis     : captures, items, grammar_rules, decks, card_slots,
            publications, build_jobs
hub       : userdata, userdata_history, device_state
smia      : lookup_cache, provider_health
shared    : blobs(sha256 pk, bytes_len, mime, kind, created_at)
```

## Blob store

**Decision: migrate all audio to content-addressed blobs.**

Today phonexa stores sample audio on disk with `Sample.url = "file://<storage_key>"`.
That indirection already exists, so the migration is swapping `storage_key` for
`sha256`. Benefits that pay for it:

- automatic dedup (same clip captured twice = one file)
- immutable URLs → `Cache-Control: immutable`, no invalidation logic anywhere
- **the device's audio cache diff becomes trivial**: compare the manifest's
  hashes against the filenames present on disk
- re-cutting one clip cannot invalidate any other clip
- backups are append-only and incrementally syncable

One store serves: phonexa samples, capture clips, TTS output, and Mjølnir
device audio. Needs refcounting or periodic GC (see `08-pitfalls.md` #20).

## Hosting sizing (Strato)

Whisper is dropped (cloud STT only), which removes the heaviest component.

| Component | RAM |
|---|---|
| Postgres | 256–512 MB |
| phonexa + lexis (numpy/parselmouth in flight) | 300–500 MB |
| smia | ~100 MB |
| mjolnir-hub | ~80 MB |
| builder (peaks while parsing/reassembling a 6 MB bundle) | 500 MB – 1 GB |
| ffmpeg slicing (brief spikes) | 100–200 MB |
| caddy | ~20 MB |

**Floor: 2 vCPU / 4 GB RAM / 80 GB SSD. Comfortable: 4 vCPU / 8 GB.**
Disk drivers: Norsk ordbank import (~1 GB with indexes), audio blobs (grows
with use, 1–5 GB over years), kept bundles (~6 MB × 10). Must be a VPS/root
server — shared hosting cannot run Docker.
