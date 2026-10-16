import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import generatorPkg from "@babel/generator";
import traversePkg from "@babel/traverse";
import { canonicalize, hashNode, countNodes } from "../canonicalize.js";
import { rules } from "../rules/index.js";

const generate = generatorPkg.default ?? generatorPkg;
const traverse = traversePkg.default ?? traversePkg;

export function explodedDirFor(bundlePath) {
  return path.join(path.dirname(bundlePath), path.basename(bundlePath) + ".exploded");
}

export function loadManifest(bundlePath) {
  const manifestPath = path.join(explodedDirFor(bundlePath), "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `No manifest at ${manifestPath}. Run "bundle-tool explode <bundle>" first.`
    );
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

// Walks every CallExpression whose callee is an immediately-invoked
// FunctionExpression, comparing its canonicalized hash against every
// registered rule; replaces the first match in place. Returns the set of
// rules that fired, so their helper declarations can be emitted once.
export function applyRules(ast) {
  const usedRules = new Set();
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (callee.type !== "FunctionExpression") return;

      const nodeCount = countNodes(callee);
      if (!rules.some((rule) => rule.matchesSize(nodeCount))) return;

      const hash = hashNode(canonicalize(callee));
      for (const rule of rules) {
        if (rule.match(hash)) {
          path.replaceWith(rule.replace(path.node));
          usedRules.add(rule);
          path.skip();
          break;
        }
      }
    },
  });
  return usedRules;
}

export function runDeobfuscate(bundlePath) {
  const manifest = loadManifest(bundlePath);
  const explodedDir = explodedDirFor(bundlePath);
  const outDir = path.join(explodedDir, "deobfuscated");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let deobfuscatedCount = 0;
  let skippedCount = 0;
  const entries = Object.entries(manifest);
  const total = entries.length;

  entries.forEach(([idStr, mod], index) => {
    if (mod.classification === "data") {
      skippedCount++;
      return;
    }

    const source = fs.readFileSync(path.join(explodedDir, mod.path), "utf8");
    console.log(
      `[${index + 1}/${total}] module ${idStr} (${Math.round(source.length / 1024)}KB)...`
    );
    const ast = parse(source, { sourceType: "script", allowReturnOutsideFunction: true });

    const usedRules = applyRules(ast);

    let code = generate(ast, { comments: true, retainLines: false }).code;
    if (usedRules.size > 0) {
      const helperDecls = [...usedRules]
        .map((rule) => generate(rule.helperDeclaration, { comments: false }).code)
        .join("\n\n");
      code = `${helperDecls}\n\n${code}`;
    }

    fs.writeFileSync(path.join(outDir, `${idStr}.js`), code);
    deobfuscatedCount++;
  });

  console.log(
    `deobfuscated ${deobfuscatedCount} logic modules to ${outDir} (skipped ${skippedCount} data modules)`
  );
}
