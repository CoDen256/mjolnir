# Deploying mjolnir

> **Status: re-verified 2026-10-25, 16 passed / 0 failed**, on `mjolnir`'s own
> `compose.yaml`/`caddy/Caddyfile` layout (D84 — moved the entire deployable
> stack here from `tun`; previously verified 2026-10-20 under the old
> `tun`-owned layout). Re-run `bin/ota-verify.sh` after any future Caddy
> change.
>
> **The DNS record must stay grey-clouded (DNS only), never proxied (D57).**
> A CDN in the body path re-encodes responses and breaks D49's sha256
> invariant, which the frozen native patch can never recover from; it also
> intercepts the ACME HTTP-01 challenge so no certificate can be issued.

One Contabo VPS, 8 GB / 100 GB (D35). Everything runs in one `docker compose`
stack, **defined entirely in this repo (D84, superseding D75/D81)** — `tun`
ships no deployable artifacts at all. The operator deploys `mjolnir` alone.

**Every device-facing path is a static file (D55)**, served by Caddy
directly off disk — `hub`/`builder` never sit in front of the bundle or
audio blobs. `docker compose up -d` brings up the whole stack: Caddy,
Postgres, and `hub`'s/`builder`'s own HTTP servers (the operator console,
`hub-builder-operator-console`). No profiles — one command.

**No node on the VPS host itself.** `hub` and `builder` each ship their own
`Dockerfile` (node:22-alpine), bind-mounting this checkout so `git pull` +
a container restart picks up source changes without a rebuild.

---

## First deploy

On the VPS, as a non-root user in the `docker` group:

```sh
# 1. Docker (Debian/Ubuntu) — the only thing installed on the host itself
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"       # log out and back in

# 2. The repo
git clone <your-remote>/mjolnir.git && cd mjolnir

# 3. Config
cp .env.example .env
openssl rand -hex 32                  # paste as OTA_TOKEN
$EDITOR .env                          # set TUN_SITE_ADDRESS + TUN_PUBLIC_BASE
```

`.env` is gitignored. It must contain, at minimum:

```sh
TUN_SITE_ADDRESS=tun.example.net      # bare hostname => automatic HTTPS
TUN_PUBLIC_BASE=https://tun.example.net
OTA_TOKEN=<the 64 hex chars you just generated>
POSTGRES_PASSWORD=<a password for the mjolnir postgres user>

# hub-builder-operator-console (D-H6) — required, not optional, once
# Caddy's /mjolnir/* and /builder/* routes are live: without this, both
# services' operator UIs are reachable by anyone who finds the hostname.
OPERATOR_AUTH_TOKEN=<a long random token — this is what you type in at /mjolnir/login and /builder/login>

# builder's OWN outbound fetch to stabbur's API (pullNotes/pullGrammarRules)
# — must resolve from INSIDE the builder container, never a browser-facing
# URL (D100: these were found conflated in a live deploy — STABBUR_BASE_URL
# set to a public https:// URL caused every scheduled run to fail). Use
# STABBUR_UPSTREAM's value below, not TUN_PUBLIC_BASE's.
STABBUR_BASE_URL=http://backend:5056
STABBUR_AUTH_TOKEN=<stabbur's shared bearer token — same value stabbur's own .env uses>

# Caddy's /stabbur/* proxy target (D98/D99) — see .env.example and
# caddy/Caddyfile for the full reasoning. RECOMMENDED when stabbur is a
# second, independent `docker compose up` stack (the normal case): join a
# shared external network once —
#     docker network create tun-shared
# — both this repo's compose.yaml (caddy, mjolnir-builder) and stabbur's own
# compose.yaml (backend) already declare themselves as members of it.
STABBUR_UPSTREAM=backend:5056
```

`hub`'s `STABBUR_UI_BASE` is different from both of the above: it's the one
browser-facing value here, used only to build the Cards page's "open note"
link a human clicks — it MUST be the public URL through Caddy
(`https://<your-domain>/stabbur/ui`), never a Docker service name. Optional:
unset just means that one link can't be built; the list itself still renders.

**Point DNS at the box before starting Caddy** — an A record (and AAAA if you
have v6) for that hostname. Caddy obtains the certificate on first start by
answering a challenge on port 80, so DNS must already resolve and ports 80 and
443 must be open in the Contabo firewall.

```sh
docker compose up -d
docker compose logs -f caddy          # watch the certificate get issued
```

## Publish build #1 and prove the path

```sh
# Copy the stock bundle over from the laptop first, e.g.
#   scp ~/dev/mjolnir/index.android.bundle vps:~/mjolnir/

docker compose exec -e ALLOW_NO_COMPANION=1 mjolnir-hub \
  bin/ota-publish.sh index.android.bundle b000001 "base 6.0.3 · logic 0 · data 0 (stock)"

bin/ota-verify.sh   # bash + curl only — runs fine directly on the host
```

(`mjolnir-hub` bind-mounts the whole repo at `/app` and has node — no
separate node-runtime container needed, unlike before `hub-builder-
operator-console` shipped.)

`ota-publish.sh` refuses a bundle with no boot-ok companion, and refuses one
whose baked `BUILD_ID` differs from the id you publish under — both would be
quarantined on the device's third launch, silently. `ALLOW_NO_COMPANION=1`
overrides the first, and is only correct for a bundle no patched device will
ever fetch.

