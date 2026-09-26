import assert from "node:assert/strict";
import { test } from "node:test";
import { annotate, buildTree, compact } from "../src/tree.mjs";

const f = (path, lines = 1) => ({ path, lines });
const names = (dir) => dir.children.map((c) => c.name);

test("builds nested folders with subtree totals", () => {
  const t = buildTree([f("README.md", 10), f("src/a.ts", 5), f("src/b/c.ts", 7), f("logo.png", null)], "repo");
  assert.equal(t.name, "repo");
  assert.equal(t.path, "");
  assert.equal(t.files, 4, "binary counts as a file");
  assert.equal(t.lines, 22, "binary contributes no lines");
  const src = t.children.find((c) => c.name === "src");
  assert.equal(src.files, 2);
  assert.equal(src.lines, 12);
  assert.equal(src.children[0].path, "src/b");
});

test("empty input gives an empty root, not a crash", () => {
  const t = buildTree([], "repo");
  assert.equal(t.files, 0);
  assert.deepEqual(t.children, []);
});

test("sorts folders first, then case-insensitively by name", () => {
  const t = buildTree([f("b.md"), f("A.md"), f("z/x.ts"), f("C/x.ts")]);
  assert.deepEqual(names(t), ["C", "z", "A.md", "b.md"]);
});

test("annotate attaches exact-path descriptions and reports unused keys", () => {
  const t = buildTree([f("lib/items/a.ts"), f("README.md")]);
  const unused = annotate(t, { "lib/items": "Item types", "README.md": "Intro", "lib/gone": "stale" });
  assert.deepEqual(unused, ["lib/gone"]);
  assert.equal(t.children[0].children[0].description, "Item types");
  assert.equal(t.children[1].description, "Intro");
  assert.equal(t.children[0].description, undefined, "no prefix matching");
});

test("compact merges single-child folder chains", () => {
  const t = compact(buildTree([f("app/components/ui/button.tsx"), f("app/components/ui/card.tsx"), f("x.md")]));
  assert.deepEqual(names(t), ["app/components/ui", "x.md"]);
  const merged = t.children[0];
  assert.equal(merged.path, "app/components/ui");
  assert.equal(merged.files, 2);
  assert.deepEqual(names(merged), ["button.tsx", "card.tsx"]);
});

test("compact stops where a folder has files or several subfolders", () => {
  const t = compact(buildTree([f("a/b/one.ts"), f("a/b/c/two.ts"), f("a/b/d/three.ts")]));
  assert.deepEqual(names(t), ["a/b"]);
  assert.deepEqual(names(t.children[0]), ["c", "d", "one.ts"]);
});

test("compact never merges the root, even with a single child folder", () => {
  const t = compact(buildTree([f("src/a.ts")], "repo"));
  assert.equal(t.name, "repo");
  assert.deepEqual(names(t), ["src"]);
});

test("merged node keeps the deepest description, else the nearest above", () => {
  const t1 = buildTree([f("a/b/c/x.ts")]);
  annotate(t1, { a: "top", "a/b/c": "deep" });
  compact(t1);
  assert.equal(t1.children[0].description, "deep");

  const t2 = buildTree([f("a/b/c/x.ts")]);
  annotate(t2, { a: "top" });
  compact(t2);
  assert.equal(t2.children[0].description, "top");
});
