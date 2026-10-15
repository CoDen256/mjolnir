import fs from "node:fs";
import { parse } from "@babel/parser";
import generatorPkg from "@babel/generator";
import traversePkg from "@babel/traverse";
import * as t from "@babel/types";
import { minify } from "terser";
import { loadManifest } from "./deobfuscate.js";
import { readModuleSource } from "../parseBundle.js";
import { extractFactoryBody } from "../factory.js";
import { diffModuleFactories, canonicalizeFactoryBody, pairByHash } from "../diff.js";
import { reassembleBundle } from "../reassemble.js";

const generate = generatorPkg.default ?? generatorPkg;
const traverse = traversePkg.default ?? traversePkg;

function parseFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return parse(source, { sourceType: "script", allowReturnOutsideFunction: true });
}

function insertionsAfter(insertions, oIdx) {
  return insertions.filter((ins) => ins.afterOIdx === oIdx).map((ins) => ins.node);
}

// M's statements are written in terms of M's own factory parameter names,
// which may have been renamed away from O's during the human's refactor
// pass (e.g. `m` -> `mod`). Splicing them into O verbatim would reference
// identifiers O's factory never declares. This produces a clone of
// `sourceFactory` with its own top-level parameters (by position — the
// factory signature is always the same 7-parameter shape) renamed to
// `targetParamNames`, every reference rewired via scope-aware rename.
function realignFactoryParams(sourceFactory, targetParamNames) {
  const clone = t.cloneNode(sourceFactory, true);
  const file = t.file(t.program([t.expressionStatement(clone)]));

  traverse(file, {
    FunctionExpression(path) {
      if (path.node !== clone) return;
      const params = path.node.params;
      const placeholders = params.map((_, idx) => `__patchback_param_${idx}__`);
      for (let idx = 0; idx < params.length; idx++) {
        path.scope.rename(params[idx].name, placeholders[idx]);
      }
      for (let idx = 0; idx < params.length; idx++) {
        const target = targetParamNames[idx];
        if (target) path.scope.rename(placeholders[idx], target);
      }
      path.stop();
    },
  });

  return file.program.body[0].expression;
}

// Rebuilds the original module's factory statement list with the human's
// diffed edits (computed between the refactor baseline R and the modified
// M) applied at the corresponding structurally-matched locations in O —
// never by just using M wholesale, since M may reference rule-rewritten
// helper calls (e.g. `_interopRequireWildcard`) that only exist in the
// readable deobfuscated view, not in O, and may use parameter names O's
// factory never declares.
export function buildPatchedFactoryStatements({ oFactory, rFactory, mFactory }) {
  const oCanon = canonicalizeFactoryBody(oFactory);
  const rCanon = canonicalizeFactoryBody(rFactory);

  const { pairs } = pairByHash(rCanon, oCanon);
  const oForR = new Map(pairs.map((p) => [p.aIdx, p.bIdx]));
  // Positional fallback: statements unchanged between R and M but rewritten
  // by a deobfuscation rule (so they don't hash-match O) still correspond
  // 1:1 by position, since rule rewriting never adds/removes statements.
  const rStatementCount = rFactory.body.body.length;
  const oStatements = oFactory.body.body;
  for (let i = 0; i < rStatementCount; i++) {
    if (!oForR.has(i) && i < oStatements.length) oForR.set(i, i);
  }

  const entries = diffModuleFactories(rFactory, mFactory);

  const oParamNames = oFactory.params.map((p) => p.name);
  const mStatements = realignFactoryParams(mFactory, oParamNames).body.body;

  const removedOIdx = new Set();
  const replacements = new Map();
  for (const entry of entries) {
    if (entry.kind === "modified") {
      const oIdx = oForR.get(entry.rIdx);
      if (oIdx === undefined) {
        throw new Error(
          `patch-back: could not locate the original statement for a modified entry (R index ${entry.rIdx})`
        );
      }
      replacements.set(oIdx, mStatements[entry.mIdx]);
    } else if (entry.kind === "removed") {
      const oIdx = oForR.get(entry.rIdx);
      if (oIdx !== undefined) removedOIdx.add(oIdx);
    }
  }

  // Walk entries in M's own order (not R's) to anchor insertions correctly
  // — an "added" statement that appears before everything else in M must
  // land before everything else in the patched output too.
  const insertions = [];
  let lastAnchorOIdx = -1;
  const mOrderedEntries = entries
    .filter((e) => e.mIdx !== undefined)
    .sort((a, b) => a.mIdx - b.mIdx);

  for (const entry of mOrderedEntries) {
    if (entry.kind === "added") {
      insertions.push({ afterOIdx: lastAnchorOIdx, node: mStatements[entry.mIdx] });
    } else {
      const oIdx = oForR.get(entry.rIdx);
      if (oIdx !== undefined) lastAnchorOIdx = oIdx;
    }
  }

  const newStatements = [...insertionsAfter(insertions, -1)];
  for (let oIdx = 0; oIdx < oStatements.length; oIdx++) {
    if (!removedOIdx.has(oIdx)) {
      newStatements.push(replacements.has(oIdx) ? replacements.get(oIdx) : oStatements[oIdx]);
    }
    newStatements.push(...insertionsAfter(insertions, oIdx));
  }

  return newStatements;
}

async function patchModule({ bundlePath, manifest, moduleId, baselinePath, currentPath }) {
  const mod = manifest[moduleId];
  if (!mod) throw new Error(`module ${moduleId} not found in manifest`);

  const rAst = parseFile(baselinePath);
  const mAst = parseFile(currentPath);
  const rFactory = extractFactoryBody(rAst).factory;
  const mFactory = extractFactoryBody(mAst).factory;

  const originalSource = readModuleSource(bundlePath, mod);
  const oAst = parse(originalSource, { sourceType: "script", allowReturnOutsideFunction: true });
  const oFactoryInfo = extractFactoryBody(oAst);

  const newStatements = buildPatchedFactoryStatements({
    oFactory: oFactoryInfo.factory,
    rFactory,
    mFactory,
  });
  oFactoryInfo.factory.body.body = newStatements;

  const { code: regenerated } = generate(oAst, { comments: false, retainLines: false });
  const minified = await minify(regenerated, { compress: true, mangle: true });
  if (minified.error) throw minified.error;

  let newModuleSource = minified.code.trim();
  if (!newModuleSource.endsWith(";")) newModuleSource += ";";
  return newModuleSource;
}

function parsePatchSpec(spec) {
  const eqIdx = spec.indexOf("=");
  const colonIdx = spec.indexOf(":", eqIdx);
  if (eqIdx === -1 || colonIdx === -1) {
    throw new Error(`invalid patch spec "${spec}", expected <module-id>=<baseline-file>:<current-file>`);
  }
  return {
    moduleId: spec.slice(0, eqIdx),
    baselinePath: spec.slice(eqIdx + 1, colonIdx),
    currentPath: spec.slice(colonIdx + 1),
  };
}

export async function runPatchback(bundlePath, patchSpecs, outputBundlePath) {
  const manifest = loadManifest(bundlePath);

  const patches = [];
  for (const spec of patchSpecs) {
    const { moduleId, baselinePath, currentPath } = parsePatchSpec(spec);
    const newSource = await patchModule({ bundlePath, manifest, moduleId, baselinePath, currentPath });
    patches.push({ moduleId, newSource });
  }

  const outBuffer = reassembleBundle(bundlePath, manifest, patches);
  fs.writeFileSync(outputBundlePath, outBuffer);
  console.log(`wrote patched bundle to ${outputBundlePath}`);
}
