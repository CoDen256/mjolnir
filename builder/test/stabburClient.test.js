import test from "node:test";
import assert from "node:assert/strict";
import { pullGrammarRules, buildGrammarRuleLookup } from "../src/stabburClient.js";
import { startFakeStabbur } from "./helpers/fakeStabbur.js";

test("pullGrammarRules fetches stabbur's GET /api/grammar_rules list verbatim", async () => {
  const fake = startFakeStabbur({ grammarRules: [{ id: "rule-1", title: "Present tense", html: "<p>...</p>" }] });
  const baseUrl = await fake.listen();
  try {
    const rules = await pullGrammarRules({ baseUrl });
    assert.deepEqual(rules, [{ id: "rule-1", title: "Present tense", html: "<p>...</p>" }]);
  } finally {
    await fake.close();
  }
});

test("buildGrammarRuleLookup returns a synchronous id -> {title, html} lookup, undefined for an unknown id", async () => {
  const fake = startFakeStabbur({
    grammarRules: [
      { id: "rule-1", title: "Present tense", html: "<p>a</p>" },
      { id: "rule-2", title: "Past tense", html: "<p>b</p>" },
    ],
  });
  const baseUrl = await fake.listen();
  try {
    const lookup = await buildGrammarRuleLookup({ baseUrl });
    assert.deepEqual(lookup("rule-1"), { title: "Present tense", html: "<p>a</p>" });
    assert.deepEqual(lookup("rule-2"), { title: "Past tense", html: "<p>b</p>" });
    assert.equal(lookup("no-such-rule"), undefined);
  } finally {
    await fake.close();
  }
});
