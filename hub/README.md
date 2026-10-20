# hub

The device-facing service. The only thing the phone talks to.

- `GET  /ota/current.json`  → `{buildId, url, sha256, size}` (identity, never ordering — D26)
- static bundle + audio manifest + `blob/<sha256>` serving
- `GET/PATCH/POST /mjolnir/userdata/{deviceId}` — Firestore-shaped, field-merge
- device heartbeat piggybacked on the sync PATCH (D31)

Keeps a **per-build snapshot** of exactly the audio the device needs, so
studying never depends on `stabbur` being reachable (D45).

Its protocol is effectively frozen — the phone is hard to update. Deploy it
independently of everything you iterate on.

See `tun/docs/04-delivery.md` and `05-sync.md`.
