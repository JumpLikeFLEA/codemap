// Loads and validates codemap.config.json from the repo root.
// The config is optional: a repo with no config gets a plain tree.
//
// Shape (every key optional):
// {
//   "exclude": ["**/*.png", "ds-bundle"],             // globs, see glob.mjs
//   "describe": { "lib/items": "Item-type registry" }, // exact path → one line;
//                                                      // a described FILE is drawn on the map
//   "groups": [                                        // colour-coded areas, max 4,
//     { "name": "Alliengll", "paths": ["app/(english)", "lib/alliengll"] }
//   ],                                                 // first matching group wins
//   "sectionDepth": 2,                                 // levels shown in each fold-out section
//   "links": true                                      // link nodes to the GitHub tree view
// }
//
// Unknown keys are rejected rather than ignored, so a typo ("exlude") fails
// loudly instead of silently producing an unfiltered map.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "codemap.config.json";
export const MAX_GROUPS = 4; // = palette size in mermaid.mjs

const KNOWN_KEYS = new Set(["$schema", "exclude", "describe", "groups", "sectionDepth", "links"]);

export function defaultConfig() {
  return { exclude: [], describe: {}, groups: [], sectionDepth: 2, links: true };
}

export function validateConfig(raw, source = CONFIG_FILE) {
  const fail = (msg) => {
    throw new Error(`${source}: ${msg}`);
  };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    fail("must be a JSON object");
  }
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) fail(`unknown key "${key}"`);
  }
  const cfg = defaultConfig();

  if (raw.exclude !== undefined) {
    if (!isStringArray(raw.exclude)) fail(`"exclude" must be an array of non-empty strings`);
    cfg.exclude = [...raw.exclude];
  }

  if (raw.describe !== undefined) {
    if (!isPlainObject(raw.describe)) fail(`"describe" must be an object of path → string`);
    for (const [path, text] of Object.entries(raw.describe)) {
      if (typeof text !== "string") fail(`"describe.${path}" must be a string`);
      cfg.describe[normalizePath(path)] = text.trim();
    }
  }

  if (raw.groups !== undefined) {
    if (!Array.isArray(raw.groups)) fail(`"groups" must be an array`);
    if (raw.groups.length > MAX_GROUPS) fail(`"groups" supports at most ${MAX_GROUPS} entries`);
    cfg.groups = raw.groups.map((g, i) => {
      if (!isPlainObject(g)) fail(`"groups[${i}]" must be an object`);
      if (typeof g.name !== "string" || !g.name.trim()) fail(`"groups[${i}].name" must be a non-empty string`);
      if (!isStringArray(g.paths) || g.paths.length === 0) {
        fail(`"groups[${i}].paths" must be a non-empty array of strings`);
      }
      const extra = Object.keys(g).filter((k) => k !== "name" && k !== "paths");
      if (extra.length) fail(`"groups[${i}]" has unknown key "${extra[0]}"`);
      return { name: g.name.trim(), paths: [...g.paths] };
    });
  }

  if (raw.sectionDepth !== undefined) {
    const d = raw.sectionDepth;
    if (!Number.isInteger(d) || d < 1 || d > 5) fail(`"sectionDepth" must be an integer from 1 to 5`);
    cfg.sectionDepth = d;
  }

  if (raw.links !== undefined) {
    if (typeof raw.links !== "boolean") fail(`"links" must be true or false`);
    cfg.links = raw.links;
  }

  return cfg;
}

export function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) return defaultConfig();
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${CONFIG_FILE}: invalid JSON (${err.message})`);
  }
  return validateConfig(raw);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((s) => typeof s === "string" && s.trim());
}

function normalizePath(p) {
  return p.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}
