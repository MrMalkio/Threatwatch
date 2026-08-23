import test from "node:test";
import assert from "node:assert/strict";

import { findProfileForUrl, normalizeDomain, matchesDomain } from "../src/core/domain.js";
import { getEffectivePolicy } from "../src/core/policy.js";
import {
  createDefaultConfig,
  createProfile,
  normalizeConfig
} from "../src/core/profiles.js";
import { hasRiskyExtension } from "../src/core/risk.js";
import { buildDynamicRules, buildRegisteredScripts } from "../src/core/rules.js";
import { sanitizeEventUrl } from "../src/core/sanitizer.js";

test("mode policy keeps Strict-only defenses out of Normal", () => {
  const normal = getEffectivePolicy(createProfile("example.com", { mode: "normal" }));
  assert.equal(normal.logExternalNavigation, true);
  assert.equal(normal.blockExternalNavigation, false);
  assert.equal(normal.blockProtocols, false);
  assert.equal(normal.blockDownloads, false);
  assert.equal(normal.blockClipboard, false);
  assert.equal(normal.scanClickFix, false);
  assert.equal(normal.scanOverlays, false);

  const strict = getEffectivePolicy(createProfile("example.com", { mode: "strict" }));
  assert.equal(strict.blockExternalNavigation, true);
  assert.equal(strict.blockProtocols, true);
  assert.equal(strict.blockDownloads, true);
  assert.equal(strict.blockClipboard, true);
  assert.equal(strict.scanClickFix, true);
  assert.equal(strict.scanOverlays, true);

  const learn = getEffectivePolicy(createProfile("example.com", { mode: "learn" }));
  assert.equal(learn.recordDecisionCandidate, true);
});

test("event URL sanitization never falls back to caller input", () => {
  assert.equal(
    sanitizeEventUrl("https://user:pass@example.com/path?q=secret#token"),
    "https://example.com/path"
  );
  assert.equal(sanitizeEventUrl("mailto:person@example.com?subject=secret"), "mailto:");
  assert.equal(sanitizeEventUrl("javascript:alert(document.cookie)"), "javascript:");
  assert.equal(sanitizeEventUrl("not a url?token=secret#fragment"), "[invalid-url]");
  assert.equal(sanitizeEventUrl("\u0000https://example.com/a?x=1#y"), "https://example.com/a");
});

test("domain normalization is canonical and subdomain matching is explicit", () => {
  assert.equal(normalizeDomain("HTTPS://WWW.Example.com./path"), "example.com");
  assert.equal(normalizeDomain("https://user:pass@example.com"), "");
  assert.equal(matchesDomain("cdn.example.com", "example.com"), true);
  assert.equal(matchesDomain("badexample.com", "example.com"), false);
});

test("duplicate profiles are merged without duplicate domains or IDs", () => {
  const normalized = normalizeConfig({
    profiles: [
      {
        id: "same-id",
        domain: "www.example.com",
        mode: "normal",
        allowedTopLevelDomains: ["example.com", "a.example"]
      },
      {
        id: "same-id",
        domain: "example.com",
        mode: "strict",
        allowedTopLevelDomains: ["example.com", "b.example"]
      },
      {
        id: "same-id",
        domain: "other.example",
        mode: "learn"
      }
    ]
  });

  assert.equal(normalized.profiles.length, 2);
  assert.equal(new Set(normalized.profiles.map((profile) => profile.id)).size, 2);
  const example = normalized.profiles.find((profile) => profile.domain === "example.com");
  assert.equal(example.mode, "strict");
  assert.deepEqual(example.allowedTopLevelDomains, ["example.com"]);
});

test("disabled profiles remain manageable without becoming active", () => {
  const profile = createProfile("disabled.example", { enabled: false });
  const config = normalizeConfig({ profiles: [profile] });
  assert.equal(findProfileForUrl(config, "https://disabled.example/path"), null);
  assert.equal(
    findProfileForUrl(config, "https://disabled.example/path", { enabledOnly: false })?.domain,
    "disabled.example"
  );
});

test("registered script IDs remain unique after normalization", () => {
  const config = createDefaultConfig();
  const scripts = buildRegisteredScripts(config);
  const ids = scripts.map((script) => script.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith("tw-p-")));
});

test("Normal profiles do not receive external-navigation DNR rules", () => {
  const config = normalizeConfig({
    profiles: [
      createProfile("normal.example", { mode: "normal" }),
      createProfile("strict.example", { mode: "strict" })
    ],
    blockedDomains: []
  });
  const rules = buildDynamicRules(config);
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0].condition.initiatorDomains, ["strict.example"]);
});

test("risky extension matching ignores URL suffixes", () => {
  assert.equal(hasRiskyExtension("https://example.com/update.exe?token=x#y"), true);
  assert.equal(hasRiskyExtension("https://example.com/video.mp4"), false);
});
