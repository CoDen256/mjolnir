import test from "node:test";
import assert from "node:assert/strict";
import { project, NOTE_TYPES } from "../src/projector.js";
import { fixtureNote } from "./fixtures/stabburNotes.js";

test("projects all five note types without throwing, each with occurrence set + A matching 03-data-model.md's table", () => {
  const expected = {
    word: { A: "N", occurrences: ["A", "E", "N"] },
    expression: { A: "N", occurrences: ["A", "E", "N"] },
    listening: { A: "N", occurrences: ["A"] },
    pronunciation: { A: "E", occurrences: ["N"] },
    grammar: { A: "E", occurrences: ["N"] },
  };
  assert.deepEqual(NOTE_TYPES.sort(), Object.keys(expected).sort());

  for (const type of NOTE_TYPES) {
    const note = fixtureNote({ type, grammar_rule_id: type === "grammar" ? "rule-1" : null });
    const card = project(note);
    assert.equal(card.A, expected[type].A, `A for ${type}`);
    assert.deepEqual(card.occurrences, expected[type].occurrences, `occurrences for ${type}`);
    assert.equal(typeof card.N, "string");
    assert.equal(typeof card.E, "string");
    assert.equal(typeof card.X, "string");
  }
});

test("projection is pure: re-running on unchanged input produces identical output", () => {
  const note = fixtureNote({ type: "word" });
  assert.deepEqual(project(note), project(note));
});

test("throws on an unknown note type rather than silently defaulting", () => {
  assert.throws(() => project(fixtureNote({ type: "unknown-type" })), /no projector for note type/);
});

test("grammar projection uses a placeholder when no grammarRuleLookup is given, and the rule's content when it is", () => {
  const note = fixtureNote({ type: "grammar", grammar_rule_id: "rule-1" });
  const withoutLookup = project(note);
  assert.match(withoutLookup.X, /rule-1/);
  assert.match(withoutLookup.X, /not yet available/);

  const withLookup = project(note, { grammarRuleLookup: (id) => (id === "rule-1" ? { title: "Present tense", html: "<p>...</p>" } : undefined) });
  assert.match(withLookup.X, /Present tense/);
});
