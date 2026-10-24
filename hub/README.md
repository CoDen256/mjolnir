# hub

The device-facing service. The only thing the phone talks to. **Owns the
schema** — `card_slots`, `decks`, `publications`, `build_jobs`, `userdata`,
`userdata_history`, `device_state`, and its own ledger of which note ids are
already minted (never pushed back to stabbur, D44). `builder` is the only
other process that touches this database, and it has no schema of its own —
see `../builder/README.md`.

- `GET  /ota/current.json`  → `{buildId, url, sha256, size}` (identity, never ordering — D26)
- static bundle + audio manifest + `blob/<sha256>` serving
- `GET/PATCH/POST /mjolnir/userdata/{deviceId}` — Firestore-shaped, field-merge
- device heartbeat piggybacked on the sync PATCH (D31)

Keeps a **per-build snapshot** of exactly the audio the device needs, so
studying never depends on `stabbur` being reachable (D45).

Its protocol is effectively frozen — the phone is hard to update. Deploy it
independently of everything you iterate on.

See `tun/docs/03-data-model.md`, `04-delivery.md`, and `05-sync.md`.
