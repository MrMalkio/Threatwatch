import { SESSION_KEY_PREFIX } from "../core/constants.js";
import {
  findProfileForUrl,
  isAllowedTopLevelUrl,
  isWebUrl
} from "../core/domain.js";
import { getEffectivePolicy } from "../core/policy.js";
import { getProfileById } from "../core/profiles.js";
import { hasRiskyExtension } from "../core/risk.js";

let handlersRegistered = false;
const tabContextCache = new Map();

function contextKey(tabId) {
  return `${SESSION_KEY_PREFIX}${tabId}`;
}

export function peekTabContext(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return null;
  return tabContextCache.get(tabId) || null;
}

export async function readTabContext(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return null;
  const cached = peekTabContext(tabId);
  if (cached) return cached;

  const key = contextKey(tabId);
  const stored = await chrome.storage.session.get(key);
  const context = stored[key] || null;
  if (context) tabContextCache.set(tabId, context);
  return context;
}

export async function rememberTabContext(tabId, url, config) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const profile = findProfileForUrl(config, url);
  const key = contextKey(tabId);
  const context = {
    url: String(url || ""),
    profileId: profile?.id || "",
    committedAt: Date.now()
  };
  tabContextCache.set(tabId, context);
  await chrome.storage.session.set({ [key]: context });
}

async function forgetTabContext(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  tabContextCache.delete(tabId);
  await chrome.storage.session.remove(contextKey(tabId));
}

function previousProfile(config, context) {
  if (!context) return null;
  const profile = getProfileById(config, context.profileId) || findProfileForUrl(config, context.url);
  return profile?.enabled ? profile : null;
}

function notifyDownloadBlocked(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  chrome.tabs.sendMessage(tabId, {
    type: "download-blocked-notice",
    eventType: "dangerous-download"
  }).catch(() => undefined);
}

export function registerNavigationHandlers({ readConfig, appendEvent }) {
  if (handlersRegistered) return;
  handlersRegistered = true;

  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0 || !isWebUrl(details.url)) return;

    try {
      const [config, context] = await Promise.all([
        readConfig(),
        readTabContext(details.tabId)
      ]);
      const profile = previousProfile(config, context);
      if (!profile) return;

      const policy = getEffectivePolicy(profile);
      if (policy.blockDownloads && hasRiskyExtension(details.url)) {
        notifyDownloadBlocked(details.tabId);
        await appendEvent({
          type: "dangerous-download",
          action: "blocked",
          profileId: profile.id,
          sourceUrl: context?.url || "",
          targetUrl: details.url,
          sourceLayer: "navigation",
          decisionCandidate: policy.recordDecisionCandidate
        });
        return;
      }

      if (isAllowedTopLevelUrl(details.url, profile) || !policy.logExternalNavigation) return;

      await appendEvent({
        type: "external-navigation",
        action: policy.blockExternalNavigation ? "blocked" : "observed",
        profileId: profile.id,
        sourceUrl: context?.url || "",
        targetUrl: details.url,
        sourceLayer: "navigation",
        decisionCandidate: policy.recordDecisionCandidate
      });
    } catch {
      // Navigation must not be interrupted by logging failures.
    }
  });

  chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return;

    try {
      const [config, context] = await Promise.all([
        readConfig(),
        readTabContext(details.tabId)
      ]);
      const profile = previousProfile(config, context);

      if (profile) {
        const policy = getEffectivePolicy(profile);
        if (policy.blockExternalNavigation && !isAllowedTopLevelUrl(details.url, profile)) {
          await appendEvent({
            type: "escape-committed",
            action: "detected",
            profileId: profile.id,
            sourceUrl: context?.url || "",
            targetUrl: details.url,
            sourceLayer: "navigation"
          });
        }
      }

      await rememberTabContext(details.tabId, details.url, config);
    } catch {
      // A later bridge initialization or navigation will rebuild the context.
    }
  });

  chrome.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
    try {
      const sourceTab = await chrome.tabs.get(details.sourceTabId);
      const config = await readConfig();
      const profile = findProfileForUrl(config, sourceTab.url || "");
      if (!profile || isAllowedTopLevelUrl(details.url, profile)) return;

      const policy = getEffectivePolicy(profile);
      if (!policy.logExternalNavigation) return;

      await rememberTabContext(details.tabId, sourceTab.url || "", config);

      let action = "observed";
      if (policy.blockExternalNavigation) {
        try {
          await chrome.tabs.remove(details.tabId);
          action = "closed";
        } catch {
          action = "observed";
        }
      }

      await appendEvent({
        type: "spawned-navigation",
        action,
        profileId: profile.id,
        sourceUrl: sourceTab.url || "",
        targetUrl: details.url,
        sourceLayer: "navigation",
        decisionCandidate: policy.recordDecisionCandidate
      });
    } catch {
      // The source or target tab may have closed before the handler ran.
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    forgetTabContext(tabId).catch(() => undefined);
  });
}

export async function bootstrapTabContexts(config) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => rememberTabContext(tab.id, tab.url || "", config)));
}
