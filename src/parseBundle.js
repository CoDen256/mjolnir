import { parse } from "@babel/parser";
import fs from "node:fs";
import path from "node:path";

const CACHE_SUFFIX = ".analysis.json";

function cachePathFor(bundlePath) {
  return path.join(
    path.dirname(bundlePath),
    path.basename(bundlePath) + CACHE_SUFFIX
  );
}

function numericLiteral(node) {
  if (node == null) return null;
  if (node.type === "NumericLiteral") return node.value;
  if (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "NumericLiteral"
  ) {
    return -node.argument.value;
  }
  return null;
}

function depsArray(node) {
  if (node == null || node.type !== "ArrayExpression") return [];
  return node.elements
    .map((el) => numericLiteral(el))
    .filter((v) => v !== null);
}

// Rough, cheap "is this already human-written source" signal: vendor code
// bundled as-is retains comments/newlines inside the factory; terser-minified
// app code is single-line with short identifiers.
function minifiedSignal(source, factoryNode) {
  const body = source.slice(factoryNode.start, factoryNode.end);
  const newlineCount = (body.match(/\n/g) || []).length;
  const params = factoryNode.params || [];
  const shortParams = params.filter(
    (p) => p.type === "Identifier" && p.name.length <= 2
  ).length;
  return {
    newlineCount,
    looksMinified: newlineCount === 0,
  };
}

// Babel's node.start/end are JS-string (UTF-16 code unit) offsets into the
// source decoded via fs.readFileSync(path, "utf8") — not raw file byte
// offsets. Every consumer of this module's start/end (readModuleSource,
// reassembleBundle) slices the *raw file bytes* with these numbers, so for
// any bundle containing so much as a single non-ASCII character (observed:
// one accented name in a vendor license comment), using the char offset
// as-is silently shifts every subsequent module boundary by however many
// extra bytes those characters needed in UTF-8. This is harmless for
// operations that always reparse (a stray leading/trailing byte of noise
// doesn't break parsing) but corrupts a boundary that's directly spliced
// into regenerated content (see deck-card save path). Converts a set of
// char offsets to true byte offsets in one pass (total work is O(source
// length), not O(positions x length), since offsets are visited in sorted
// order and only the delta since the previous one is re-encoded).
function charToByteOffsets(source, charPositions) {
  const sorted = [...new Set(charPositions)].sort((a, b) => a - b);
  const byteOffsetFor = new Map();
  let prevChar = 0;
  let byteCursor = 0;
  for (const charPos of sorted) {
    byteCursor += Buffer.byteLength(source.slice(prevChar, charPos), "utf8");
    byteOffsetFor.set(charPos, byteCursor);
    prevChar = charPos;
  }
  return byteOffsetFor;
}

