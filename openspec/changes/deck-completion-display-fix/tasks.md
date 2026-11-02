## 0. Before you write any code

Read `design.md` in full, especially D-D1 (clamp only, don't recompute) and
D-D2 (remove the gate entirely, don't adjust its threshold). Read module
2119's real source (`base/smali.mjolnir.merged/assets/index.android.bundle`,
or its exploded form) directly before patching — confirm the `Completion`
assignment and the `Vt()`/button-handler gate against the real file, not
just this design doc's quoted excerpts (variable names in the real
minified source won't literally be `e`/`n`/`r`/`a`/`Vt` — those are
illustrative, from the exploded/deobfuscated reading done during
exploration, not confirmed-stable identifiers).

## 1. Author the patch-back pair

- [ ] 1.1 Create `patches/js/2119-deck-completion-display.baseline.js` /
      `.edited.js` (same `patch-back` mechanism as every other raw
      module-id-located patch in this project — D111).
- [ ] 1.2 Edit: the `Completion` assignment gains `Math.min(100, ...)`
      around the existing (otherwise unchanged) calculation.
- [ ] 1.3 Edit: the session-start button handler's early-return branch
      (`if (Vt() && !alreadyShown) return showPopup(...)`) is removed —
      execution always falls through to the real draw attempt. Confirm
      whether `Vt()` (or its real name) is used ANYWHERE else in this
      module before removing it outright — if it has another caller,
      leave the function itself defined and only remove this one call
      site's gating use of it.
- [ ] 1.4 Confirm no other behavior in this module reads `Completion` in a
      way that would be affected by the clamp (e.g. sorting decks by
      completion, analytics, anything comparing against a raw un-clamped
      value) — if found, note it in this task and decide whether the
      clamp needs to apply only at render time vs. wherever `Completion` is
      set.

## 2. Tests

- [ ] 2.1 Test harness (same `patch-back` + `indirectEval` pattern this
      project's other module-id-located patches use): a deck with
      `Cards.length` not a multiple of 5, fully exhausted (`PullCounter`
      at its ceiling), displays exactly 100, not the unclamped overshoot.
- [ ] 2.2 Test: a partially-drawn deck's displayed completion is unchanged
      from the unpatched calculation (the clamp only ever engages at/above
      100, never alters an in-progress value).
- [ ] 2.3 Test: pressing "Start today's session" with a deck whose
      (possibly-overshooting) `Completion` reads `>= 100` but whose
      `Cards[]` still has undrawn entries — the draw is attempted
      immediately, no interstitial, and the undrawn cards are returned.
- [ ] 2.4 Test: pressing "Start today's session" with every selected deck
      genuinely fully exhausted — the real "No new cards for today!" alert
      still fires exactly as before (confirm this path is untouched by the
      gate's removal).

## 3. Sign-off

- [ ] 3.1 If anything here contradicts or refines `design.md` during
      implementation (e.g. task 1.3's/1.4's "confirm against the real
      file" turns up something different from what design.md assumed),
      record it as an ADR amendment in `tun/docs/07-decisions.md`, per this
      project's established practice.
- [ ] 3.2 **(Operator, outside this change)** Assemble/install a bundle
      with the new patch-back pair; confirm on-device: a custom deck that
      previously showed over 100% now shows exactly 100%; pressing "Start
      today's session" on a deck that reads 100% but still has undrawn
      custom cards starts the session immediately with no interstitial,
      and genuinely new cards are drawn; a deck that is truly fully
      exhausted still shows the "No new cards for today!" message.