`ota-verify.sh` must print **16 passed, 0 failed**. It is the P1 acceptance
test and it checks the things that are unfixable once the APK ships — above
all that the sha256 is identical with and without transport gzip (D49). Re-run
it after any Caddy change.

## Logic bundles — the base+patch bundle `builder` builds onto

`builder` has no config of its own naming a bundle file anymore (`BUNDLE_PATH`
is gone — D-L4): every run reads whichever `logic_bundles` row is `active`
and rebuilds the deck/card data onto it fresh. **A fresh deployment has zero
logic bundles and zero active one** — `builder` refuses to publish until the
operator has submitted and activated at least one, via
`https://<host>/mjolnir/ota`:

1. Drop an assembled base+patch bundle (e.g. produced by bundle-workbench's
   "Assemble" action, or any bundle with the boot-ok companion appended —
   see `bundle-tool companion`/`bundle-tool assemble`). If it has
   `base_version`/`patch_rev` baked in (D-L1), they're read automatically;
   otherwise you're prompted to type them.
2. Click **activate** on the row you just created.
3. `builder`'s next run (scheduled or "publish now") now builds onto it.

This is a **one-time bootstrap step for a fresh deployment** — every
subsequent base/patch change is the same two clicks (submit, activate),
independent of any Docker restart.

Logic bundle files live under `LOGIC_BUNDLE_DIR` (defaults to
`<DATA_DIR>/logic`), content-addressed by sha256 — see `.env.example`.

## Publishing and rolling back

The normal path is now the browser: `https://<host>/mjolnir/ota` — drag-drop
a bundle, edit its label, submit. It calls the exact same guard functions
(`tool/src/otaPublish.js`, D-H5) as the CLI below, nothing duplicated.

The CLI stays available for scripting/CI or if the UI is unreachable:

```sh
docker compose exec mjolnir-hub bin/ota-publish.sh <bundle> <buildId> "<label>"   # publish
docker compose exec mjolnir-hub bin/ota-publish.sh <older-bundle> b000001 "..."   # roll back
```

Rollback is just repointing `current.json` at a buildId whose bundle is still
on disk — the OTA console's Publish history page also has a one-click
"set as current" action for this. The device compares identity, never
ordering (D26) — it fetches the older build without knowing or caring that
it is older.

The publish script refuses to: reuse a buildId for different bytes (a device
that already has that id would keep the stale bundle forever), accept a
buildId outside `^[A-Za-z0-9._-]{1,64}$`, accept a file that does not begin
`var __BUNDLE_START_TIME__=`, or publish over plain http. `builder` (P4)
enforces the exact same guards in-process, via `tool/src/otaPublish.js` — the
CLI is a thin wrapper over the same module (D76/D-P2).

## Layout on the box

```
mjolnir/
  .env                 secrets — gitignored, back this up separately
  compose.yaml
  hub/Dockerfile        hub's own HTTP server + the node runtime bin/ota-publish.sh runs in
  builder/Dockerfile    builder's own HTTP server (publish scheduling, forecast)
  caddy/Caddyfile
  bin/ota-publish.sh
  bin/ota-verify.sh
  tool/src/otaPublish.js
  data/                gitignored; served read-only into the container at /srv
    ota/current.json
    ota/bundle/<buildId>.js
    ota/<buildId>/audio.json
    blob/<sha256>
    logic/<sha256>.js   operator-submitted base+patch bundles (D-L1) — one is "active"
```

## Backups (P24)

Two things, and the second is the one that gets forgotten:

1. `.env` — losing `OTA_TOKEN` means a device running the baked-in bootstrap
   token can no longer fetch. Keep it somewhere outside the VPS.
2. `data/` — blobs are content-addressed, so `rsync -a` is naturally
   incremental and never rewrites an existing file.

The `caddy_data` volume holds the TLS certificates. Losing it is survivable
(Caddy re-issues) but counts against Let's Encrypt rate limits, so avoid
`docker compose down -v`.

3. `pg_dump` of the `postgres` container's `postgres` database — this is
   hub's and builder's entire ledger (decks, card_slots, card_content,
   publications, logic_bundles, build_jobs, pending_occurrences,
   occurrence_shipments, builder_config, job_logs). Losing it without a
   backup means hub's bookkeeping no longer agrees with what's actually
   on-device, with no way to reconcile — and `builder` has no bundle to
   build onto until a `logic_bundles` row is re-submitted (see above).

## Operational notes

- **Caddy does not hot-reload its Caddyfile on its own.** A `git pull` that
  changes `caddy/Caddyfile` needs either `docker compose exec caddy caddy
  reload --config /etc/caddy/Caddyfile` or `docker compose restart caddy` —
  otherwise the old config keeps running (requests silently fall through to
  the catch-all 404 instead of reaching the new route).
- Caddy serves `data/` **read-only**. Publishing writes from the host, so a
  compromised Caddy cannot alter what the device fetches.
- Postgres is deliberately not published to the host; only sibling containers
  (`hub`, `builder`) reach it.
- `hub`/`builder` bind-mount the repo rather than copying it in — a
  `git pull` plus `docker compose restart mjolnir-hub mjolnir-builder` picks
  up source changes; only rebuild (`docker compose up -d --build`) when
  either package's `package.json`/`package-lock.json` changes.
- `TUN_SITE_ADDRESS=:8080` runs the same config over plain HTTP for local
  testing. `ALLOW_HTTP=1` lets the scripts work against it. Never set either on
  the VPS.
