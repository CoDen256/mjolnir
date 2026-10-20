# Open questions

Each carries enough context to resume cold.

## Needs a decision

| # | Question | Context / options |
|---|---|---|
| Q01 | **Strato plan** | Floor is 2 vCPU / 4 GB / 80 GB SSD; comfortable 4 vCPU / 8 GB. Must be a VPS/root server (Docker). Current box is "really small" — likely needs upgrading. See `02-services.md` for the per-component breakdown |
| Q02 | **Interleave lag: fixed 11 or scaled?** | Decided: fixed 11, justified by the 5-per-pull block size. Revisit only if observed clustering is wrong in practice |
| Q03 | **Device heartbeat: piggyback or separate endpoint?** | Piggyback chosen (D31). Split into `POST /device/heartbeat` if the shim gets muddy |
| Q04 | **Does lexis get its own container eventually?** | v1 runs it as a blueprint beside phonexa. Split when it grows |
| Q05 | **Cineby audio** — is the player DRM-protected? | Unknown. If not, it joins YouTube in the "real audio" tier; if yes, it joins Netflix in the TTS/Forvo tier |

## Needs a spike / verification

| # | Question | How to answer |
|---|---|---|
| Q06 | **Does a type (d) card actually behave as expected?** `A:"E"` + occurrence `N` only — front shows "Read out: …", flip reveals transcription and plays audio | 58 stock `E`-only cards exist. Find one, run it in the app, confirm, *before* building 500 of them |
| Q07 | **Cold-start parse time** of a bundle grown by several MB | Build a bundle padded with synthetic cards; measure launch time on the real phone. Gates P09 and therefore D03 |
| Q08 | **Does the paywall patch keep `drawNewCards` on the unfiltered branch** in all paths? | mod 2110 branches on a premium flag before slicing; verify the patched Redux state reaches it |
| Q09 | **Exact `Stage` → interval mapping** | mod 2133 holds `GraduationStage` / `CFStage` (minutes) and `CF4` (ease-factor percentages). Tables are known; the exact transition logic in mod 2119 is not fully traced. Needed only to replicate scheduling in the phonexa dashboard |
| Q10 | **Norsk ordbank import size and shape** | Drives Q01 disk sizing and the `/inflect` schema |

## Deferred by decision (do not re-open casually)

- Linking recall progress to pronunciation progress (D14)
- Runtime/dynamic card fetching instead of bundle regeneration (D03)
- A new `P` deck category with UI patching (D21)
- Self-hosted Whisper (D17)
- Any new view inside the Mjølnir app (D13)
