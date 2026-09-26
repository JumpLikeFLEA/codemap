import assert from "node:assert/strict";
import { test } from "node:test";
import { renderHtml } from "../src/html.mjs";
import { annotate, buildTree, compact } from "../src/tree.mjs";

const make = (paths, describe = {}) => {
  const t = buildTree(paths.map((path) => ({ path, lines: 3 })), "repo");
  annotate(t, describe);
  return compact(t);
};
const dataOf = (html) => JSON.parse(html.match(/<script type="application\/json" id="data">(.*?)<\/script>/s)[1]);

test("is one self-contained page: no external scripts, styles or fetches", () => {
  const html = renderHtml(make(["a/b.ts"]));
  assert.match(html, /^<!doctype html>/);
  assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet|fetch\(|https?:\/\/(?!www\.w3\.org)/.test(html));
});

test("embeds every file and folder, with descriptions and groups, without counts", () => {
  const t = make(["src/a.ts", "src/b.ts", "README.md"], { src: "Sources" });
  t.children[0].group = 1;
  const { tree, groups, title } = dataOf(renderHtml(t, { groups: [{ name: "G0" }, { name: "G1" }] }));
  assert.equal(title, "repo");
  assert.deepEqual(groups.map((g) => g.swatch), ["🟨", "🟦"]);
  assert.deepEqual(tree.c.map((c) => c.n), ["src", "README.md"]);
  assert.equal(tree.c[0].d, "Sources");
  assert.equal(tree.c[0].g, 1);
  assert.deepEqual(tree.c[0].c.map((c) => c.n), ["a.ts", "b.ts"], "undescribed files are included");
  assert.ok(!JSON.stringify(tree).includes('"lines"'));
});

test("links point at GitHub when a link base is given", () => {
  const { tree } = dataOf(renderHtml(make(["src/a.ts", "x.md"]), { link: { base: "https://github.com/o/r", branch: "main" } }));
  assert.equal(tree.u, "https://github.com/o/r");
  assert.equal(tree.c[0].u, "https://github.com/o/r/tree/main/src");
  assert.equal(tree.c[0].c[0].u, "https://github.com/o/r/blob/main/src/a.ts");
});

test("hostile names and descriptions cannot break out of the page", () => {
  const t = make(["x/</script><b>.ts"], { x: '</script><img src=x onerror=alert(1)>"' });
  const html = renderHtml(t, { title: '<b>"t"' });
  assert.equal((html.match(/<\/script>/g) || []).length, 2, "only the two real closing tags");
  assert.ok(html.includes("<title>&lt;b&gt;&quot;t&quot; — code map</title>"));
  assert.equal(dataOf(html).tree.c[0].d, '</script><img src=x onerror=alert(1)>"', "round-trips intact");
});
