// Renders the tree as ONE self-contained, interactive HTML page: no network,
// no dependencies, opens from disk or any static host. Pure: tree in,
// string out.
//
// Interaction (all client-side, in PAGE_SCRIPT below):
//   - click a folder (or Enter/Space on it) to open or close it
//   - ↗ opens the folder or file on GitHub
//   - search narrows the tree to matches (by name, path or description) and
//     the folders leading to them; clearing it restores the previous view
//   - Top level / Expand all buttons
//
// Unlike the README diagram, every file is included: collapsing makes the
// full tree affordable, and a search is only useful if it can find files.
// Described files are emphasised. The data is embedded as JSON; `</` is
// escaped so a path or description can never close the <script> tag.

import { PALETTE } from "./mermaid.mjs";
import { webUrl } from "./webUrl.mjs";

// Dark-theme fills for the same four group colours (light fills from
// PALETTE); strokes are shared.
const DARK_FILLS = ["#3a2c0c", "#12294d", "#0f3320", "#2d1a45"];

export function renderHtml(tree, { groups = [], link = null, title } = {}) {
  const data = {
    title: title ?? tree.name,
    groups: groups.map((g, i) => ({ name: g.name, swatch: PALETTE[i].swatch })),
    tree: slim(tree, link, true),
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const groupCss = PALETTE.map(
    (p, i) =>
      `.g${i}{--gfill:${p.fill};--gstroke:${p.stroke};--gtext:${p.color}}` +
      `@media (prefers-color-scheme:dark){.g${i}{--gfill:${DARK_FILLS[i]};--gtext:var(--fg)}}`,
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)} — code map</title>
<style>
${PAGE_CSS}
${groupCss}
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(data.title)} <span>code map</span></h1>
  <div class="controls">
    <input id="q" type="search" placeholder="Search folders and files" aria-label="Search" autocomplete="off">
    <span id="hits" aria-live="polite"></span>
    <button id="top" type="button">Top level</button>
    <button id="all" type="button">Expand all</button>
  </div>
  <p class="hint">Click a folder to open it · <span aria-hidden="true">↗</span> opens it on GitHub${
    data.groups.length ? ` · ${data.groups.map((g) => `${g.swatch} ${escapeHtml(g.name)}`).join(" · ")}` : ""
  }</p>
