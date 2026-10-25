// Centralized env reading so server.js/clock.js/bin scripts don't each
// re-derive it slightly differently.
export function loadConfig() {
  const stabburBaseUrl = process.env.STABBUR_BASE_URL;
  const bundlePath = process.env.BUNDLE_PATH;
  const dataDir = process.env.DATA_DIR || "../data";
  const publicBase = process.env.TUN_PUBLIC_BASE;
  if (!stabburBaseUrl) throw new Error("STABBUR_BASE_URL is required");
  if (!bundlePath) throw new Error("BUNDLE_PATH is required (path to the bundle builder reads/writes)");
  if (!publicBase) throw new Error("TUN_PUBLIC_BASE is required (passed through to the publish module)");
  return { stabburBaseUrl, bundlePath, dataDir, publicBase, sourceLang: process.env.SOURCE_LANG || "no" };
}
