#!/usr/bin/env node
import { Command } from "commander";
import { runIndex } from "../src/commands/index.js";
import { runShow } from "../src/commands/show.js";
import { runGrep } from "../src/commands/grep.js";
import { runDeps } from "../src/commands/deps.js";

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

program.parseAsync(process.argv);
