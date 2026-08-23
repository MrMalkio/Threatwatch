import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const markdownFiles = [
  "README.md",
  ...fs.readdirSync("docs").filter((name) => name.endsWith(".md")).map((name) => `docs/${name}`)
];

test("relative Markdown links resolve", () => {
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const markdownFile of markdownFiles) {
    const source = fs.readFileSync(markdownFile, "utf8");
    for (const match of source.matchAll(linkPattern)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const resolved = path.resolve(path.dirname(markdownFile), target.split("#", 1)[0]);
      assert.equal(fs.existsSync(resolved), true, `${markdownFile} links to missing ${target}`);
    }
  }
});

test("README repository map lists real files", () => {
  const required = [
    "docs/ARCHITECTURE.md",
    "docs/EVENT_SCHEMA.md",
    "docs/PRIVACY.md",
    "docs/SPEC.md",
    "docs/TESTING.md",
    "docs/THREAT_MODEL.md",
    "src/background/download-monitor.js",
    "src/background/events.js",
    "src/background/navigation.js",
    "src/background/protection.js",
    "src/background/storage.js",
    "src/core/constants.js",
    "src/core/domain.js",
    "src/core/policy.js",
    "src/core/profiles.js",
    "src/core/risk.js",
    "src/core/rules.js",
    "src/core/sanitizer.js"
  ];

  for (const file of required) {
    assert.equal(fs.existsSync(file), true, `${file} should exist`);
  }
});
