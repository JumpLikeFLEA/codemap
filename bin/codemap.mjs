#!/usr/bin/env node
// CLI entry: argument parsing and IO only; all logic lives in src/.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gitHubLinkBase } from "../src/gitRemote.mjs";
import { injectBlock } from "../src/inject.mjs";
import { renderMarkdown } from "../src/mermaid.mjs";
import { scan } from "../src/scan.mjs";

const USAGE = `Usage: codemap [dir] [options]

  dir               repository to map (default: current directory)
  --format FORMAT   mermaid (default) or json
  --write FILE      write the map into FILE between the codemap markers
                    (FILE is relative to dir, e.g. README.md)
  --check           with --write: change nothing, exit 1 if FILE is out of date
  --branch NAME     branch for GitHub links (default: the remote's default branch)
  -h, --help        show this help
`;

function parseArgs(argv) {
  const opts = { dir: ".", format: "mermaid" };
  const value = (i, flag) => {
    if (i >= argv.length || argv[i].startsWith("-")) throw new Error(`${flag} needs a value`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.startsWith("--") && a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    if (flag === "-h" || flag === "--help") opts.help = true;
    else if (flag === "--check") opts.check = true;
    else if (flag === "--format") opts.format = inline ?? value(++i, flag);
    else if (flag === "--write") opts.write = inline ?? value(++i, flag);
    else if (flag === "--branch") opts.branch = inline ?? value(++i, flag);
    else if (flag.startsWith("-")) throw new Error(`unknown option ${flag}`);
    else opts.dir = a;
  }
  if (!["mermaid", "json"].includes(opts.format)) throw new Error(`unknown format "${opts.format}"`);
  if (opts.check && !opts.write) throw new Error("--check needs --write FILE");
  if (opts.write && opts.format !== "mermaid") throw new Error("--write only supports the mermaid format");
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const { tree, warnings, config } = scan(opts.dir);
  for (const w of warnings) process.stderr.write(`codemap: warning: ${w}\n`);

  if (opts.format === "json") {
    process.stdout.write(JSON.stringify(tree, null, 2) + "\n");
    return 0;
  }

  const link = config.links ? gitHubLinkBase(resolve(opts.dir), opts.branch) : null;
  if (config.links && !link) process.stderr.write("codemap: warning: no GitHub origin found, drawing without links\n");
  const markdown = renderMarkdown(tree, { groups: config.groups, sectionDepth: config.sectionDepth, link });

  if (!opts.write) {
    process.stdout.write(markdown);
    return 0;
  }

  const file = resolve(opts.dir, opts.write);
  const before = readFileSync(file, "utf8");
  const after = injectBlock(before, markdown);
  if (opts.check) {
    if (before === after) return 0;
    process.stderr.write(`codemap: ${opts.write} is out of date — run codemap --write ${opts.write}\n`);
    return 1;
  }
  if (before !== after) writeFileSync(file, after);
  process.stderr.write(`codemap: ${before === after ? "unchanged" : "updated"} ${opts.write}\n`);
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  process.stderr.write(`codemap: ${err.message}\n`);
  process.exitCode = 2;
}
