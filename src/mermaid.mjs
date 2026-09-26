// Renders the tree as Markdown for a GitHub README: one overview diagram
// (the repo's top level) followed by one collapsed <details> section per
// top-level folder that has subfolders. Pure: tree + options in, string out.
//
// Why overview + sections instead of one diagram: a real repo is hundreds of
// nodes and ~10 levels deep (colloquiz: 782 nodes, depth 10), which no
// diagram shows legibly. <details> is the only interactivity GitHub allows
// in a README, and it lets the reader open one area at a time.
//
// What is drawn: folders down to the depth limit, plus any FILE that has a
// description in the config. Other files appear only as counts, so the
// config decides which files matter enough to be on the map.
//
// Links: GitHub blocks Mermaid `click` directives (the diagram runs in a
// sandboxed iframe), but an <a href> inside a node label works, so the node
// NAME is the link. See the README's "Links on GitHub" note.

// Fills are light with dark text so they stay readable on GitHub's light and
// dark themes alike. The emoji square is the legend swatch for each colour.
export const PALETTE = [
  { swatch: "🟨", fill: "#fef3c7", stroke: "#d97706", color: "#451a03" },
  { swatch: "🟦", fill: "#dbeafe", stroke: "#2563eb", color: "#172554" },
  { swatch: "🟩", fill: "#dcfce7", stroke: "#16a34a", color: "#052e16" },
  { swatch: "🟪", fill: "#f3e8ff", stroke: "#9333ea", color: "#3b0764" },
];

export function renderMarkdown(tree, { groups = [], sectionDepth = 2, link = null } = {}) {
  const out = [];
  const overview = renderDiagram(tree, 1, { link, isRepoRoot: true });
  out.push(fence(overview.text));

  const sections = tree.children.filter((c) => c.kind === "dir" && hasSubfolders(c));
  const legend = legendLine(groups, overview.hasCollapsed && sections.length > 0);
  if (legend) out.push(legend);

  for (const dir of sections) {
    const diagram = renderDiagram(dir, sectionDepth, { link });
    const desc = dir.description ? ` — ${escapeHtml(dir.description)}` : "";
    out.push(
      [
        "<details>",
        `<summary><b>${escapeHtml(dir.name)}/</b> — ${stats(dir)}${desc}</summary>`,
        "",
        fence(diagram.text),
        "",
        "</details>",
      ].join("\n"),
    );
  }
  return out.join("\n\n") + "\n";
}

// One Mermaid flowchart rooted at `root`, `maxDepth` levels deep.
export function renderDiagram(root, maxDepth, { link = null, isRepoRoot = false } = {}) {
  const nodes = [];
  const edges = [];
  const classes = new Map(); // class name → node ids
  let next = 0;
  const addClass = (cls, id) => {
    if (!classes.has(cls)) classes.set(cls, []);
    classes.get(cls).push(id);
  };

  const visit = (node, depth, parentId) => {
    const id = `n${next++}`;
    nodes.push(`  ${id}["${label(node, link, isRepoRoot && depth === 0)}"]`);
    if (parentId) edges.push(`  ${parentId} --> ${id}`);
    if (node.group !== undefined) addClass(`g${node.group}`, id);
    if (node.kind === "file") {
      addClass("file", id);
      return;
    }
    if (depth === maxDepth) {
      if (hasSubfolders(node)) addClass("collapsed", id);
      return;
    }
    for (const child of node.children) {
      if (child.kind === "dir" || child.description !== undefined) visit(child, depth + 1, id);
    }
  };
  visit(root, 0, null);

  const lines = ["flowchart LR", ...nodes, ...edges];
  for (const [cls, ids] of classes) {
    lines.push(`  classDef ${cls} ${classStyle(cls)}`);
    lines.push(`  class ${ids.join(",")} ${cls}`);
  }
  return { text: lines.join("\n"), hasCollapsed: classes.has("collapsed") };
}

function classStyle(cls) {
  if (cls === "collapsed") return "stroke-dasharray:6 4";
  if (cls === "file") return "stroke-width:0.5px";
  const p = PALETTE[Number(cls.slice(1))];
  return `fill:${p.fill},stroke:${p.stroke},color:${p.color}`;
}

function label(node, link, isRepoRoot) {
  const name = escapeLabel(node.name);
  const href = link ? webUrl(link, node, isRepoRoot) : null;
  // color:inherit: the browser's default link blue is unreadable on dark
  // theme node fills; the underline still marks the name as a link.
  const title = href ? `<a href='${href}' style='color:inherit'>${name}</a>` : name;
  const parts = node.kind === "dir" ? [`<b>${title}</b>`, `<small>${stats(node)}</small>`] : [title];
  if (node.description) parts.push(`<i>${escapeLabel(node.description)}</i>`);
  return parts.join("<br/>");
}

function webUrl({ base, branch }, node, isRepoRoot) {
  if (isRepoRoot) return base;
  const kind = node.kind === "dir" ? "tree" : "blob";
  const path = node.path.split("/").map(encodeSegment).join("/");
  return `${base}/${kind}/${encodeSegment(branch)}/${path}`;
}

// encodeURIComponent leaves ' ( ) unencoded; the label wraps href in single
// quotes, so ' must be encoded too.
function encodeSegment(s) {
  return encodeURIComponent(s).replace(/'/g, "%27");
}

export function stats(dir) {
  const files = `${dir.files} ${dir.files === 1 ? "file" : "files"}`;
  return dir.lines > 0 ? `${files} · ${approx(dir.lines)} lines` : files;
}

// Two significant figures: 33430 → "33k", 1521 → "1.5k", 239 → "240".
// Exact line counts would change the README on every commit and make
// `--check` fail constantly; rounded ones move only on real growth.
export function approx(n) {
  if (n < 100) return String(n);
  const p = Number(n.toPrecision(2));
  if (p >= 1e6) return `${p / 1e6}M`;
  if (p >= 1e3) return `${p / 1e3}k`;
  return String(p);
}

function hasSubfolders(node) {
  return node.kind === "dir" && node.children.some((c) => c.kind === "dir");
}

function legendLine(groups, showCollapsed) {
  const items = groups.map((g, i) => `${PALETTE[i].swatch} ${escapeHtml(g.name)}`);
  if (showCollapsed) items.push("dashed border = has more subfolders than shown · open the sections below for detail");
  return items.length ? `<sub>${items.join(" · ")}</sub>` : "";
}

function fence(text) {
  return "```mermaid\n" + text + "\n```";
}

// Inside a Mermaid "quoted label": entity codes, not HTML entities.
function escapeLabel(s) {
  return s.replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
