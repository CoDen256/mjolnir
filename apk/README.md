# apk

Decompile → patch → rebuild → re-sign pipeline scripts.

The build **workspace** (`/home/coden/rev/mjolnir/`) is disposable scratch and is
deliberately not part of this repo — only the scripts and the patch sources
(`../patches/native/`) are versioned.

⚠️ Before using that workspace: it currently contains **two divergent patch
histories**. `smali.merged.mjolnir/assets/.git` holds `07b26ed`, `101a0be`,
`b5cc8df`, `f6c42e7`, while `../docs/findings.md` §7 documents `0f6f580`,
`b962691`, `a1f8f1f`. Establish which is authoritative before building on either.
