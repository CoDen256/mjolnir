## 1. Caddyfile

- [ ] 1.1 Delete the `{$PHONEXA_SITE_ADDRESS:phonexa.localhost}` site block at the
      bottom of `caddy/Caddyfile`, keeping its `basic_auth` account and the locked
      default hash for reuse below
- [ ] 1.2 Inside the main site block, with the other `handle` blocks and before
      the catch-all: `redir /phonexa /phonexa/ 308` then
      `handle_path /phonexa/* { basic_auth { operator {$PHONEXA_AUTH_HASH:<locked
      default>} } ; reverse_proxy {$PHONEXA_UPSTREAM:phonexa-backend:5050} {
      header_up X-Forwarded-Prefix /phonexa } }`
- [ ] 1.3 Replace the "phonexa is NOT routed here" comment with one describing the
      new block: why a prefix works now (phonexa's `path-prefix-routing`), why the
      `redir` is load-bearing (relative assets), and why the gate is at the proxy
- [ ] 1.4 Confirm with `caddy adapt --adapter caddyfile` that the phonexa route
      lands **before** the catch-all, the same index check D99 established

## 2. Compose and config

- [ ] 2.1 `compose.yaml`: remove `PHONEXA_SITE_ADDRESS` from caddy's
      `environment:`; keep `PHONEXA_UPSTREAM` and the valueless `PHONEXA_AUTH_HASH:`
      key form, and update the long comment that explains the valueless form (its
      "empty site address makes Caddy read the block as a global options block"
      reasoning no longer applies to the address, but the absent-vs-empty fallback
      rule still applies to the hash)
- [ ] 2.2 `.env.example`: remove `PHONEXA_SITE_ADDRESS` and the DNS prerequisite;
      keep the hash, the single-quote rule and the rotation rule; note the shared
      origin
- [ ] 2.3 `DEPLOY.md`: rewrite "Optional: phonexa on its own hostname" as
      "Optional: phonexa at `/phonexa`" — drop the DNS record step, keep
      `caddy hash-password`, quoting, rotation and what the browser shows; state
      that phonexa now shares the main origin with hub and builder

## 3. Verification

- [ ] 3.1 `caddy validate` with phonexa vars unset, and with them set
- [ ] 3.2 Existing-route regression: `/ota/…`, `/blob/…`, `/audio-manifest/…`,
      `/mjolnir/ui`, `/builder/ui`, `/stabbur/ui`, `/smia/ui`, `/adminer/` respond
      exactly as before
- [ ] 3.3 With a real hash and a stand-in upstream: no creds → 401, wrong password
      → 401, `operator` + token → proxied; a phonexa admin endpoint without creds
      → 401; a static asset without creds → 401
- [ ] 3.4 Hash unset → every `/phonexa/*` request 401 (fail closed)
- [ ] 3.5 Prefix stripping: a request to `/phonexa/api/v1/languages` arrives at the
      upstream as `/api/v1/languages` with `X-Forwarded-Prefix: /phonexa`
- [ ] 3.6 `/phonexa` (no trailing slash) → 308 → `/phonexa/`
- [ ] 3.7 WebSocket: `/phonexa/stream` upgrades (101 + correct
      `Sec-WebSocket-Accept`), arrives at the upstream as `/stream`, and a data
      frame flows; 401 without credentials before the upstream is contacted
- [ ] 3.8 End-to-end against a real phonexa built from its `path-prefix-routing`
      branch: every page loads, audio plays, mic tracker connects — the only test
      that catches a missed call site on phonexa's side
- [ ] 3.9 Rotate: change the token, regenerate the hash, confirm the old password
      stops working

## 4. Sequencing

- [ ] 4.1 Do not merge before phonexa's `path-prefix-routing` has landed
      (`design.md` §6)
