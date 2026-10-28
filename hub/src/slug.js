// A small, local, filesystem-safe slug — lowercase, non-alphanumerics
// collapsed to a single hyphen, trimmed to a sane length. Used anywhere a
// human-meaningful string (a label, a version) needs to become part of a
// filename — OTA download names (D-C7) and logic-bundle on-disk filenames
// alike. No dependency needed for something this constrained.
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
