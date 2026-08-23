import {
  CONTENT_EVENT_TYPES,
  RISKY_EXTENSIONS
} from "./core/constants.js";
import {
  findProfileForUrl,
  normalizeDomain,
  uniqueDomains
} from "./core/domain.js";
import { getEffectivePolicy } from "./core/policy.js";
import {
  assertProfileIntegrity,
  assertUniqueProfileDomain,
  createProfile,
  getProfileById,
  normalizeConfig,
  PROFILE_SECURITY_FLAGS
} from "./core/profiles.js";
import { sanitizeEventType, sanitizeLabel } from "./core/sanitizer.js";
import { registerDownloadMonitor } from "./background/download-monitor.js";
import { appendEvent, clearEvents } from "./background/events.js";
import {
  bootstrapTabContexts,
  registerNavigationHandlers,
  rememberTabContext
} from "./background/navigation.js";
import {
  markProtectionDegraded,
  markProtectionHealthy,
  prepareProtectionUpdate,
  reconcileProtection
} from "./background/protection.js";
import {
  initializeStorage,
  readConfig,
  readEventStore,
  readRuntimeState,
  runConfigExclusive,
  writeConfig
} from "./background/storage.js";

let extensionInitialization;

async function reportProtectionFailure(configRevision, error) {
  try {
    await markProtectionDegraded(configRevision, error);
  } catch {
    // A storage failure must not replace the original protection error.
  }

  try {
    await appendEvent({
      type: "protection-error",
      action: "degraded",
      sourceLayer: "background"
    });
  } catch {
    // Event logging is secondary to retaining the active protection set.
  }
}

async function initializeExtension() {
  if (extensionInitialization) return extensionInitialization;

  extensionInitialization = (async () => {
    await initializeStorage();
    const config = await readConfig();

    try {
      await reconcileProtection(config);
      await markProtectionHealthy(config.revision);
    } catch (error) {
      await reportProtectionFailure(config.revision, error);
    }

    try {
      await bootstrapTabContexts(config);
    } catch {
      // Tab contexts are rebuilt by bridge initialization and later navigation.
    }

    return config;
  })();

  try {
    return await extensionInitialization;
  } catch (error) {
    extensionInitialization = undefined;
    throw error;
  }
}

async function mutateConfig(mutator) {
  await initializeExtension();

  return runConfigExclusive(async () => {
    const currentConfig = await readConfig();
    const draft = structuredClone(currentConfig);
    const mutated = await mutator(draft);
    const nextConfig = normalizeConfig(mutated || draft);
    nextConfig.revision = currentConfig.revision + 1;
    assertProfileIntegrity(nextConfig);

    let cleanupStaleScripts;
    try {
      cleanupStaleScripts = await prepareProtectionUpdate(currentConfig, nextConfig);
    } catch (error) {
      await reportProtectionFailure(currentConfig.revision, error);
      throw error;
    }

    try {
      await writeConfig(nextConfig);
    } catch (error) {
      try {
        const rollbackCleanup = await prepareProtectionUpdate(nextConfig, currentConfig);
        await rollbackCleanup();
      } catch {
        // Runtime health below records the failed rollback.
      }
      await reportProtectionFailure(currentConfig.revision, error);
      throw error;
    }

    try {
      await cleanupStaleScripts();
      await markProtectionHealthy(nextConfig.revision);
    } catch (error) {
      await reportProtectionFailure(nextConfig.revision, error);
    }

    return nextConfig;
  });
}

function requireProfile(config, profileId) {
  const profile = getProfileById(config, profileId);
  if (!profile) throw new Error("Profile not found.");
  return profile;
}

function contentEventAllowed(profile, type) {
  const policy = getEffectivePolicy(profile);
  const checks = {
    "popup-blocked": policy.blockProtocols,
    "protocol-blocked": policy.blockProtocols,
    "clipboard-blocked": policy.blockClipboard,
    "dangerous-download": policy.blockDownloads,
    "external-navigation": policy.logExternalNavigation,
    "clickfix-warning": policy.scanClickFix,
    "click-overlay": policy.scanOverlays
  };
  return checks[type] === true;
}

async function handleContentEvent(message, sender) {
  const sourceUrl = sender.tab?.url || sender.url || "";
  const config = await readConfig();
  const profile = findProfileForUrl(config, sourceUrl);
  if (!profile) return null;

  const type = sanitizeEventType(message.event?.type);
  if (!CONTENT_EVENT_TYPES.has(type) || !contentEventAllowed(profile, type)) return null;

  const policy = getEffectivePolicy(profile);
  let action = message.event?.action;
  if (type === "external-navigation") {
    action = policy.blockExternalNavigation ? "blocked" : "observed";
  }

  return appendEvent({
    type,
    action,
    profileId: profile.id,
    sourceUrl,
    targetUrl: message.event?.targetUrl || "",
    sourceLayer: "content",
    decisionCandidate: policy.recordDecisionCandidate
  });
}

async function getStateSnapshot() {
  const [config, eventStore, runtime] = await Promise.all([
    readConfig(),
    readEventStore(),
    readRuntimeState()
  ]);
  return { config, events: eventStore.items, eventRevision: eventStore.revision, runtime };
}

