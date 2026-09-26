import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesGlob } from "../src/glob.mjs";

test("pattern without slash matches a segment at any depth", () => {
  assert.ok(matchesGlob("a.png", "*.png"));
  assert.ok(matchesGlob("public/img/a.png", "*.png"));
  assert.ok(!matchesGlob("public/a.png.txt", "*.png"));
});

test("matching a folder also matches everything under it", () => {
  assert.ok(matchesGlob("docs/adr/0001.md", "docs"));
  assert.ok(matchesGlob("x/node_modules/y/z.js", "node_modules"));
  assert.ok(!matchesGlob("docsite/a.md", "docs"));
});

test("pattern with slash is anchored at the root", () => {
  assert.ok(matchesGlob("app/components/ui/button.tsx", "app/components/ui"));
  assert.ok(!matchesGlob("lib/app/components/ui/x.ts", "app/components/ui"));
});

test("* stays within one segment, ** crosses segments", () => {
  assert.ok(matchesGlob("lib/a.test.ts", "lib/*.test.ts"));
  assert.ok(!matchesGlob("lib/items/a.test.ts", "lib/*.test.ts"));
  assert.ok(matchesGlob("lib/items/a.test.ts", "lib/**/*.test.ts"));
  assert.ok(matchesGlob("lib/a.test.ts", "lib/**/*.test.ts"), "** matches zero segments");
});

test("? matches exactly one character; regex metacharacters are literal", () => {
  assert.ok(matchesGlob("migrations/001.sql", "migrations/00?.sql"));
  assert.ok(!matchesGlob("migrations/0001.sql", "migrations/00?.sql"));
  assert.ok(matchesGlob("app/(english)/page.tsx", "app/(english)"));
  assert.ok(!matchesGlob("app/english/page.tsx", "app/(english)"));
});

test("leading ./, trailing / and backslashes are normalised", () => {
  assert.ok(matchesGlob("docs/a.md", "./docs/"));
  assert.ok(matchesGlob("app/components/ui/x.tsx", "app\\components\\ui"));
});
