import { STORAGE_KEYS } from "../core/constants.js";
import { findProfileForUrl } from "../core/domain.js";
import { getEffectivePolicy } from "../core/policy.js";
import { peekTabContext, readTabContext } from "./navigation.js";

let handlersRegistered = false;
let cachedConfigPromise = null;
let cachedConfig = null;
const containmentByDownloadId = new Map();

function readCachedConfig(readConfig) {
  if (!cachedConfigPromise) {
    cachedConfigPromise = Promise.resolve(readConfig())
      .then((config) => {
        cachedConfig = config;
        return config;
      })
      .catch((error) => {
        cachedConfigPromise = null;
        cachedConfig = null;
        throw error;
      });
  }
  return cachedConfigPromise;
}

function invalidateCachedConfig(changes, areaName) {
  if (areaName === "local" && changes[STORAGE_KEYS.config]) {
    cachedConfigPromise = null;
    cachedConfig = null;
  }
}

async function candidateSourceUrls(item) {
  const candidates = [];
  const add = (value) => {
    const url = String(value || "");
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  add(item.referrer);

  if (!Number.isInteger(item.tabId) || item.tabId < 0) {
    return candidates;
  }

  try {
    add((await readTabContext(item.tabId))?.url);
  } catch {
    // The navigation context is an attribution aid, not a dependency.
  }

  let tab = null;
  try {
    tab = await chrome.tabs.get(item.tabId);
    add(tab.url);
  } catch {
    tab = null;
  }

  if (Number.isInteger(tab?.openerTabId) && tab.openerTabId >= 0) {
    try {
      add((await readTabContext(tab.openerTabId))?.url);
    } catch {
      // Fall through to the live opener tab.
    }

    try {
      add((await chrome.tabs.get(tab.openerTabId)).url);
    } catch {
      // The opener may have closed before the download event fired.
    }
  }

  return candidates;
}

async function resolveProtectedContext(item, config) {
  const sourceUrls = await candidateSourceUrls(item);
  for (const sourceUrl of sourceUrls) {
    const profile = findProfileForUrl(config, sourceUrl);
    if (profile) return { profile, sourceUrl };
  }
  return null;
}

function scheduleResidualCleanup(downloadId) {
  for (const delay of [75, 500, 2_000]) {
    setTimeout(() => {
      chrome.downloads.removeFile(downloadId).catch(() => undefined);
    }, delay);
  }
}

async function pauseThenCancel(downloadId) {
  const pausePromise = chrome.downloads.pause(downloadId).catch(() => undefined);
  const cancelResult = await Promise.allSettled([
    pausePromise,
    chrome.downloads.cancel(downloadId)
  ]);

  const cancellation = cancelResult[1];
  if (cancellation.status === "rejected") throw cancellation.reason;
  scheduleResidualCleanup(downloadId);
}

function preemptivelyPauseKnownProtectedDownload(item) {
  if (!cachedConfig) return;

  const contextUrl = Number.isInteger(item.tabId) && item.tabId >= 0
    ? peekTabContext(item.tabId)?.url || ""
    : "";

  for (const sourceUrl of [item.referrer, contextUrl]) {
    if (!sourceUrl) continue;
    const profile = findProfileForUrl(cachedConfig, sourceUrl);
    if (!profile || !getEffectivePolicy(profile).blockDownloads) continue;
    chrome.downloads.pause(item.id).catch(() => undefined);
    return;
  }
}

function notifyTab(item, eventType) {
  if (!Number.isInteger(item.tabId) || item.tabId < 0) return;
  chrome.tabs.sendMessage(item.tabId, {
    type: "download-blocked-notice",
    eventType
  }).catch(() => undefined);
}

async function containDownload(item, dependencies, sourceLayer) {
  const config = await readCachedConfig(dependencies.readConfig);
  const context = await resolveProtectedContext(item, config);
  if (!context) return false;

  const policy = getEffectivePolicy(context.profile);
  if (!policy.blockDownloads) return false;

  const eventType = "dangerous-download";

  await pauseThenCancel(item.id);
  notifyTab(item, eventType);

  await dependencies.appendEvent({
    type: eventType,
    action: "cancelled",
    profileId: context.profile.id,
    sourceUrl: context.sourceUrl,
    targetUrl: item.finalUrl || item.url || "",
    sourceLayer
  });

  return true;
}

function containDownloadOnce(item, dependencies, sourceLayer) {
  const existing = containmentByDownloadId.get(item.id);
  if (existing) return existing;

  const promise = containDownload(item, dependencies, sourceLayer)
    .catch(() => false)
    .then((contained) => {
      if (contained) {
        setTimeout(() => containmentByDownloadId.delete(item.id), 5_000);
      } else {
        containmentByDownloadId.delete(item.id);
      }
      return contained;
    });

  containmentByDownloadId.set(item.id, promise);
  return promise;
}

async function containAtFilenameStage(item, dependencies) {
  const firstAttempt = await containDownloadOnce(item, dependencies, "download-filename");
  if (firstAttempt) return true;

  // onCreated may run before tab/opener provenance is available. Filename
  // determination is a later browser checkpoint, so retry with fresh context.
  containmentByDownloadId.delete(item.id);
  return containDownloadOnce(item, dependencies, "download-filename");
}

export function registerDownloadMonitor({
  readConfig,
  appendEvent
}) {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const dependencies = { readConfig, appendEvent };
  readCachedConfig(readConfig).catch(() => undefined);
  chrome.storage.onChanged.addListener(invalidateCachedConfig);

  chrome.downloads.onCreated.addListener((item) => {
    preemptivelyPauseKnownProtectedDownload(item);
    containDownloadOnce(item, dependencies, "download-created").catch(() => undefined);
  });

  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    containAtFilenameStage(item, dependencies)
      .finally(() => suggest());
    return true;
  });
}
