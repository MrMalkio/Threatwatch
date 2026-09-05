import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const optionsHtml = fs.readFileSync("src/ui/options.html", "utf8");
const optionsJs = fs.readFileSync("src/ui/options.js", "utf8");
const popupHtml = fs.readFileSync("src/ui/popup.html", "utf8");
const popupJs = fs.readFileSync("src/ui/popup.js", "utf8");
const theme = fs.readFileSync("src/ui/theme.css", "utf8");

test("watchlist UI supports compact profile management", () => {
  for (const id of [
    "profile-search",
    "profile-sort",
    "profile-filters",
    "profile-visible-count",
    "profile-total-count",
    "expand-visible",
    "collapse-all",
    "profiles"
  ]) {
    assert.match(optionsHtml, new RegExp(`id="${id}"`));
  }

  assert.match(optionsJs, /function filteredProfiles/);
  assert.match(optionsJs, /viewState\.expanded/);
  assert.match(optionsJs, /data-profile-filter/);
  assert.match(optionsJs, /activity/);
  assert.match(optionsJs, /events/);
});

test("profile list and event table have bounded scrolling", () => {
  assert.match(theme, /\.profile-list\s*\{[\s\S]*?max-height:\s*640px/);
  assert.match(theme, /\.profile-list\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(theme, /\.event-table-wrap\s*\{[\s\S]*?max-height:\s*430px/);
  assert.match(theme, /\.event-table-wrap\s*\{[\s\S]*?overflow:\s*auto/);
});

test("Threatwatch theme carries the watch and playback concept across both pages", () => {
  const tagline = /Watching for threats while you watch\./;
  assert.match(optionsHtml, tagline);
  assert.match(popupHtml, tagline);
  assert.match(optionsHtml, /class="brand-mark brand-mark-large"/);
  assert.match(popupHtml, /class="brand-mark"/);
  assert.match(theme, /\.brand-play/);
  assert.match(theme, /\.brand-sweep/);
  assert.match(theme, /\.site-avatar/);
  assert.match(theme, /\.popup-event-list/);
});

test("the interface includes accessible controls and reduced-motion support", () => {
  assert.match(optionsHtml, /aria-label="Filter site profiles"/);
  assert.match(optionsJs, /aria-expanded/);
  assert.match(optionsJs, /aria-controls/);
  assert.match(optionsJs, /event\.key === "\/"/);
  assert.match(theme, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(theme, /\.sr-only/);
});

test("popup keeps profile state, watch mode, events, and settings access", () => {
  for (const id of [
    "health",
    "domain",
    "unprotected",
    "protected",
    "new-mode",
    "protect",
    "enabled",
    "mode",
    "event-count",
    "events",
    "options",
    "retry"
  ]) {
    assert.match(popupHtml, new RegExp(`id="${id}"`));
  }

  assert.match(popupJs, /profile\.update/);
  assert.match(popupJs, /profile\.create/);
  assert.match(popupJs, /openOptionsPage/);
  assert.match(popupJs, /Watch paused/);
});

test("UI loads no remote scripts, fonts, stylesheets, or images", () => {
  const combinedHtml = `${optionsHtml}\n${popupHtml}`;
  assert.doesNotMatch(combinedHtml, /https?:\/\//i);
  assert.doesNotMatch(combinedHtml, /<img\b/i);
  assert.doesNotMatch(theme, /url\s*\(/i);
});
