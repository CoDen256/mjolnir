## 1. Caddy

- [ ] 1.1 Add a second site block `{$PHONEXA_SITE_ADDRESS:phonexa.localhost}` to `caddy/Caddyfile` with `log`, `encode gzip`, `basic_auth` (`operator` + `{$PHONEXA_AUTH_HASH:<locked default hash>}`) and `reverse_proxy {$PHONEXA_UPSTREAM:phonexa-backend:5050}`
- [ ] 1.2 Generate the locked default: a valid bcrypt hash of a random string that is discarded (never recorded); confirm `{$VAR:default}` parses a default containing `$`, otherwise use an alternative fail-closed construct (e.g. a `respond 401` handle when the hash is the placeholder)
- [ ] 1.3 Replace the stale commented `reverse_proxy /phonexa/* phonexa:8000` with a comment pointing at the new block and why a subdomain was chosen

## 2. Compose and config

- [ ] 2.1 `compose.yaml` caddy `environment:`: add `PHONEXA_SITE_ADDRESS`, `PHONEXA_UPSTREAM` (`${…:-phonexa-backend:5050}`), `PHONEXA_AUTH_HASH` (all optional)
- [ ] 2.2 `.env.example`: document the three vars, the single-quote rule for the hash, and the DNS prerequisite
- [ ] 2.3 `DEPLOY.md`: DNS record, `docker run --rm caddy:2-alpine caddy hash-password --plaintext "$OPERATOR_AUTH_TOKEN"`, quoting, rotation rule, what the browser shows

## 3. Verification

- [ ] 3.1 `caddy validate` with all phonexa vars unset, and with them set
- [ ] 3.2 Live start with `TUN_SITE_ADDRESS=:8080` (local mode) and no phonexa vars: starts, main routes unchanged, no ACME attempt for `phonexa.localhost`; if it interferes, switch the inert default to an HTTP-only address
- [ ] 3.3 Existing routes regression: `/ota/…`, `/blob/…`, `/mjolnir/ui`, `/builder/ui`, `/stabbur/ui`, `/smia/ui`, `/adminer/` respond as before
- [ ] 3.4 With a real hash: no creds → 401, wrong password → 401, `operator` + token → phonexa; an admin endpoint without creds → 401
- [ ] 3.5 Read `PHONEXA_AUTH_HASH` inside the running caddy container and confirm the `$…` hash arrived intact (quoting rule works)
- [ ] 3.6 With hash unset but a hostname set: every request 401 (fail closed)
- [ ] 3.7 Over HTTPS with credentials cached by the browser: Shadowing/Formant Lab API calls work and the live mic tracker's `/stream` WebSocket connects (this decides whether a cookie-based fallback is needed)
- [ ] 3.8 Rotate: change the token, regenerate the hash, confirm the old password stops working
