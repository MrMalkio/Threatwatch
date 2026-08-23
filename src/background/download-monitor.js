import { findProfileForUrl } from "../core/domain.js";
import { getEffectivePolicy } from "../core/policy.js";
import { hasRiskyExtension } from "../core/risk.js";

let handlerRegistered = false;

export function registerDownloadMonitor({ readConfig, appendEvent }) {
  if (handlerRegistered) return;
  handlerRegistered = true;

  chrome.downloads.onCreated.addListener(async (item) => {
    try {
      const config = await readConfig();
      let sourceUrl = item.referrer || "";

      if (!sourceUrl && Number.isInteger(item.tabId) && item.tabId >= 0) {
        try {
          sourceUrl = (await chrome.tabs.get(item.tabId)).url || "";
        } catch {
          sourceUrl = "";
        }
      }

      const profile = findProfileForUrl(config, sourceUrl);
      if (!profile || !getEffectivePolicy(profile).blockDownloads) return;

      const candidate = item.filename || item.finalUrl || item.url || "";
      if (!hasRiskyExtension(candidate)) return;

      await chrome.downloads.cancel(item.id);
      await appendEvent({
        type: "dangerous-download",
        action: "cancelled",
        profileId: profile.id,
        sourceUrl,
        targetUrl: item.finalUrl || item.url || "",
        sourceLayer: "download"
      });
    } catch {
      // Download handling should not crash the service worker.
    }
  });
}
