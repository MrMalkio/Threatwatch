import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const manifest = JSON.parse(fs.readFileSync(path.resolve("manifest.json"), "utf8"));

test("manifest is MV3 and targets Chrome 145+", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(Number(manifest.minimum_chrome_version) >= 145);
});

test("manifest referenced files exist", () => {
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_page,
    ...manifest.content_scripts.flatMap(x => x.js || []),
    "src/page-guard.js",
    "src/clipboard-guard.js"
  ];
  for (const file of files) assert.equal(fs.existsSync(path.resolve(file)), true, `${file} should exist`);
});

test("extension exposes no externally connectable API", () => {
  assert.equal("externally_connectable" in manifest, false);
});
