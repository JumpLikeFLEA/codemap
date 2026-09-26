// End-to-end over a real throwaway git repo: exercises git ls-files, the
// ignore rules, line counting and the config together.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { scan } from "../src/scan.mjs";

let dir;
const write = (rel, content) => {
  mkdirSync(join(dir, rel, ".."), { recursive: true });
  writeFileSync(join(dir, rel), content);
};
const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });

before(() => {
  dir = mkdtempSync(join(tmpdir(), "codemap-scan-"));
  git("init", "-q");
  write(".gitignore", "node_modules\n.env\n");
  write("README.md", "# hi\nline two\n");         // 2 lines
  write("src/index.ts", "a\nb\nc");               // 3 lines, no trailing newline
  write("src/deep/only/leaf.ts", "x\n");          // 1 line, single-child chain
  write("assets/logo.png", Buffer.from([0x89, 0x50, 0x00, 0x01])); // binary
  write("node_modules/pkg/index.js", "ignored\n");
  write(".env", "SECRET=1\n");
  write("codemap.config.json", JSON.stringify({ exclude: ["assets"], describe: { src: "Sources", nope: "x" } }));
  git("add", "README.md", "src", ".gitignore");   // the rest stays untracked
});

after(() => rmSync(dir, { recursive: true, force: true }));

test("maps tracked + untracked files, skips ignored and excluded ones", () => {
  const { tree, warnings } = scan(dir);
  const all = [];
  const visit = (n) => (n.kind === "file" ? all.push(n.path) : n.children.forEach(visit));
  visit(tree);
  assert.deepEqual(all.sort(), [
    ".gitignore",
    "codemap.config.json",
    "README.md",
    "src/deep/only/leaf.ts",
    "src/index.ts",
  ].sort());
  assert.deepEqual(warnings, ['describe: no file or folder at "nope"']);
});

test("counts lines, attaches descriptions and compacts chains", () => {
  const { tree } = scan(dir);
  const src = tree.children.find((c) => c.name === "src");
  assert.equal(src.description, "Sources");
  assert.equal(src.lines, 4);
  assert.equal(src.children[0].name, "deep/only");
  assert.equal(tree.children.find((c) => c.name === "README.md").lines, 2);
});

test("fails clearly outside a git repository", () => {
  const plain = mkdtempSync(join(tmpdir(), "codemap-nogit-"));
  try {
    assert.throws(() => scan(plain), /git ls-files failed/);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});
