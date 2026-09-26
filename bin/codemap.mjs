#!/usr/bin/env node
// CLI entry: argument parsing and IO only; all logic lives in src/.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gitHubLinkBase } from "../src/gitRemote.mjs";
import { renderHtml } from "../src/html.mjs";
import { injectBlock } from "../src/inject.mjs";
import { renderMarkdown } from "../src/mermaid.mjs";
import { scan } from "../src/scan.mjs";

const USAGE = `Usage: codemap [dir] [options]

  dir               repository to map (default: current directory)
  --format FORMAT   mermaid (default), html or json
  --write FILE      mermaid: write the map into FILE between the codemap markers
                    html: write the interactive page to FILE (whole file)
                    FILE is relative to dir, e.g. README.md or docs/codemap.html
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
  if (!["mermaid", "html", "json"].includes(opts.format)) throw new Error(`unknown format "${opts.format}"`);
  if (opts.check && !opts.write) throw new Error("--check needs --write FILE");
  if (opts.write && opts.format === "json") throw new Error("--write supports the mermaid and html formats");
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
  const output =
    opts.format === "html"
      ? renderHtml(tree, { groups: config.groups, link })
      : renderMarkdown(tree, { groups: config.groups, sectionDepth: config.sectionDepth, link });

  // Printing is for piping; --write is the safe way to save (PowerShell's `>`
  // re-encodes stdout as UTF-16, which breaks both formats).
  if (!opts.write) {
    process.stdout.write(output);
    return 0;
  }

  const file = resolve(opts.dir, opts.write);
  const before = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (before === null && opts.format === "mermaid") throw new Error(`${opts.write} not found`);
  const after = opts.format === "html" ? output : injectBlock(before, output);
  // A Windows checkout may turn the committed LF file into CRLF.
  const unchanged = before !== null && before.replace(/\r\n/g, "\n") === after.replace(/\r\n/g, "\n");
  if (opts.check) {
    if (unchanged) return 0;
    process.stderr.write(`codemap: ${opts.write} is out of date — run codemap --write ${opts.write}\n`);
    return 1;
  }
  if (!unchanged) writeFileSync(file, after);
  process.stderr.write(`codemap: ${unchanged ? "unchanged" : before === null ? "created" : "updated"} ${opts.write}\n`);
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  process.stderr.write(`codemap: ${err.message}\n`);
  process.exitCode = 2;
}
