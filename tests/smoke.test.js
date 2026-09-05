import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

test("manifest is MV3 and targets Chrome 145 or newer", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(Number(manifest.minimum_chrome_version) >= 145);
  assert.equal(manifest.version, "0.3.0");
});

test("manifest and registered-guard source files exist", () => {
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_page,
    ...manifest.content_scripts.flatMap((script) => script.js || []),
    "src/page-guard.js",
    "src/clipboard-guard.js",
    "src/download-guard.js",
    "src/shared/download-policy-data.js"
  ];

  for (const file of files) {
    assert.equal(fs.existsSync(path.resolve(file)), true, `${file} should exist`);
  }
});

test("extension exposes no externally connectable API", () => {
  assert.equal("externally_connectable" in manifest, false);
});

test("state writes use named commands rather than whole-state replacement", () => {
  const background = fs.readFileSync("src/background.js", "utf8");
  const options = fs.readFileSync("src/ui/options.js", "utf8");
  assert.doesNotMatch(background, /save-state/);
  assert.doesNotMatch(options, /save-state/);
  assert.doesNotMatch(options, /function save\s*\(/);
});

test("config, events, and runtime use separate keys", () => {
  const constants = fs.readFileSync("src/core/constants.js", "utf8");
  assert.match(constants, /threatwatch\.config\.v2/);
  assert.match(constants, /threatwatch\.events\.v1/);
  assert.match(constants, /threatwatch\.runtime\.v1/);
});

test("download monitor uses both pre-finalization and on-created containment", () => {
  const monitor = fs.readFileSync("src/background/download-monitor.js", "utf8");
  assert.match(monitor, /downloads\.onCreated/);
  assert.match(monitor, /downloads\.onDeterminingFilename/);
  assert.match(monitor, /downloads\.pause/);
  assert.match(monitor, /downloads\.cancel/);
  assert.match(monitor, /containAtFilenameStage/);
  assert.match(monitor, /retry with fresh context/);
});
