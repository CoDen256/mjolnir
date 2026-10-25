// Pure, stateless note -> card projection (tun/docs/03-data-model.md, "The
// five note/card types"). Never reads or writes anything; same input always
// produces the same `{N, E, X, A}` + occurrence set.

function translationsHtml(note) {
  return note.translations.map((t) => `<div>${t.lang}: ${t.text}</div>`).join("");
}

function inflectionsHtml(note) {
  const entries = Object.entries(note.inflections || {});
  if (entries.length === 0) return "";
  return `<table>${entries.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>`;
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
    N: `<div class="center">${note.text}<br>${note.transcription || ""}${inflectionsHtml(note)}</div>`,
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