async function routeMessage(message, sender) {
  await initializeExtension();

  switch (message.type) {
    case "bridge-init": {
      const config = await readConfig();
      const sourceUrl = sender.tab?.url || sender.url || "";
      const profile = findProfileForUrl(config, sourceUrl);
      if (sender.tab?.id != null) {
        rememberTabContext(sender.tab.id, sourceUrl, config).catch(() => undefined);
      }
      return {
        active: Boolean(profile),
        profile,
        policy: profile ? getEffectivePolicy(profile) : null,
        riskyExtensions: RISKY_EXTENSIONS
      };
    }

    case "event":
      return { event: await handleContentEvent(message, sender) };

    case "state.get":
      return getStateSnapshot();

    case "url.status": {
      const [config, eventStore, runtime] = await Promise.all([
        readConfig(),
        readEventStore(),
        readRuntimeState()
      ]);
      const profile = findProfileForUrl(config, message.url || "", { enabledOnly: false });
      const events = profile ? eventStore.items.filter((event) => event.profileId === profile.id) : [];
      return { profile, eventCount: events.length, recentEvents: events.slice(0, 8), runtime };
    }

    case "profile.create": {
      const config = await mutateConfig((draft) => {
        const domain = assertUniqueProfileDomain(draft, message.profile?.domain);
        draft.profiles.push(createProfile(domain, {
          label: message.profile?.label || domain,
          mode: message.profile?.mode || "strict"
        }));
        return draft;
      });
      const domain = normalizeDomain(message.profile?.domain);
      return { config, profile: config.profiles.find((profile) => profile.domain === domain) };
    }

    case "profile.update": {
      const config = await mutateConfig((draft) => {
        const profile = requireProfile(draft, message.profileId);
        const patch = message.patch || {};

        if (Object.hasOwn(patch, "label")) profile.label = sanitizeLabel(patch.label, profile.domain);
        if (Object.hasOwn(patch, "enabled")) profile.enabled = patch.enabled === true;
        if (Object.hasOwn(patch, "mode")) profile.mode = patch.mode;

        for (const flag of PROFILE_SECURITY_FLAGS) {
          if (Object.hasOwn(patch, flag)) profile[flag] = patch[flag] === true;
        }
        return draft;
      });
      return { config, profile: getProfileById(config, message.profileId) };
    }

    case "profile.delete": {
      const config = await mutateConfig((draft) => {
        requireProfile(draft, message.profileId);
        draft.profiles = draft.profiles.filter((profile) => profile.id !== message.profileId);
        return draft;
      });
      return { config };
    }

    case "allowlist.add": {
      const config = await mutateConfig((draft) => {
        const profile = requireProfile(draft, message.profileId);
        const domain = normalizeDomain(message.domain);
        if (!domain) throw new Error("A valid destination domain is required.");
        profile.allowedTopLevelDomains = uniqueDomains([
          profile.domain,
          ...(profile.allowedTopLevelDomains || []),
          domain
        ]);
        return draft;
      });
      return { config, profile: getProfileById(config, message.profileId) };
    }

    case "allowlist.remove": {
      const config = await mutateConfig((draft) => {
        const profile = requireProfile(draft, message.profileId);
        const domain = normalizeDomain(message.domain);
        profile.allowedTopLevelDomains = uniqueDomains([
          profile.domain,
          ...(profile.allowedTopLevelDomains || []).filter((candidate) => candidate !== domain)
        ]);
        return draft;
      });
      return { config, profile: getProfileById(config, message.profileId) };
    }

    case "blocklist.add": {
      const config = await mutateConfig((draft) => {
        const domain = normalizeDomain(message.domain);
        if (!domain) throw new Error("A valid blocked domain is required.");
        draft.blockedDomains = uniqueDomains([...draft.blockedDomains, domain]);
        return draft;
      });
      return { config };
    }

    case "blocklist.remove": {
      const config = await mutateConfig((draft) => {
        const domain = normalizeDomain(message.domain);
        draft.blockedDomains = draft.blockedDomains.filter((candidate) => candidate !== domain);
        return draft;
      });
      return { config };
    }

    case "events.clear":
      return { events: (await clearEvents()).items };

    case "protection.retry": {
      const config = await readConfig();
      try {
        await reconcileProtection(config);
        const runtime = await markProtectionHealthy(config.revision);
        return { runtime };
      } catch (error) {
        const runtime = await markProtectionDegraded(config.revision, error);
        await appendEvent({ type: "protection-error", action: "degraded", sourceLayer: "background" });
        throw Object.assign(new Error(runtime.lastErrorCode), { cause: error });
      }
    }

    default:
      throw new Error("Unsupported Threatwatch request.");
  }
}

registerNavigationHandlers({ readConfig, appendEvent });
registerDownloadMonitor({ readConfig, appendEvent });

chrome.runtime.onInstalled.addListener(() => {
  extensionInitialization = undefined;
  initializeExtension().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  extensionInitialization = undefined;
  initializeExtension().catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  routeMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || "Threatwatch request failed." }));
  return true;
});

initializeExtension().catch(() => undefined);
