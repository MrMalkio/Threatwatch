import test from "node:test";
import assert from "node:assert/strict";

import { findProfileForUrl, normalizeDomain, matchesDomain } from "../src/core/domain.js";
import { getEffectivePolicy } from "../src/core/policy.js";
import {
  createDefaultConfig,
  createProfile,
  normalizeConfig
} from "../src/core/profiles.js";
import {
  buildRiskyContentDispositionPatterns,
  buildRiskyDownloadRegex,
  browserMarkedDownloadDangerous,
  classifyDownloadCandidate,
  hasRiskyExtension,
  isDangerousMime,
  isForcedDownloadMime
} from "../src/core/risk.js";
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

test("registered script IDs remain unique and install the early download guard", () => {
  const config = createDefaultConfig();
  const scripts = buildRegisteredScripts(config);
  const ids = scripts.map((script) => script.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith("tw-p-")));

  const downloadScripts = scripts.filter((script) => script.js.includes("src/download-guard.js"));
  assert.equal(downloadScripts.length, config.profiles.length);
  assert.ok(downloadScripts.every((script) => (
    script.js[0] === "src/shared/download-policy-data.js" &&
    script.js.includes("src/page-guard.js")
  )));
});

test("Normal profiles receive neither external-navigation nor download DNR rules", () => {
  const config = normalizeConfig({
    profiles: [
      createProfile("normal.example", { mode: "normal" }),
      createProfile("strict.example", { mode: "strict" })
    ],
    blockedDomains: []
  });
  const rules = buildDynamicRules(config);

  assert.equal(rules.length, 6);
  assert.ok(rules.every((rule) => (
    rule.condition.initiatorDomains?.[0] === "strict.example" ||
    rule.condition.topDomains?.[0] === "strict.example"
  )));
});

test("risky extension matching handles query strings and encoded suffixes", () => {
  assert.equal(hasRiskyExtension("https://example.com/update.exe?token=x#y"), true);
  assert.equal(hasRiskyExtension("https://example.com/update%2EEXE?token=x"), true);
  assert.equal(hasRiskyExtension("C:\\Downloads\\payload.PS1"), true);
  assert.equal(hasRiskyExtension("https://example.com/video.mp4"), false);
});

test("pre-request download regex catches executable, script, archive, and encoded paths", () => {
  const regex = new RegExp(buildRiskyDownloadRegex(), "i");
  assert.equal(regex.test("https://bad.example/file.exe"), true);
  assert.equal(regex.test("https://bad.example/file%2Eps1?x=1"), true);
  assert.equal(regex.test("https://bad.example/file%252Eps1?x=1"), true);
  assert.equal(regex.test("https://bad.example/archive.zip#x"), true);
  assert.equal(regex.test("https://bad.example/video.mp4"), false);
});

test("response-header rules cover attachment filenames and dangerous MIME types", () => {
  const config = normalizeConfig({
    profiles: [createProfile("strict.example", { mode: "strict" })]
  });
  const rules = buildDynamicRules(config);
  const responseRules = rules.filter((rule) => Array.isArray(rule.condition.responseHeaders));

  assert.equal(responseRules.length, 2);
  const headers = responseRules[0].condition.responseHeaders;
  const disposition = headers.find((header) => header.header === "content-disposition");
  const contentType = headers.find((header) => header.header === "content-type");

  assert.ok(disposition.values.includes("*attachment*"));
  assert.ok(disposition.values.includes("*filename*.exe*"));
  assert.ok(contentType.values.includes("application/x-msdownload*"));
  assert.ok(contentType.values.includes("application/force-download*"));
});

test("download candidate classification treats browser, MIME, and filename signals as risky", () => {
  assert.equal(classifyDownloadCandidate({ filename: "payload.exe" }).risky, true);
  assert.equal(classifyDownloadCandidate({ mime: "application/x-msdownload" }).risky, true);
  assert.equal(classifyDownloadCandidate({ mime: "application/force-download" }).risky, true);
  assert.equal(classifyDownloadCandidate({ danger: "uncommon" }).risky, true);
  assert.equal(classifyDownloadCandidate({ filename: "movie.mp4", mime: "video/mp4", danger: "safe" }).risky, false);

  assert.equal(isDangerousMime("application/x-msdownload; charset=binary"), true);
  assert.equal(isForcedDownloadMime("application/x-download"), true);
  assert.equal(browserMarkedDownloadDangerous("safe"), false);
  assert.equal(browserMarkedDownloadDangerous("content"), true);
});

test("content-disposition patterns include every risky extension", async () => {
  const { RISKY_EXTENSIONS } = await import("../src/core/constants.js");
  const patterns = buildRiskyContentDispositionPatterns();
  for (const extension of RISKY_EXTENSIONS) {
    assert.ok(patterns.includes(`*filename*${extension}*`), `missing ${extension}`);
  }
});
