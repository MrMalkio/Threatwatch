import { PROTECTED_SCRIPT_PREFIX } from "../core/constants.js";
import { buildDynamicRules, buildRegisteredScripts, isThreatwatchRuleId } from "../core/rules.js";
import { readRuntimeState, writeRuntimeState } from "./storage.js";

function scriptDefinition(script) {
  return JSON.stringify({
    matches: [...(script.matches || [])].sort(),
    js: script.js || [],
    runAt: script.runAt,
    allFrames: script.allFrames,
    matchOriginAsFallback: script.matchOriginAsFallback,
    world: script.world,
    persistAcrossSessions: script.persistAcrossSessions
  });
}

async function ensureRegisteredScripts(config) {
  const desiredScripts = buildRegisteredScripts(config);
  const existingScripts = (await chrome.scripting.getRegisteredContentScripts())
    .filter((script) => script.id.startsWith(PROTECTED_SCRIPT_PREFIX));

  const desiredById = new Map(desiredScripts.map((script) => [script.id, script]));
  const existingById = new Map(existingScripts.map((script) => [script.id, script]));

  const missingScripts = desiredScripts.filter((script) => !existingById.has(script.id));
  const changedScripts = desiredScripts.filter((script) => {
    const existing = existingById.get(script.id);
    return existing && scriptDefinition(existing) !== scriptDefinition(script);
  });

  if (missingScripts.length) {
    await chrome.scripting.registerContentScripts(missingScripts);
  }

  if (changedScripts.length) {
    await chrome.scripting.updateContentScripts(changedScripts);
  }

  const verifiedScripts = (await chrome.scripting.getRegisteredContentScripts())
    .filter((script) => script.id.startsWith(PROTECTED_SCRIPT_PREFIX));
  const verifiedById = new Map(verifiedScripts.map((script) => [script.id, script]));

  for (const desired of desiredScripts) {
    const actual = verifiedById.get(desired.id);
    if (!actual || scriptDefinition(actual) !== scriptDefinition(desired)) {
      throw new Error(`Registered script verification failed for ${desired.id}.`);
    }
  }

  const staleIds = existingScripts
    .map((script) => script.id)
    .filter((id) => !desiredById.has(id));

  return async () => {
    if (staleIds.length) {
      await chrome.scripting.unregisterContentScripts({ ids: staleIds });
    }
  };
}

async function syncDynamicRules(config) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules
    .map((rule) => rule.id)
    .filter(isThreatwatchRuleId);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: buildDynamicRules(config)
  });
}

function desiredContentSettings(config) {
  const entries = [];

  for (const profile of config.profiles.filter((candidate) => candidate.enabled)) {
    for (const scheme of ["http", "https"]) {
      const primaryPattern = `${scheme}://[*.]${profile.domain}/*`;
      if (profile.blockNotifications !== false) entries.push({ type: "notifications", primaryPattern });
      if (profile.blockPopups !== false) entries.push({ type: "popups", primaryPattern });
      if (profile.blockAutomaticDownloads !== false) entries.push({ type: "automaticDownloads", primaryPattern });
    }
  }

  return entries;
}

function contentSettingKey(entry) {
  return `${entry.type}|${entry.primaryPattern}`;
}

async function applyContentSettingEntries(entries) {
  for (const entry of entries) {
    await chrome.contentSettings[entry.type].set({
      primaryPattern: entry.primaryPattern,
      setting: "block",
      scope: "regular"
    });
  }
}

async function clearManagedContentSettings() {
  await Promise.all([
    chrome.contentSettings.notifications.clear({ scope: "regular" }),
    chrome.contentSettings.popups.clear({ scope: "regular" }),
    chrome.contentSettings.automaticDownloads.clear({ scope: "regular" })
  ]);
}

async function syncContentSettings(previousConfig, nextConfig, options = {}) {
  const previousEntries = previousConfig ? desiredContentSettings(previousConfig) : [];
  const nextEntries = desiredContentSettings(nextConfig);

  if (options.startup) {
    await applyContentSettingEntries(nextEntries);
    return;
  }

  const previousKeys = new Set(previousEntries.map(contentSettingKey));
  const nextKeys = new Set(nextEntries.map(contentSettingKey));
  const onlyAddsProtection = [...previousKeys].every((key) => nextKeys.has(key));

  if (onlyAddsProtection) {
    const additions = nextEntries.filter((entry) => !previousKeys.has(contentSettingKey(entry)));
    await applyContentSettingEntries(additions);
    return;
  }

  try {
    await clearManagedContentSettings();
    await applyContentSettingEntries(nextEntries);
  } catch (error) {
    try {
      await clearManagedContentSettings();
      await applyContentSettingEntries(previousEntries);
    } catch {
      // The caller marks protection as degraded. DNR and page guards remain in place.
    }
    throw error;
  }
}

export async function prepareProtectionUpdate(previousConfig, nextConfig) {
  const cleanupStaleScripts = await ensureRegisteredScripts(nextConfig);
  let dynamicRulesChanged = false;

  try {
    await syncDynamicRules(nextConfig);
    dynamicRulesChanged = true;
    await syncContentSettings(previousConfig, nextConfig);
  } catch (error) {
    if (dynamicRulesChanged) {
      try {
        await syncDynamicRules(previousConfig);
      } catch {
        // Runtime health captures the rollback failure.
      }
    }
    throw error;
  }

  return cleanupStaleScripts;
}

export async function reconcileProtection(config) {
  const cleanupStaleScripts = await ensureRegisteredScripts(config);
  await syncDynamicRules(config);
  await syncContentSettings(null, config, { startup: true });
  await cleanupStaleScripts();
}

export async function markProtectionHealthy(configRevision) {
  const runtime = await readRuntimeState();
  runtime.protectionStatus = "healthy";
  runtime.configRevision = configRevision;
  runtime.appliedConfigRevision = configRevision;
  runtime.lastSyncAt = Date.now();
  runtime.lastErrorCode = "";
  return writeRuntimeState(runtime);
}

export async function markProtectionDegraded(configRevision, error) {
  const runtime = await readRuntimeState();
  runtime.protectionStatus = "degraded";
  runtime.configRevision = configRevision;
  runtime.lastSyncAt = Date.now();
  runtime.lastErrorCode = String(error?.message || error || "Protection synchronization failed.").slice(0, 120);
  return writeRuntimeState(runtime);
}
