import path from "node:path";

// Centralized env reading, mirroring builder/src/config.js's pattern.
export function loadConfig() {
  const dataDir = process.env.DATA_DIR || "../data";
  const publicBase = process.env.TUN_PUBLIC_BASE;
  const stabburUiBase = process.env.STABBUR_UI_BASE;
  // D-L1: operator-submitted base+patch bundles are stored here, immutable
  // once written. `BUNDLE_PATH` is gone entirely — there is no more single
  // mutable working file for hub to read card content from; that now lives
  // in `card_content` (D-L3), queried directly (hub/src/cards.js).
  const logicBundleDir = process.env.LOGIC_BUNDLE_DIR || path.join(dataDir, "logic");
  if (!publicBase) throw new Error("TUN_PUBLIC_BASE is required (passed through to the publish module)");
  // D-H6: not required — unset disables the operator-auth gate entirely
  // (local/dev ergonomics). Task 7.4's ordering constraint is the real
  // guard: the Caddy routes must never be uncommented for a deploy that
  // left this unset.
  const operatorAuthToken = process.env.OPERATOR_AUTH_TOKEN;
  // Not required: without it, the Cards page's "open note" link just can't
  // be built — the list itself still renders fully from hub's own data
  // (cards-browser spec: "stabbur unreachable" tolerance extends to this
  // too, by the same logic: the ledger is always the source of truth for
  // *which* cards exist).
  return { dataDir, publicBase, stabburUiBase, operatorAuthToken, logicBundleDir };
}
