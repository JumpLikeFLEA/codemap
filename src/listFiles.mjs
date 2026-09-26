// The only module that touches the filesystem and git.
//
// Why git and not a directory walk: `git ls-files` already knows what the
// project considers "its" code — .gitignore'd build output, node_modules,
// .env files and caches never appear — and it behaves the same in every
// language. Untracked-but-not-ignored files are included (--others
// --exclude-standard) so a new file shows up before its first commit.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function listGitFiles(root) {
  let out;
  try {
    out = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (err) {
    const stderr = err.stderr?.toString().trim();
    throw new Error(`git ls-files failed in ${root}${stderr ? `: ${stderr}` : ""}`);
  }
  // -z: NUL-separated, paths unquoted, always "/" separators (also on Windows).
  return [...new Set(out.split("\0").filter(Boolean))].sort();
}

// Line count for a text file; null for a binary file (a NUL byte in the
// first 8 KB, the same heuristic git uses); undefined when git lists the file
// but it is gone from disk (deleted, deletion not yet staged).
export function countLines(absPath) {
  let buf;
  try {
    buf = readFileSync(absPath);
  } catch {
    return undefined;
  }
  if (buf.subarray(0, 8192).includes(0)) return null;
  if (buf.length === 0) return 0;
  let n = 0;
  for (const byte of buf) if (byte === 10) n++;
  return buf[buf.length - 1] === 10 ? n : n + 1;
}

// → [{ path, lines }]. `filter(path)` returns false to drop a file before it
// is read, so excluded binaries and vendored trees cost nothing.
export function listFiles(root, filter = () => true) {
  return listGitFiles(root)
    .filter(filter)
    .map((path) => ({ path, lines: countLines(join(root, path)) }))
    .filter((f) => f.lines !== undefined);
}
