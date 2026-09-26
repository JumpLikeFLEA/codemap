#!/usr/bin/env node
// CLI entry. Step 1 exposes only the tree model as JSON; renderers
// (--format mermaid / html) arrive as separate modules.

import { scan } from "../src/scan.mjs";

const USAGE = `Usage: codemap [dir] [--format json]

  dir        repository to map (default: current directory)
  --format   output format: json (default)
`;

function parseArgs(argv) {
  const opts = { dir: ".", format: "json" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--format") opts.format = argv[++i];
    else if (a.startsWith("--format=")) opts.format = a.slice(9);
    else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else opts.dir = a;
  }
  return opts;
}

try {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (opts.format !== "json") throw new Error(`unknown format "${opts.format}"`);

  const { tree, warnings } = scan(opts.dir);
  for (const w of warnings) process.stderr.write(`codemap: warning: ${w}\n`);
  process.stdout.write(JSON.stringify(tree, null, 2) + "\n");
} catch (err) {
  process.stderr.write(`codemap: ${err.message}\n\n${USAGE}`);
  process.exit(1);
}
