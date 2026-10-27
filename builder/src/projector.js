// Pure, stateless note -> card projection (tun/docs/03-data-model.md, "The
// five note/card types"). Never reads or writes anything; same input always
// produces the same `{N, E, X, A}` + occurrence set.

// Each translation on its own line, lang code highlighted the same way the
// stock stock bundle already highlights emphasis (`<b class="bold teal">`,
// e.g. card B12002's "teal"/"red" subject-verb highlighting) — bold plus a
// bluish color the native app's own stylesheet already recognizes, not a
// new class invented here. Wrapped in the same `<div class="center">` every
// stock N/E/X field uses, which this previously omitted.
function translationsHtml(note) {
  const lines = note.translations.map((t) => `<b class="bold teal">${t.lang}</b>: ${t.text}`);
  return `<div class="center">${lines.join("<br>")}</div>`;
}

// Per-POS inflection line layout (tun/docs/03-data-model.md's inflection
// shapes) — no field-name labels, just the values themselves on their own
// lines/pairs, matching how the stock bundle already renders this (e.g.
// verb card B04181: "å stjele<br>stjeler<br>stjal<br>har stjålet", no
// "infinitiv:"/"presens:" prefixes). Returns null for a POS with no defined
// layout here (or missing inflections) so the caller falls back to
// `note.text` alone.
function wordInflectionLines(pos, inflections) {
  if (!inflections) return null;
  if (pos === "substantiv") {
    const { article, sg_indef, sg_def, pl_def, pl_indef } = inflections;
    const headword = [article, sg_indef].filter(Boolean).join(" ");
    return [headword, sg_def, pl_def, pl_indef].filter(Boolean);
  }
  if (pos === "adjektiv") {
    const { positiv, nøytrum, flertall, komparativ, superlativ } = inflections;
    const neuterPlural = [nøytrum, flertall].filter(Boolean).join(" ");
    const comparative = [komparativ, superlativ].filter(Boolean).join(" ");
    return [positiv, neuterPlural, comparative].filter(Boolean);
  }
  if (pos === "verb") {
    const { infinitiv, presens, preteritum, perfektum } = inflections;
    return [infinitiv, presens, preteritum, perfektum].filter(Boolean);
  }
  if (pos === "adverb") {
    return inflections.form ? [inflections.form] : null;
  }
  return null;
}

// The word card's headline: the inflection layout above when the POS has
// one and inflections are present, falling back to the bare `text` for
// every other POS (type=word with no inflections, per data-model.md) —
// `transcription`, if any, always trails as its own line either way.
function wordHeadlineHtml(note) {
  const lines = wordInflectionLines(note.pos, note.inflections);
  const body = lines && lines.length > 0 ? lines.join("<br>") : note.text;
  return note.transcription ? `${body}<br>${note.transcription}` : body;
}

// `grammarRuleLookup(id) => { title, html } | undefined` — optional. stabbur's
// p4-notes read API (D-N4) returns only `grammar_rule_id`, not the rule's
// content; no endpoint to fetch it exists yet in that contract (checked:
// neither notes-read-api nor any other p4-notes spec exposes one). Until
// that's added, `type=grammar` notes project with the rule id as a visible
// placeholder rather than failing the whole run — flagged in
// `openspec/changes/p4-builder/tasks.md` task 4.6 as a real cross-repo gap,
// not a silent guess.
function grammarRuleHtml(note, grammarRuleLookup) {
  const rule = grammarRuleLookup ? grammarRuleLookup(note.grammar_rule_id) : undefined;
  if (rule) return `<div class="center">${rule.title}</div>${rule.html}`;
  return `<div class="center">[grammar rule ${note.grammar_rule_id} — content not yet available from stabbur]</div>`;
}

const PROJECTORS = {
  // D91: word/expression's occurrence set drops `N` — the word is never
  // quizzed text-first, it only ever appears on reveal. The `N` *content*
  // field is unchanged; only the occurrence/quiz list shrinks.
  word: (note) => ({
    N: `<div class="center">${wordHeadlineHtml(note)}</div>`,
    E: translationsHtml(note),
    X: note.context_text ? `<div class="center">${note.context_text}</div>` : "",
    A: "N",
    occurrences: ["A", "E"],
  }),
  expression: (note) => ({
    N: `<div class="center">${note.text}</div>`,
    E: translationsHtml(note),
    X: note.context_text ? `<div class="center">${note.context_text}</div>` : "",
    A: "N",
    occurrences: ["A", "E"],
  }),
  listening: (note) => ({
    N: `<div class="center">${note.text}</div>`,
    E: translationsHtml(note),
    X: "",
    A: "N",
    occurrences: ["A"],
  }),
  pronunciation: (note) => ({
    N: `<div class="center">Read out: ${note.text}</div>`,
    E: `<div class="center">${note.transcription || ""}</div>`,
    X: "",
    A: "E",
    occurrences: ["N"],
  }),
  grammar: (note, { grammarRuleLookup } = {}) => ({
    N: `<div class="center">${note.text}</div>`,
    E: translationsHtml(note),
    X: grammarRuleHtml(note, grammarRuleLookup),
    A: "E",
    occurrences: ["N"],
  }),
};

export const NOTE_TYPES = Object.keys(PROJECTORS);

export function project(note, opts = {}) {
  const projector = PROJECTORS[note.type];
  if (!projector) {
    throw new Error(`no projector for note type "${note.type}" (expected one of ${NOTE_TYPES.join(", ")})`);
  }
  return projector(note, opts);
}
