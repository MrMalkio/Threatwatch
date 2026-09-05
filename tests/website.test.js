import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const websiteRoot = path.resolve("website");
const htmlFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(candidate);
    else if (entry.name.endsWith(".html")) htmlFiles.push(candidate);
  }
}
walk(websiteRoot);

function source(relativePath) {
  return fs.readFileSync(path.join(websiteRoot, relativePath), "utf8");
}

test("public website includes required product, help, safety, changelog, and legal pages", () => {
  const required = [
    "index.html",
    "help/index.html",
    "help/getting-started.html",
    "help/modes.html",
    "help/downloads.html",
    "help/false-positives.html",
    "faq/index.html",
    "safety/index.html",
    "changelog/index.html",
    "legal/privacy.html",
    "legal/terms.html",
    "legal/acceptable-use.html",
    "assets/site.css",
    "assets/site.js",
    "sitemap.xml",
    "robots.txt"
  ];
  for (const file of required) assert.equal(fs.existsSync(path.join(websiteRoot, file)), true, file);
});

test("static HTML relative links resolve inside the website", () => {
  const linkPattern = /(?:href|src)="([^"]+)"/g;
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(linkPattern)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|#|data:)/i.test(target)) continue;
      const clean = target.split(/[?#]/, 1)[0];
      if (!clean) continue;
      const resolved = path.resolve(path.dirname(file), clean);
      assert.equal(fs.existsSync(resolved), true, `${path.relative(websiteRoot, file)} -> ${target}`);
    }
  }
});

test("website has no analytics, remote scripts, pixels, or external font imports", () => {
  const html = htmlFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const css = source("assets/site.css");
  assert.doesNotMatch(html, /google-analytics|googletagmanager|segment\.com|plausible|mixpanel|amplitude/i);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
  assert.doesNotMatch(html, /<img[^>]+src="https?:/i);
  assert.doesNotMatch(css, /@import\s+url\(https?:/i);
});

test("privacy policy matches current local-first product posture and Chrome Limited Use", () => {
  const privacy = source("legal/privacy.html");
  assert.match(privacy, /no Threatwatch telemetry backend/i);
  assert.match(privacy, /does not sell or share browsing data/i);
  assert.match(privacy, /Chrome Web Store User Data Policy/i);
  assert.match(privacy, /Limited Use/i);
  assert.match(privacy, /Future community features/i);
});

test("terms contain security disclaimer, third-party risk allocation, liability cap, and non-waivable-rights savings language", () => {
  const terms = source("legal/terms.html");
  assert.match(terms, /AS IS/i);
  assert.match(terms, /Third-party sites and content/i);
  assert.match(terms, /No security guarantee/i);
  assert.match(terms, /USD \$25/i);
  assert.match(terms, /cannot legally be excluded/i);
  assert.match(terms, /Rights that applicable law says cannot be waived/i);
});

test("changelog records the four extension milestones and website launch", () => {
  const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
  for (const marker of ["0.1.0", "0.2.0", "0.3.0", "0.4.0", "Public website"]) {
    assert.match(changelog, new RegExp(marker.replaceAll(".", "\\.")));
  }
});
