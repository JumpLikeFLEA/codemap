import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { defaultConfig, loadConfig, validateConfig } from "../src/config.mjs";

test("missing config gives empty defaults", () => {
  const dir = mkdtempSync(join(tmpdir(), "codemap-cfg-"));
  try {
    assert.deepEqual(loadConfig(dir), { exclude: [], describe: {}, groups: [], sectionDepth: 2, links: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("valid config is normalised", () => {
  const cfg = validateConfig({
    exclude: ["*.png"],
    describe: { "./lib/items/": "  Item types  ", "app\\api": "Routes" },
  });
  assert.deepEqual(cfg, {
    ...defaultConfig(),
    exclude: ["*.png"],
    describe: { "lib/items": "Item types", "app/api": "Routes" },
  });
});

test("unknown keys are rejected, not ignored", () => {
  assert.throws(() => validateConfig({ exlude: [] }), /unknown key "exlude"/);
});

test("wrong types are rejected", () => {
  assert.throws(() => validateConfig([]), /must be a JSON object/);
  assert.throws(() => validateConfig({ exclude: "*.png" }), /"exclude" must be an array/);
  assert.throws(() => validateConfig({ exclude: [""] }), /"exclude" must be an array/);
  assert.throws(() => validateConfig({ describe: { a: 1 } }), /"describe.a" must be a string/);
});

test("invalid JSON names the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "codemap-cfg-"));
  try {
    writeFileSync(join(dir, "codemap.config.json"), "{ nope");
    assert.throws(() => loadConfig(dir), /codemap\.config\.json: invalid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("groups, sectionDepth and links are validated", () => {
  const cfg = validateConfig({ groups: [{ name: " A ", paths: ["x"] }], sectionDepth: 3, links: false });
  assert.deepEqual(cfg.groups, [{ name: "A", paths: ["x"] }]);
  assert.equal(cfg.sectionDepth, 3);
  assert.equal(cfg.links, false);

  const g = (n) => Array.from({ length: n }, (_, i) => ({ name: `g${i}`, paths: ["x"] }));
  assert.throws(() => validateConfig({ groups: g(5) }), /at most 4/);
  assert.throws(() => validateConfig({ groups: [{ name: "A", paths: [] }] }), /paths" must be a non-empty array/);
  assert.throws(() => validateConfig({ groups: [{ name: "A", paths: ["x"], colour: "red" }] }), /unknown key "colour"/);
  assert.throws(() => validateConfig({ sectionDepth: 0 }), /from 1 to 5/);
  assert.throws(() => validateConfig({ sectionDepth: 2.5 }), /from 1 to 5/);
  assert.throws(() => validateConfig({ links: "yes" }), /true or false/);
});
