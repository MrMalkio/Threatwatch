import {
  LEGACY_RULE_ID_MAX,
  LEGACY_RULE_ID_MIN,
  PROTECTED_SCRIPT_PREFIX,
  RULE_ID_MAX,
  RULE_ID_MIN
} from "./constants.js";
import { uniqueDomains } from "./domain.js";
import { getEffectivePolicy } from "./policy.js";
import { assertProfileIntegrity } from "./profiles.js";

export function isThreatwatchRuleId(ruleId) {
  return (
    (ruleId >= RULE_ID_MIN && ruleId <= RULE_ID_MAX) ||
    (ruleId >= LEGACY_RULE_ID_MIN && ruleId <= LEGACY_RULE_ID_MAX)
  );
}

export function buildDynamicRules(config) {
  assertProfileIntegrity(config);
  const rules = [];
  let nextRuleId = RULE_ID_MIN;

  for (const profile of config.profiles) {
    const policy = getEffectivePolicy(profile);
    if (!profile.enabled || !policy.blockExternalNavigation) continue;

    const excludedRequestDomains = uniqueDomains([
      profile.domain,
      ...(profile.allowedTopLevelDomains || [])
    ]);

    rules.push({
      id: nextRuleId++,
      priority: 10,
      action: { type: "block" },
      condition: {
        initiatorDomains: [profile.domain],
        excludedRequestDomains,
        resourceTypes: ["main_frame"]
      }
    });

    rules.push({
      id: nextRuleId++,
      priority: 9,
      action: { type: "block" },
      condition: {
        topDomains: [profile.domain],
        excludedRequestDomains,
        resourceTypes: ["main_frame"]
      }
    });
  }

  for (const domain of config.blockedDomains) {
    rules.push({
      id: nextRuleId++,
      priority: 20,
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

export function buildRegisteredScripts(config) {
  assertProfileIntegrity(config);
  const scripts = [];

  for (const profile of config.profiles) {
    const policy = getEffectivePolicy(profile);
    if (!profile.enabled || !policy.blockProtocols) continue;

    const matches = [
      `http://${profile.domain}/*`,
      `https://${profile.domain}/*`,
      `http://*.${profile.domain}/*`,
      `https://*.${profile.domain}/*`
    ];

    scripts.push({
      id: `${PROTECTED_SCRIPT_PREFIX}${profile.id}-page`,
      matches,
      js: ["src/page-guard.js"],
      runAt: "document_start",
      allFrames: true,
      matchOriginAsFallback: true,
      world: "MAIN",
      persistAcrossSessions: true
    });

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
