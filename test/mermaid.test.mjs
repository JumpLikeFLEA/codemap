import assert from "node:assert/strict";
import { test } from "node:test";
import { renderDiagram, renderMarkdown } from "../src/mermaid.mjs";
import { annotate, buildTree, compact } from "../src/tree.mjs";

const make = (paths, describe = {}) => {
  const t = buildTree(paths.map((p) => (typeof p === "string" ? { path: p, lines: 10 } : p)), "repo");
  annotate(t, describe);
  return compact(t);
};
const nodeLines = (text) => text.split("\n").filter((l) => /^\s+n\d+\[/.test(l));

test("depth limit: folders beyond it are not drawn, the cut folder is dashed", () => {
  const t = make(["a/b/c/x.ts", "a/b/d/y.ts", "a/e.ts", "z.ts"]);
  const { text, hasCollapsed } = renderDiagram(t, 1);
  assert.equal(nodeLines(text).length, 2, "root + a (b is below the limit, plain files are not drawn)");
  assert.ok(hasCollapsed);
  assert.match(text, /classDef collapsed/);
  assert.match(text, /class n1 collapsed/);
});

test("labels are name + description only; only described files are drawn", () => {
  const t = make(["src/a.ts", "src/b.ts", "proxy.ts"], { "proxy.ts": "Route gating", src: "Sources" });
  const { text } = renderDiagram(t, 1);
  assert.match(text, /\["proxy\.ts<br\/><i>Route gating<\/i>"\]/);
  assert.match(text, /\["<b>src<\/b><br\/><i>Sources<\/i>"\]/);
  assert.ok(!/files|lines|<small>/.test(text), "no counts");
  assert.ok(!text.includes("a.ts"));
});

test("labels escape quotes and angle brackets; names with parens survive", () => {
  const t = make(["app/(english)/p.ts", "app/x/q.ts"], { "app/(english)": 'Says "hi" <b>' });
  const { text } = renderDiagram(t, 2);
  assert.match(text, /\(english\)/);
  assert.match(text, /Says #quot;hi#quot; #lt;b#gt;/);
});

test("links: repo root → repo, folders → tree/, files → blob/, segments encoded", () => {
  const t = make(["app/(english)/p's.ts", "app/x/q.ts"], { "app/(english)/p's.ts": "file" });
  const link = { base: "https://github.com/o/r", branch: "main" };
  const { text } = renderDiagram(t, 3, { link, isRepoRoot: true });
  assert.match(text, /<a href='https:\/\/github\.com\/o\/r' style='color:inherit'>repo<\/a>/);
  assert.match(text, /href='https:\/\/github\.com\/o\/r\/tree\/main\/app\/\(english\)'/);
  assert.match(text, /href='https:\/\/github\.com\/o\/r\/blob\/main\/app\/\(english\)\/p%27s\.ts'/);
});

test("group classes use the palette and coexist with collapsed", () => {
  const t = make(["a/b/c.ts", "a/f/g.ts", "d/e.ts"]);
  t.children[0].group = 0;
  const { text } = renderDiagram(t, 1);
  assert.match(text, /classDef g0 fill:#fef3c7/);
  assert.match(text, /class n1 g0/);
  assert.match(text, /class n1 collapsed/);
});

test("markdown: overview, legend, one <details> per top-level folder with subfolders", () => {
  const t = make(["app/api/x.ts", "app/ui/y.ts", "lib/a.ts", "README.md"], { app: "Routes" });
  const md = renderMarkdown(t, { groups: [{ name: "Alliengll", paths: ["x"] }] });
  assert.equal(md.match(/```mermaid/g).length, 2, "overview + app section; lib has no subfolders");
  assert.match(md, /<sub>🟨 Alliengll · dashed border/);
  assert.match(md, /<summary><b>app\/<\/b> — Routes<\/summary>/);
  assert.ok(!md.includes("<b>lib/</b>"));
});

test("output is deterministic", () => {
  const t = make(["b/x/1.ts", "a/y/2.ts", "a/z/3.ts"]);
  assert.equal(renderMarkdown(t), renderMarkdown(t));
});
