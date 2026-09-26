// Composition: repo folder → annotated, compacted, grouped tree + warnings.
// This is the one entry point renderers build on.

import { basename, resolve } from "node:path";
import { loadConfig } from "./config.mjs";
import { matchesAny } from "./glob.mjs";
import { assignGroups } from "./groups.mjs";
import { listFiles } from "./listFiles.mjs";
import { annotate, buildTree, compact } from "./tree.mjs";

export function scan(rootDir, { config } = {}) {
  const root = resolve(rootDir);
  const cfg = config ?? loadConfig(root);
  const files = listFiles(root, (path) => !matchesAny(path, cfg.exclude));
  const tree = buildTree(files, basename(root));
  const unused = annotate(tree, cfg.describe);
  compact(tree);
  const groupWarnings = assignGroups(tree, cfg.groups);
  const warnings = [...unused.map((p) => `describe: no file or folder at "${p}"`), ...groupWarnings];
  return { tree, warnings, config: cfg };
}
