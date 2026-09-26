// Pure URL building for links to GitHub's web view. Kept apart from
// gitRemote.mjs (which runs git) so renderers stay free of IO imports.

// Web URL for a tree node: the repo root → the repo page, folders → tree/,
// files → blob/. Each path segment is encoded; encodeURIComponent leaves
// ' ( ) alone, and the Mermaid label wraps href in single quotes, so ' is
// encoded too.
export function webUrl({ base, branch }, node, isRepoRoot = false) {
  if (isRepoRoot) return base;
  const kind = node.kind === "dir" ? "tree" : "blob";
  const path = node.path.split("/").map(encodeSegment).join("/");
  return `${base}/${kind}/${encodeSegment(branch)}/${path}`;
}

function encodeSegment(s) {
  return encodeURIComponent(s).replace(/'/g, "%27");
}
