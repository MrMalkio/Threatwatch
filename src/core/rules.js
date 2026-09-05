import {
  DANGEROUS_MIME_PATTERNS,
  FORCED_DOWNLOAD_MIME_PATTERNS,
  LEGACY_RULE_ID_MAX,
  LEGACY_RULE_ID_MIN,
  PROTECTED_SCRIPT_PREFIX,
  RULE_ID_MAX,
  RULE_ID_MIN
} from "./constants.js";
import { uniqueDomains } from "./domain.js";
import { getEffectivePolicy } from "./policy.js";
import { assertProfileIntegrity } from "./profiles.js";
import {
  buildRiskyContentDispositionPatterns,
  buildRiskyDownloadRegex
} from "./risk.js";

const DOWNLOAD_RESOURCE_TYPES = Object.freeze([
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "object",
  "other"
]);

export function isThreatwatchRuleId(ruleId) {
  return (
    (ruleId >= RULE_ID_MIN && ruleId <= RULE_ID_MAX) ||
    (ruleId >= LEGACY_RULE_ID_MIN && ruleId <= LEGACY_RULE_ID_MAX)
  );
}

function addProtectedContextRulePair(rules, nextRuleId, profile, priority, condition) {
  rules.push({
    id: nextRuleId++,
    priority,
    action: { type: "block" },
    condition: {
      ...condition,
      initiatorDomains: [profile.domain]
    }
  });

  rules.push({
    id: nextRuleId++,
    priority: priority - 1,
    action: { type: "block" },
    condition: {
      ...condition,
      topDomains: [profile.domain]
    }
  });

  return nextRuleId;
}

function downloadResponseHeaders() {
  return [
    {
      header: "content-disposition",
      values: buildRiskyContentDispositionPatterns()
    },
    {
      header: "content-type",
      values: [
        ...DANGEROUS_MIME_PATTERNS,
        ...FORCED_DOWNLOAD_MIME_PATTERNS
      ]
    }
  ];
}

export function buildDynamicRules(config) {
  assertProfileIntegrity(config);
  const rules = [];
  let nextRuleId = RULE_ID_MIN;

  for (const profile of config.profiles) {
    if (!profile.enabled) continue;
    const policy = getEffectivePolicy(profile);

    if (policy.blockExternalNavigation) {
      const excludedRequestDomains = uniqueDomains([
        profile.domain,
        ...(profile.allowedTopLevelDomains || [])
      ]);

      rules.push({
        id: nextRuleId++,
        priority: 20,
        action: { type: "block" },
        condition: {
          initiatorDomains: [profile.domain],
          excludedRequestDomains,
          resourceTypes: ["main_frame"]
        }
      });

      rules.push({
        id: nextRuleId++,
        priority: 19,
        action: { type: "block" },
        condition: {
          topDomains: [profile.domain],
          excludedRequestDomains,
          resourceTypes: ["main_frame"]
        }
      });
    }

    if (policy.blockDownloads) {
      nextRuleId = addProtectedContextRulePair(
        rules,
        nextRuleId,
        profile,
        40,
        {
          regexFilter: buildRiskyDownloadRegex(),
          isUrlFilterCaseSensitive: false,
          resourceTypes: DOWNLOAD_RESOURCE_TYPES
        }
      );

      nextRuleId = addProtectedContextRulePair(
        rules,
        nextRuleId,
        profile,
        38,
        {
          responseHeaders: downloadResponseHeaders(),
          resourceTypes: DOWNLOAD_RESOURCE_TYPES
        }
      );
    }
  }

  for (const domain of config.blockedDomains) {
    rules.push({
      id: nextRuleId++,
      priority: 50,
      action: { type: "block" },
      condition: {
        requestDomains: [domain],
        resourceTypes: [
          "main_frame",
          "sub_frame",
          "script",
          "xmlhttprequest",
          "media",
          "object",
          "other"
        ]
      }
    });
  }

  if (nextRuleId > RULE_ID_MAX + 1) {
    throw new Error("Threatwatch generated more dynamic rules than its reserved range allows.");
  }

  return rules;
}

function protectedMatches(domain) {
  return [
    `http://${domain}/*`,
    `https://${domain}/*`,
    `http://*.${domain}/*`,
    `https://*.${domain}/*`
  ];
}

export function buildRegisteredScripts(config) {
  assertProfileIntegrity(config);
  const scripts = [];

  for (const profile of config.profiles) {
    if (!profile.enabled) continue;

    const policy = getEffectivePolicy(profile);
    const matches = protectedMatches(profile.domain);

    if (policy.blockProtocols || policy.blockDownloads) {
      const javascriptFiles = [];
      const suffixes = [];

      if (policy.blockDownloads) {
        javascriptFiles.push("src/shared/download-policy-data.js");
        suffixes.push("download");
      }

      if (policy.blockProtocols) {
        javascriptFiles.push("src/page-guard.js");
        suffixes.push("protocol");
      }

      if (policy.blockDownloads) {
        javascriptFiles.push("src/download-guard.js");
      }

      scripts.push({
        id: `${PROTECTED_SCRIPT_PREFIX}${profile.id}-main-${suffixes.join("-")}`,
        matches,
        js: javascriptFiles,
        runAt: "document_start",
        allFrames: true,
        matchOriginAsFallback: true,
        world: "MAIN",
        persistAcrossSessions: true
      });
    }

    if (policy.blockClipboard) {
      scripts.push({
        id: `${PROTECTED_SCRIPT_PREFIX}${profile.id}-clipboard`,
        matches,
        js: ["src/clipboard-guard.js"],
        runAt: "document_start",
        allFrames: true,
        matchOriginAsFallback: true,
        world: "MAIN",
        persistAcrossSessions: true
      });
    }
  }

  const ids = scripts.map((script) => script.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate registered content-script IDs were generated.");
  }

  return scripts;
}
