// Pure tree model: file list in, annotated folder tree out. No IO here, so
// every shape decision is unit-tested on synthetic paths.
//
// Node shapes:
//   dir  { kind: "dir",  name, path, files, lines, children[], description? }
//   file { kind: "file", name, path, lines,              description? }
// `files` and `lines` on a dir are totals for its whole subtree. `lines` on a
// file is null for binaries; binaries count toward `files` but not `lines`.
// The root has path "" and the name the caller gives it (the repo folder).

export function buildTree(files, rootName = ".") {
  const root = makeDir(rootName, "");
  for (const { path, lines } of files) {
    const parts = path.split("/");
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const childPath = parts.slice(0, i + 1).join("/");
      let next = dir.children.find((c) => c.kind === "dir" && c.name === parts[i]);
      if (!next) {
        next = makeDir(parts[i], childPath);
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({ kind: "file", name: parts.at(-1), path, lines: lines ?? null });
  }
  finalize(root);
  return root;
}

function makeDir(name, path) {
  return { kind: "dir", name, path, files: 0, lines: 0, children: [] };
}

// Post-order: compute totals, then sort (folders first, then by name).
function finalize(dir) {
  dir.files = 0;
  dir.lines = 0;
  for (const c of dir.children) {
    if (c.kind === "dir") {
      finalize(c);
      dir.files += c.files;
      dir.lines += c.lines;
    } else {
      dir.files += 1;
      dir.lines += c.lines ?? 0;
    }
  }
  dir.children.sort(compareNodes);
}

function compareNodes(a, b) {
  if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
  // Case-insensitive, then exact: deterministic on every OS and locale.
  const al = a.name.toLowerCase();
  const bl = b.name.toLowerCase();
  if (al !== bl) return al < bl ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

// Attach config descriptions by exact path. Returns the keys that matched
// nothing, so stale descriptions (a folder was renamed) surface as warnings
// instead of silently disappearing from the map.
export function annotate(tree, describe = {}) {
  const unused = new Set(Object.keys(describe));
  walk(tree, (node) => {
    if (Object.hasOwn(describe, node.path)) {
      node.description = describe[node.path];
      unused.delete(node.path);
    }
  });
  return [...unused].sort();
}

// Merge single-child folder chains: "app" → "components" → "ui" with nothing
// else along the way becomes one node "app/components/ui". Chains like this
// are the main reason raw trees are tall and unreadable; merging them loses
// no information. The root is never merged into its child.
// Run after annotate(): the merged node keeps the deepest description, or
// the nearest one above it if the deeper folders have none.
export function compact(tree) {
  for (const child of tree.children) if (child.kind === "dir") compactDir(child);
  return tree;
}

function compactDir(dir) {
  while (dir.children.length === 1 && dir.children[0].kind === "dir") {
    const only = dir.children[0];
    dir.name = `${dir.name}/${only.name}`;
    dir.path = only.path;
    dir.children = only.children;
    if (only.description !== undefined) dir.description = only.description;
  }
  for (const child of dir.children) if (child.kind === "dir") compactDir(child);
}

export function walk(node, visit) {
  visit(node);
  if (node.kind === "dir") for (const c of node.children) walk(c, visit);
}
