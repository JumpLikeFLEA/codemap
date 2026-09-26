import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGitHubRemote } from "../src/gitRemote.mjs";

test("parses the common GitHub remote forms", () => {
  const want = "https://github.com/JumpLikeFLEA/colloquiz";
  for (const url of [
    "https://github.com/JumpLikeFLEA/colloquiz.git",
    "https://github.com/JumpLikeFLEA/colloquiz",
    "https://github.com/JumpLikeFLEA/colloquiz/",
    "https://token@github.com/JumpLikeFLEA/colloquiz.git",
    "git@github.com:JumpLikeFLEA/colloquiz.git",
    "ssh://git@github.com/JumpLikeFLEA/colloquiz.git",
    "  git@github.com:JumpLikeFLEA/colloquiz.git\n",
  ]) {
    assert.equal(parseGitHubRemote(url), want, url);
  }
});

test("keeps dots inside repo names", () => {
  assert.equal(parseGitHubRemote("git@github.com:a/my.repo.git"), "https://github.com/a/my.repo");
});

test("non-GitHub remotes give null", () => {
  assert.equal(parseGitHubRemote("https://gitlab.com/a/b.git"), null);
  assert.equal(parseGitHubRemote(""), null);
});
