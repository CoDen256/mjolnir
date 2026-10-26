// Centralized env reading, mirroring builder/src/config.js's pattern.
export function loadConfig() {
  const bundlePath = process.env.BUNDLE_PATH;
  const dataDir = process.env.DATA_DIR || "../data";
  const publicBase = process.env.TUN_PUBLIC_BASE;
  const stabburUiBase = process.env.STABBUR_UI_BASE;
  if (!bundlePath) {
    throw new Error("BUNDLE_PATH is required (same file builder writes to — hub reads card content from it, never writes)");
  }
  if (!publicBase) throw new Error("TUN_PUBLIC_BASE is required (passed through to the publish module)");
  // D-H6: not required — unset disables the operator-auth gate entirely
  // (local/dev ergonomics). Task 7.4's ordering constraint is the real
  // guard: the Caddy routes must never be uncommented for a deploy that
  // left this unset.
  const operatorAuthToken = process.env.OPERATOR_AUTH_TOKEN;
  // Not required: without it, the Cards page's "open note" link just can't
  // be built — the list itself still renders fully from hub's own data
  // (cards-browser spec: "stabbur unreachable degrades only the link").
  return { bundlePath, dataDir, publicBase, stabburUiBase, operatorAuthToken };
}
