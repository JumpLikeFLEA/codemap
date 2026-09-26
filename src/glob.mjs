// Minimal glob matching for config patterns. No dependencies on purpose:
// Node's path.matchesGlob is still experimental on some 22.x releases, and
// pulling in minimatch for three operators is not worth a dependency.
//
// Supported syntax (paths are always POSIX-style, relative to the repo root):
//   **   any number of path segments, including zero
//   *    any characters within one segment (no "/")
//   ?    exactly one character within one segment
// A pattern with no "/" matches a segment name at any depth ("*.png" hits
// "public/a.png"). A pattern that matches a directory also matches everything
// under it ("docs" hides "docs/adr/0001.md").

const cache = new Map();

export function globToRegExp(pattern) {
  if (cache.has(pattern)) return cache.get(pattern);

  let p = pattern.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  // No slash → match at any depth.
  if (!p.includes("/")) p = `**/${p}`;

  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") {
        // "**/" → zero or more whole segments; a trailing "**" → anything.
        if (p[i + 2] === "/") {
          re += "(?:[^/]+/)*";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  // Also match anything below a matched directory.
  const compiled = new RegExp(`^${re}(?:/.*)?$`);
  cache.set(pattern, compiled);
  return compiled;
}

export function matchesGlob(path, pattern) {
  return globToRegExp(pattern).test(path);
}

export function matchesAny(path, patterns) {
  return patterns.some((p) => matchesGlob(path, p));
}
