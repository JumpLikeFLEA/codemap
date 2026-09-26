// Works out the GitHub web URL for links: https://github.com/<owner>/<repo>
// plus the branch to link to. Returns null when the repo has no GitHub
// origin — the map is then drawn without links rather than with broken ones.
//
// Links must be absolute: GitHub renders Mermaid inside a sandboxed iframe
// on another domain, where relative links do not resolve.

import { execFileSync } from "node:child_process";

export function parseGitHubRemote(url) {
  const m = url.trim().match(/^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

export function gitHubLinkBase(root, branchOverride) {
  const base = parseGitHubRemote(git(root, ["remote", "get-url", "origin"]) ?? "");
  if (!base) return null;
  // The remote's default branch, so links survive feature branches; fall
  // back to the current branch when origin/HEAD was never set locally.
  const branch =
    branchOverride ??
    git(root, ["rev-parse", "--abbrev-ref", "origin/HEAD"])?.replace(/^origin\//, "") ??
    git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch || branch === "HEAD") return null;
  return { base, branch };
}

function git(cwd, args) {
  try {
    const out = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out || null;
  } catch {
    return null;
  }
}