</header>
<main id="wrap"><svg id="map" role="tree" aria-label="Folder tree"></svg></main>
<script type="application/json" id="data">${json}</script>
<script>
${PAGE_SCRIPT}
</script>
</body>
</html>
`;
}

// Only what the page needs; counts are dropped (not shown anywhere).
function slim(node, link, isRoot = false) {
  const out = { n: node.name, p: node.path, k: node.kind === "dir" ? "d" : "f" };
  if (node.description) out.d = node.description;
  if (node.group !== undefined) out.g = node.group;
  if (link) out.u = webUrl(link, node, isRoot);
  if (node.kind === "dir") out.c = node.children.map((c) => slim(c, link));
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PAGE_CSS = String.raw`
:root{--bg:#ffffff;--fg:#1f2328;--muted:#59636e;--node:#f6f8fa;--border:#d1d9e0;--edge:#c1c8d0;
  --accent:#0969da;--hit:#fff8c5;--hitstroke:#bf8700;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--node:#151b23;
  --border:#3d444d;--edge:#3d444d;--accent:#4493f8;--hit:#3b2e00;--hitstroke:#d29922}}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  display:flex;flex-direction:column}
header{padding:12px 16px;border-bottom:1px solid var(--border)}
h1{font-size:18px;margin:0 0 8px}
h1 span{font-weight:400;color:var(--muted)}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
input,button{font:inherit;color:var(--fg);background:var(--node);border:1px solid var(--border);border-radius:6px;padding:5px 10px}
input{flex:1 1 220px;max-width:360px}
button{cursor:pointer}
button:hover{border-color:var(--muted)}
input:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
#hits{color:var(--muted);min-width:80px}
.hint{margin:8px 0 0;color:var(--muted);font-size:13px}
main{flex:1;overflow:auto;padding:16px}
svg{display:block}
.edge{fill:none;stroke:var(--edge);stroke-width:1.5}
.node{cursor:default}
.node.dir{cursor:pointer}
.node rect{fill:var(--gfill,var(--node));stroke:var(--gstroke,var(--border));stroke-width:1}
.node.dir rect{stroke-width:1.5}
.node.closed.has rect{stroke-dasharray:5 3}
.node:focus{outline:none}
.node:focus-visible rect{stroke:var(--accent);stroke-width:2.5}
.node.hit rect{fill:var(--hit);stroke:var(--hitstroke);stroke-width:2}
.box{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 30px 0 10px;overflow:hidden;color:var(--gtext,var(--fg))}
.name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node.file .name{font-weight:400}
.node.file.described .name{font-weight:600}
.caret{display:inline-block;width:1em;color:var(--muted)}
.desc{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node.g .desc{color:inherit;opacity:.8}
.gh{position:absolute;right:6px;top:50%;transform:translateY(-50%);text-decoration:none;color:var(--muted);
  padding:2px 5px;border-radius:4px}
.gh:hover{color:var(--accent);background:var(--bg)}
.inner{position:relative;height:100%}
`;

// Client script. Layout: x by depth; y by the order of visible leaves, a
// parent centred on its first and last visible child (a tidy left-to-right
// tree without a layout library). Re-laid out on every open/close.
const PAGE_SCRIPT = String.raw`
(() => {
  const DATA = JSON.parse(document.getElementById("data").textContent);
  const NODE_W = 250, NODE_H = 46, COL = 300, ROW = 58, PAD = 4;
  const svg = document.getElementById("map");
  const NS = "http://www.w3.org/2000/svg";
  const all = [];
  let seq = 0;
  (function index(n, parent, depth) {
    n.id = seq++; n.parent = parent; n.depth = depth; n.open = depth === 0;
    n.hay = (n.p + " " + (n.d || "")).toLowerCase();
    all.push(n);
    (n.c || []).forEach((c) => index(c, n, depth + 1));
  })(DATA.tree, null, 0);

  let query = "";
  const isHit = (n) => query && n.hay.includes(query);

  function layout() {
    const visible = [];
    let row = 0;
    (function place(n) {
      visible.push(n);
      n.x = n.depth * COL + PAD;
      let kids = n.k === "d" && n.open ? n.c : [];
      // While searching, show only matches and the folders leading to them;
      // a matching folder, once opened, shows all of its contents.
      if (query && !isHit(n)) kids = kids.filter((c) => c.onPath || isHit(c));
      if (kids.length) {
        kids.forEach(place);
        n.y = (kids[0].y + kids[kids.length - 1].y) / 2;
      } else {
        n.y = row++ * ROW + PAD;
      }
    })(DATA.tree);
    return { visible, rows: row };
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function render(focusId) {
    const { visible, rows } = layout();
    const maxDepth = Math.max(...visible.map((n) => n.depth));
    svg.setAttribute("width", maxDepth * COL + NODE_W + PAD * 2);
    svg.setAttribute("height", Math.max(rows, 1) * ROW + PAD * 2);
    svg.replaceChildren();
    const edges = el("g", {}, svg);
    for (const n of visible) {
      if (!n.parent) continue;
      const x1 = n.parent.x + NODE_W, y1 = n.parent.y + NODE_H / 2;
      const x2 = n.x, y2 = n.y + NODE_H / 2, mx = (x1 + x2) / 2;
      el("path", { class: "edge",
        d: "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2 }, edges);
    }
    for (const n of visible) drawNode(n);
    if (focusId !== undefined) {
      const f = svg.querySelector('[data-id="' + focusId + '"]');
      if (f) f.focus({ preventScroll: false });
    }
  }

  function drawNode(n) {
    const hasKids = n.k === "d" && n.c.length > 0;
    const cls = ["node", n.k === "d" ? "dir" : "file"];
    if (hasKids) cls.push("has");
    if (n.k === "d" && !n.open) cls.push("closed");
    if (n.d) cls.push("described");
    if (n.g !== undefined) cls.push("g", "g" + n.g);
    if (isHit(n)) cls.push("hit");
    const g = el("g", { class: cls.join(" "), transform: "translate(" + n.x + "," + n.y + ")",
      "data-id": n.id, role: "treeitem", "aria-level": n.depth + 1 }, svg);
    if (hasKids) { g.setAttribute("tabindex", "0"); g.setAttribute("aria-expanded", String(n.open)); }
    el("rect", { width: NODE_W, height: NODE_H, rx: 8 }, g);
    const fo = el("foreignObject", { width: NODE_W, height: NODE_H }, g);
    const inner = document.createElement("div");
    inner.className = "inner";
    const box = document.createElement("div");
    box.className = "box";
    const name = document.createElement("div");
    name.className = "name";
    if (hasKids) {
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = n.open ? "▾" : "▸";
      name.appendChild(caret);
    }
    name.appendChild(document.createTextNode(n.n + (n.k === "d" && n.depth > 0 ? "/" : "")));
    box.appendChild(name);
    if (n.d) {
      const d = document.createElement("div");
      d.className = "desc";
      d.textContent = n.d;
      box.appendChild(d);
    }
    inner.appendChild(box);
    if (n.u) {
      const a = document.createElement("a");
      a.className = "gh"; a.href = n.u; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "↗"; a.title = "Open on GitHub"; a.setAttribute("aria-label", "Open " + (n.p || n.n) + " on GitHub");
      a.addEventListener("click", (e) => e.stopPropagation());
      inner.appendChild(a);
    }
    fo.appendChild(inner);
    const tip = el("title", {}, g);
    tip.textContent = (n.p || n.n) + (n.d ? " — " + n.d : "");
    if (hasKids) {
      const toggle = () => { n.open = !n.open; render(n.id); };
      g.addEventListener("click", toggle);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
    }
  }

  let saved = null; // open/closed state from before the search started

  function search(q) {
    const next = q.trim().toLowerCase();
    if (next && !query) saved = all.map((n) => n.open);
    if (!next && saved) { all.forEach((n, i) => (n.open = saved[i])); saved = null; }
    query = next;
    all.forEach((n) => (n.onPath = false));
    let hits = 0;
    if (query) {
      for (const n of all) {
        if (!isHit(n)) continue;
        hits++;
        for (let a = n.parent; a; a = a.parent) { a.open = true; a.onPath = true; }
      }
    }
    document.getElementById("hits").textContent = query ? hits + (hits === 1 ? " match" : " matches") : "";
    render();
    const first = svg.querySelector(".node.hit");
    if (first) first.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  document.getElementById("q").addEventListener("input", (e) => search(e.target.value));
  document.getElementById("top").addEventListener("click", () => {
    all.forEach((n) => (n.open = n.depth === 0)); render();
  });
  document.getElementById("all").addEventListener("click", () => {
    all.forEach((n) => (n.open = true)); render();
  });
  render();
})();
`;
