import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "@babel/parser";
import {
  diffStatementList,
  canonicalizeStatementList,
  diffModuleFactories,
} from "../../src/diff.js";
import { extractFactoryBody } from "../../src/factory.js";

function statements(src) {
  const ast = parse(src, { sourceType: "script", allowReturnOutsideFunction: true });
  return ast.program.body;
}

function diffStatements(rSrc, mSrc) {
  const rCanon = canonicalizeStatementList(statements(rSrc));
  const mCanon = canonicalizeStatementList(statements(mSrc));
  return diffStatementList(rCanon, mCanon);
}

function factoryOf(src) {
  const ast = parse(src, { sourceType: "script", allowReturnOutsideFunction: true });
  return extractFactoryBody(ast).factory;
}

test("disambiguates structurally identical sibling statements by occurrence order", () => {
  const entries = diffStatements(
    `if (cond) { return null; } return null;`,
    `if (cond) { return null; } return 42;`
  );

  const ifEntry = entries.find((e) => e.rNode?.type === "IfStatement");
  assert.equal(ifEntry.kind, "unchanged");

  const modified = entries.filter((e) => e.kind === "modified");
  assert.equal(modified.length, 1);
  assert.equal(modified[0].rNode.type, "ReturnStatement");
  assert.equal(modified[0].rIdx, 1);
});

test("attributes an edit to the correct occurrence regardless of which sibling changed", () => {
  const entries = diffStatements(
    `return null; if (cond) { return null; }`,
    `return 7; if (cond) { return null; }`
  );

  const unchanged = entries.filter((e) => e.kind === "unchanged");
  assert.equal(unchanged.length, 1);
  assert.equal(unchanged[0].rNode.type, "IfStatement");

  const modified = entries.filter((e) => e.kind === "modified");
  assert.equal(modified.length, 1);
  assert.equal(modified[0].rIdx, 0);
  assert.equal(modified[0].rNode.type, "ReturnStatement");
});

test("reports added and removed statements", () => {
  const entries = diffStatements(`var a = 1;`, `var a = 1; console.log(a);`);
  assert.equal(entries.filter((e) => e.kind === "unchanged").length, 1);
  const added = entries.filter((e) => e.kind === "added");
  assert.equal(added.length, 1);
  assert.equal(added[0].mNode.type, "ExpressionStatement");
});

test("renames alone produce no modified/added/removed entries", () => {
  const entries = diffStatements(
    `function f(x) { return x + 1; }`,
    `function f(value) { return value + 1; }`
  );
  assert.ok(entries.every((e) => e.kind === "unchanged"));
});

test("diffModuleFactories ignores a factory parameter rename, even when body statements reference those params", () => {
  const rFactory = factoryOf(
    `__d(function (g, r, i, a, m, e, d) { m.exports = "1.0.0"; }, 1, []);`
  );
  const mFactory = factoryOf(
    `__d(function (global, require, importDefault, importAll, mod, exports, deps) { mod.exports = "1.0.0"; }, 1, []);`
  );

  const entries = diffModuleFactories(rFactory, mFactory);
  assert.ok(entries.every((e) => e.kind === "unchanged"));
});

test("diffModuleFactories reports a real change even after a parameter rename", () => {
  const rFactory = factoryOf(
    `__d(function (g, r, i, a, m, e, d) { m.exports = "1.0.0"; }, 1, []);`
  );
  const mFactory = factoryOf(
    `__d(function (global, require, importDefault, importAll, mod, exports, deps) { mod.exports = "2.0.0"; }, 1, []);`
  );

  const entries = diffModuleFactories(rFactory, mFactory);
  const modified = entries.filter((e) => e.kind === "modified");
  assert.equal(modified.length, 1);
});
