// Assigns each node the index of the first config group whose paths match
// it (node.group = 0..3). Pure; runs on the compacted tree.
//
// A merged node ("app/components/ui") is matched on its full path, so a
// group pattern should name the deepest folder of a chain or use a glob.
// Warnings list groups that matched nothing — the same stale-config guard as
// unused descriptions.

import { matchesAny } from "./glob.mjs";
import { walk } from "./tree.mjs";

export function assignGroups(tree, groups = []) {
  const hits = groups.map(() => 0);
  walk(tree, (node) => {
    if (node.path === "") return; // the root is never grouped
    const i = groups.findIndex((g) => matchesAny(node.path, g.paths));
    if (i >= 0) {
      node.group = i;
      hits[i]++;
    }
  });
  return groups.filter((_, i) => hits[i] === 0).map((g) => `group "${g.name}" matched nothing`);
}
