// Loads and validates codemap.config.json from the repo root.
// The config is optional: a repo with no config gets a plain tree.
//
// Shape:
// {
//   "exclude": ["**/*.png", "ds-bundle"],          // globs, see glob.mjs
//   "describe": { "lib/items": "Item-type registry" } // exact dir or file path → one line
// }
//
// Unknown keys are rejected rather than ignored, so a typo ("exlude") fails
// loudly instead of silently producing an unfiltered map.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "codemap.config.json";

const DEFAULTS = Object.freeze({ exclude: [], describe: {} });
const KNOWN_KEYS = new Set(["$schema", "exclude", "describe"]);

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

  const exclude = raw.exclude ?? [];
  if (!Array.isArray(exclude) || exclude.some((g) => typeof g !== "string" || !g.trim())) {
    fail(`"exclude" must be an array of non-empty strings`);
  }

  const describe = raw.describe ?? {};
  if (describe === null || typeof describe !== "object" || Array.isArray(describe)) {
    fail(`"describe" must be an object of path → string`);
  }
  const normDescribe = {};
  for (const [path, text] of Object.entries(describe)) {
    if (typeof text !== "string") fail(`"describe.${path}" must be a string`);
    normDescribe[normalizePath(path)] = text.trim();
  }

  return { exclude: [...exclude], describe: normDescribe };
}

export function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) return { ...DEFAULTS, describe: {} };
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${CONFIG_FILE}: invalid JSON (${err.message})`);
  }
  return validateConfig(raw);
}

function normalizePath(p) {
  return p.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}
