#!/usr/bin/env node
import { Command } from "commander";
import { runIndex } from "../src/commands/index.js";
import { runShow } from "../src/commands/show.js";
import { runGrep } from "../src/commands/grep.js";
import { runDeps } from "../src/commands/deps.js";
import { runExplode } from "../src/commands/explode.js";
import { runDeobfuscate } from "../src/commands/deobfuscate.js";
import { runCheck } from "../src/commands/check.js";
import { runDiff } from "../src/commands/diff.js";
import { runPatchback } from "../src/commands/patchback.js";
import { runUi } from "../src/commands/ui.js";

const program = new Command();

program
  .name("bundle-tool")
  .description("Analyze a Metro production bundle without ever dumping the whole file");

program
  .command("index <bundle>")
  .description("Parse the bundle and (re)build the module index cache")
  .option("--top <n>", "how many largest modules to list", "10")
  .action((bundle, opts) => runIndex(bundle, { top: Number(opts.top) }));

program
  .command("show <bundle> <id>")
  .description("Pretty-print a single module by id")
  .option("--raw", "print the original source instead of re-formatting", false)
  .action((bundle, id, opts) => runShow(bundle, Number(id), { raw: opts.raw }));

program
  .command("grep <bundle> <pattern>")
  .description("Search module source for a literal string or (with --regex) a pattern")
  .option("--regex", "treat <pattern> as a regular expression", false)
  .option("--limit <n>", "max matches to print", "50")
  .action((bundle, pattern, opts) =>
    runGrep(bundle, pattern, { regex: opts.regex, limit: Number(opts.limit) })
  );

program
  .command("deps <bundle> <id>")
  .description("List modules this module depends on")
  .option("--depth <n>", "how many hops to walk", "1")
  .action((bundle, id, opts) => runDeps(bundle, id, "deps", { depth: Number(opts.depth) }));

program
  .command("dependents <bundle> <id>")
  .description("List modules that depend on this module")
  .option("--depth <n>", "how many hops to walk", "1")
  .action((bundle, id, opts) =>
    runDeps(bundle, id, "dependents", { depth: Number(opts.depth) })
  );

program
  .command("explode <bundle>")
  .description("Write every module to its own file under <bundle>.exploded/, plus a manifest")
  .action((bundle) => runExplode(bundle));

program
  .command("deobfuscate <bundle>")
  .description("Rewrite recognized minified idioms in logic modules to readable named-helper form")
  .action((bundle) => runDeobfuscate(bundle));

program
  .command("check <baseline-file> <current-file>")
  .description("Verify a refactor-only edit preserved behavior by canonicalizing and comparing against a baseline")
  .action((baselineFile, currentFile) => runCheck(baselineFile, currentFile));

program
  .command("diff <baseline-file> <current-file>")
  .description("Report the semantic changes between a refactor-baseline module file and its current edited version")
  .action((baselineFile, currentFile) => runDiff(baselineFile, currentFile));

program
  .command("patch-back <bundle> <output-bundle> <patches...>")
  .description(
    "Apply one or more module patches (<module-id>=<baseline-file>:<current-file>) and write a reassembled bundle"
  )
  .action(async (bundle, outputBundle, patches) => {
    await runPatchback(bundle, patches, outputBundle);
  });

program
  .command("ui")
  .description("Start the bundle-workbench app server (open bundles by path from within the UI)")
  .option("--port <n>", "port to listen on (0 = pick any free port)", "0")
  .option("--patches-dir <dir>", "directory to read/write patch files, relative to CWD", "patches")
  .option("--editor-cmd <cmd>", "shell command template to open a module file, {path} substituted", "code {path}")
  .action((opts) =>
    runUi({ port: Number(opts.port), patchesDir: opts.patchesDir, editorCmd: opts.editorCmd })
  );

program.parseAsync(process.argv);