export function parseBundle(bundlePath) {
  const source = fs.readFileSync(bundlePath, "utf8");
  const ast = parse(source, {
    sourceType: "script",
    allowReturnOutsideFunction: true,
  });

  const modules = new Map();
  let entryId = null;
  const preludeStatements = [];
  const charPositions = [];

  for (const stmt of ast.program.body) {
    const expr = stmt.type === "ExpressionStatement" ? stmt.expression : null;

    if (
      expr &&
      expr.type === "CallExpression" &&
      expr.callee.type === "Identifier" &&
      expr.callee.name === "__d"
    ) {
      const [factoryNode, idNode, depsNode, verboseNameNode] = expr.arguments;
      const id = numericLiteral(idNode);
      if (id === null || factoryNode == null) {
        preludeStatements.push({ start: stmt.start, end: stmt.end });
        charPositions.push(stmt.start, stmt.end);
        continue;
      }
      const deps = depsArray(depsNode);
      const verboseName =
        verboseNameNode && verboseNameNode.type === "StringLiteral"
          ? verboseNameNode.value
          : null;
      const { newlineCount, looksMinified } = minifiedSignal(
        source,
        factoryNode
      );

      charPositions.push(stmt.start, stmt.end, factoryNode.start, factoryNode.end);
      modules.set(id, {
        id,
        start: stmt.start,
        end: stmt.end,
        factoryStart: factoryNode.start,
        factoryEnd: factoryNode.end,
        size: stmt.end - stmt.start,
        deps,
        dependents: [],
        verboseName,
        looksMinified,
        newlineCount,
      });
      continue;
    }

    if (
      expr &&
      expr.type === "CallExpression" &&
      expr.callee.type === "Identifier" &&
      expr.callee.name === "__r"
    ) {
      const arg = numericLiteral(expr.arguments[0]);
      if (arg !== null) entryId = arg;
      continue;
    }

    preludeStatements.push({ start: stmt.start, end: stmt.end });
    charPositions.push(stmt.start, stmt.end);
  }

  const byteOffsetFor = charToByteOffsets(source, charPositions);
  for (const stmt of preludeStatements) {
    stmt.start = byteOffsetFor.get(stmt.start);
    stmt.end = byteOffsetFor.get(stmt.end);
  }
  for (const mod of modules.values()) {
    mod.start = byteOffsetFor.get(mod.start);
    mod.end = byteOffsetFor.get(mod.end);
    mod.factoryStart = byteOffsetFor.get(mod.factoryStart);
    mod.factoryEnd = byteOffsetFor.get(mod.factoryEnd);
    mod.size = mod.end - mod.start;
  }

  for (const mod of modules.values()) {
    for (const depId of mod.deps) {
      const dep = modules.get(depId);
      if (dep) dep.dependents.push(mod.id);
    }
  }

  return {
    bundlePath,
    sourceLength: source.length,
    entryId,
    moduleCount: modules.size,
    preludeByteCount: preludeStatements.reduce(
      (sum, s) => sum + (s.end - s.start),
      0
    ),
    modules,
  };
}

export function buildAndCacheIndex(bundlePath) {
  const result = parseBundle(bundlePath);
  const stat = fs.statSync(bundlePath);

  const cache = {
    bundlePath: path.resolve(bundlePath),
    bundleSize: stat.size,
    bundleMtimeMs: stat.mtimeMs,
    entryId: result.entryId,
    moduleCount: result.moduleCount,
    preludeByteCount: result.preludeByteCount,
    modules: Object.fromEntries(
      [...result.modules.values()].map((m) => [
        m.id,
        {
          start: m.start,
          end: m.end,
          factoryStart: m.factoryStart,
          factoryEnd: m.factoryEnd,
          size: m.size,
          deps: m.deps,
          dependents: m.dependents,
          verboseName: m.verboseName,
          looksMinified: m.looksMinified,
          newlineCount: m.newlineCount,
        },
      ])
    ),
  };

  fs.writeFileSync(cachePathFor(bundlePath), JSON.stringify(cache));
  return cache;
}

export function loadIndex(bundlePath, { rebuildIfStale = true } = {}) {
  const cPath = cachePathFor(bundlePath);
  if (!fs.existsSync(cPath)) {
    if (!rebuildIfStale) {
      throw new Error(
        `No analysis cache at ${cPath}. Run "bundle-tool index <file>" first.`
      );
    }
    return buildAndCacheIndex(bundlePath);
  }

  const cache = JSON.parse(fs.readFileSync(cPath, "utf8"));
  const stat = fs.statSync(bundlePath);
  const stale =
    cache.bundleSize !== stat.size || cache.bundleMtimeMs !== stat.mtimeMs;

  if (stale && rebuildIfStale) {
    return buildAndCacheIndex(bundlePath);
  }
  return cache;
}

export function readModuleSource(bundlePath, moduleEntry) {
  const fd = fs.openSync(bundlePath, "r");
  const length = moduleEntry.end - moduleEntry.start;
  const buf = Buffer.alloc(length);
  fs.readSync(fd, buf, 0, length, moduleEntry.start);
  fs.closeSync(fd);
  return buf.toString("utf8");
}
