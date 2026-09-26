import assert from "node:assert/strict";
import { test } from "node:test";
import { assignGroups } from "../src/groups.mjs";
import { buildTree, compact } from "../src/tree.mjs";

const tree = () => compact(buildTree(["app/(english)/page.tsx", "app/api/x.ts", "lib/alliengll/a.ts", "lib/b.ts"].map((path) => ({ path, lines: 1 }))));
const find = (t, path) => {
  let hit;
  const visit = (n) => (n.path === path ? (hit = n) : n.children?.forEach(visit));
  visit(t);
  return hit;
};

test("first matching group wins; folder patterns cover their contents", () => {
  const t = tree();
  const warnings = assignGroups(t, [
    { name: "Alliengll", paths: ["app/(english)", "lib/alliengll"] },
    { name: "App", paths: ["app"] },
  ]);
  assert.deepEqual(warnings, []);
  assert.equal(find(t, "app/(english)").group, 0);
  assert.equal(find(t, "app/(english)/page.tsx").group, 0);
  assert.equal(find(t, "lib/alliengll").group, 0);
  assert.equal(find(t, "app").group, 1);
  assert.equal(find(t, "app/api").group, 1);
  assert.equal(find(t, "lib").group, undefined);
  assert.equal(t.group, undefined, "root is never grouped");
});

test("a group that matches nothing is reported", () => {
  assert.deepEqual(assignGroups(tree(), [{ name: "Ghost", paths: ["nowhere"] }]), ['group "Ghost" matched nothing']);
});
