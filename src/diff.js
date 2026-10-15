import * as t from "@babel/types";
import { canonicalize, hashNode } from "./canonicalize.js";

// Canonicalizes a raw statement list as a whole (so cross-statement scope —
// e.g. a var declared in one statement and read in another — resolves
// correctly), returning the parallel canonicalized list. Index i of the
// result corresponds to index i of `rawStatements`.
//
// Note: this wraps the statements in a bare Program, with no enclosing
// function scope. Statements that reference an *enclosing* function's own
// parameters (as every module factory body does) must go through
// `canonicalizeFactoryBody` instead, so those parameter bindings resolve
// instead of looking like free/global identifiers.
export function canonicalizeStatementList(rawStatements) {
  const wrapper = t.program(rawStatements);
  const canonicalProgram = canonicalize(wrapper);
  return canonicalProgram.body;
}

// Canonicalizes a factory FunctionExpression as a whole (so its own
// parameters are recognized as bindings — renamed to the same deterministic
// _b0, _b1, ... as any other local), then returns the canonicalized body's
// statement list. Two factories with the same param count/body shape but
// differently-spelled params (e.g. after a human's rename pass) canonicalize
// to identical statement hashes.
export function canonicalizeFactoryBody(factoryNode) {
  const canonicalFactory = canonicalize(factoryNode);
  return canonicalFactory.body.body;
}

// Pairs nodes of two (already canonicalized) lists by content-hash
// identity. Within a shared hash, pairing is first-occurrence-to-
// first-occurrence, second-to-second, etc. — occurrence order is only ever
// used to disambiguate a hash collision, never as the primary key. Returns
// matched pairs plus each side's unmatched ("leftover") indices, in order.
export function pairByHash(aNodes, bNodes) {
  const bQueues = new Map();
  bNodes.forEach((node, idx) => {
    const h = hashNode(node);
    if (!bQueues.has(h)) bQueues.set(h, []);
    bQueues.get(h).push(idx);
  });

  const pairs = [];
  const matchedB = new Set();
  const aLeftover = [];

  aNodes.forEach((node, aIdx) => {
    const h = hashNode(node);
    const queue = bQueues.get(h);
    if (queue && queue.length) {
      const bIdx = queue.shift();
      pairs.push({ aIdx, bIdx });
      matchedB.add(bIdx);
    } else {
      aLeftover.push(aIdx);
    }
  });

  const bLeftover = bNodes.map((_, i) => i).filter((i) => !matchedB.has(i));
  return { pairs, aLeftover, bLeftover };
}

function getNestedStatements(node) {
  if (!node) return null;
  if (node.type === "BlockStatement" || node.type === "Program") return node.body;
  if (
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression") &&
    node.body &&
    node.body.type === "BlockStatement"
  ) {
    return node.body.body;
  }
  return null;
}

function maybeRecurse(rNode, mNode) {
  if (rNode.type !== mNode.type) return null;
  const rStatements = getNestedStatements(rNode);
  const mStatements = getNestedStatements(mNode);
  if (!rStatements || !mStatements) return null;
  return diffStatementList(rStatements, mStatements);
}

// Recursive structural diff over two (already canonicalized) statement
// lists. Classifies each pairing as unchanged/modified/added/removed; a
// "modified" pair recurses into matched compound nodes (blocks, function
// bodies) to localize further where possible.
export function diffStatementList(rNodes, mNodes) {
  const { pairs, aLeftover: rLeftover, bLeftover: mLeftover } = pairByHash(rNodes, mNodes);

  const entries = [];
  for (const { aIdx, bIdx } of pairs) {
    entries.push({
      kind: "unchanged",
      rIdx: aIdx,
      mIdx: bIdx,
      rNode: rNodes[aIdx],
      mNode: mNodes[bIdx],
    });
  }

  const minLen = Math.min(rLeftover.length, mLeftover.length);
  for (let k = 0; k < minLen; k++) {
    const rIdx = rLeftover[k];
    const mIdx = mLeftover[k];
    const rNode = rNodes[rIdx];
    const mNode = mNodes[mIdx];
    entries.push({
      kind: "modified",
      rIdx,
      mIdx,
      rNode,
      mNode,
      children: maybeRecurse(rNode, mNode),
    });
  }

  for (const rIdx of rLeftover.slice(minLen)) {
    entries.push({ kind: "removed", rIdx, rNode: rNodes[rIdx] });
  }
  for (const mIdx of mLeftover.slice(minLen)) {
    entries.push({ kind: "added", mIdx, mNode: mNodes[mIdx] });
  }

  entries.sort((a, b) => {
    const aKey = a.rIdx ?? a.mIdx + 0.5;
    const bKey = b.rIdx ?? b.mIdx + 0.5;
    return aKey - bKey;
  });

  return entries;
}

// Diffs two modules' factory functions (the FunctionExpression nodes
// straight from their parsed ASTs), canonicalizing each — params included —
// as a whole first.
export function diffModuleFactories(rFactoryNode, mFactoryNode) {
  const rCanon = canonicalizeFactoryBody(rFactoryNode);
  const mCanon = canonicalizeFactoryBody(mFactoryNode);
  return diffStatementList(rCanon, mCanon);
}
