(() => {
  const CHANNEL = "__THREATWATCH_PAGE_GUARD__";
  const PAGE_EVENT_TYPES = new Set([
    "popup-blocked",
    "protocol-blocked",
    "clipboard-blocked",
    "dangerous-download"
  ]);
  const CLICKFIX_PATTERNS = [
    /press\s+(?:the\s+)?windows(?:\s+key)?\s*\+\s*r/i,
    /press\s+win\s*\+\s*r/i,
    /open\s+(?:the\s+)?run\s+(?:dialog|box|window)/i,
    /paste\s+(?:the\s+)?(?:command|verification|text).{0,80}(?:run|enter)/i,
    /(?:verify|verification).{0,100}(?:clipboard|paste|windows\s*\+\s*r|win\s*\+\s*r)/i
  ];

  let profile = null;
  let policy = null;
  let riskyExtensions = [];
  let clickFixWarningShown = false;
  let scanScheduled = false;
  let downloadNoticeHost = null;
  let downloadNoticeTimer = null;

  chrome.runtime.sendMessage({ type: "bridge-init" })
    .then((response) => {
      if (!response?.ok || !response.active || !response.profile || !response.policy) return;
      profile = response.profile;
      policy = response.policy;
      riskyExtensions = Array.isArray(response.riskyExtensions) ? response.riskyExtensions : [];
      activate();
    })
    .catch(() => undefined);

  window.addEventListener("message", (event) => {
    if (!profile || event.source !== window) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || !PAGE_EVENT_TYPES.has(message.type)) return;

    if (message.type === "dangerous-download") {
      showDownloadBlockedNotice();
    }

    report({
      type: message.type,
      action: "blocked",
      targetUrl: message.payload?.targetUrl || ""
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "download-blocked-notice") {
      showDownloadBlockedNotice();
    }
  });

  function activate() {
    document.addEventListener("click", handleClick, true);

    if (policy.scanClickFix || policy.scanOverlays) {
      startObserver();
      queueScan();
    }
  }

  function handleClick(event) {
    const anchor = findAnchor(event);
    if (!anchor) return;

    const href = anchor.href || anchor.getAttribute("href") || "";
    if (!href) return;

    let targetUrl;
    try {
      targetUrl = new URL(href, location.href);
    } catch {
      return;
    }

    const isWebProtocol = targetUrl.protocol === "http:" || targetUrl.protocol === "https:";
    const declaresDownload = anchor.hasAttribute?.("download") === true;

    if (policy.blockDownloads && declaresDownload) {
      stopEvent(event);
      const eventType = "dangerous-download";
      showDownloadBlockedNotice();
      report({ type: eventType, action: "blocked", targetUrl: targetUrl.href });
      return;
    }

    if (!isWebProtocol) {
      if (!policy.blockProtocols) return;
      stopEvent(event);
      report({ type: "protocol-blocked", action: "blocked", targetUrl: targetUrl.href });
      return;
    }

    if (policy.blockDownloads && hasRiskyExtension(targetUrl.pathname)) {
      stopEvent(event);
      showDownloadBlockedNotice();
      report({ type: "dangerous-download", action: "blocked", targetUrl: targetUrl.href });
      return;
    }

    if (isAllowedDomain(targetUrl.hostname)) return;

    const target = (anchor.getAttribute("target") || "").toLowerCase();
    const canEscapeTopLevel = window === window.top || ["_top", "_parent", "_blank"].includes(target);
    if (!canEscapeTopLevel || !policy.logExternalNavigation) return;

    if (policy.blockExternalNavigation) {
      stopEvent(event);
    }

    report({
      type: "external-navigation",
      action: policy.blockExternalNavigation ? "blocked" : "observed",
      targetUrl: targetUrl.href
    });
  }

  function findAnchor(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const candidate of path) {
      if (candidate?.tagName === "A") return candidate;
    }

    let candidate = event.target;
    while (candidate && candidate !== document) {
      if (candidate.tagName === "A") return candidate;
      candidate = candidate.parentNode;
    }
    return null;
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function isAllowedDomain(hostname) {
    const allowedDomains = [profile.domain, ...(profile.allowedTopLevelDomains || [])];
    return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }

  function hasRiskyExtension(pathname) {
    let candidate = String(pathname || "").toLowerCase();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const decoded = decodeURIComponent(candidate);
        if (decoded === candidate) break;
        candidate = decoded;
      } catch {
        break;
      }
    }
    return riskyExtensions.some((extension) => candidate.endsWith(extension));
  }

  function startObserver() {
    const begin = () => {
      if (!document.documentElement) {
        setTimeout(begin, 25);
        return;
      }

      const observer = new MutationObserver(() => queueScan());
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden"]
      });
    };
    begin();
  }

  function queueScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(() => {
      scanScheduled = false;
      scanPage();
    }, 500);
  }

  function scanPage() {
    if (!document.body) return;

    if (policy.scanClickFix && !clickFixWarningShown) {
      const pageText = (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 20_000);
      if (CLICKFIX_PATTERNS.some((pattern) => pattern.test(pageText))) {
        clickFixWarningShown = true;
        showClickFixWarning();
        report({ type: "clickfix-warning", action: "warned" });
      }
    }

    if (policy.scanOverlays) scanOverlays();
  }

  function scanOverlays() {
    const elements = document.body?.querySelectorAll("*") || [];
    const scanLimit = Math.min(elements.length, 4_000);

    for (let index = 0; index < scanLimit; index += 1) {
      const element = elements[index];
      if (element.dataset?.threatwatchNeutralized) continue;
      if (element.closest?.("[data-threatwatch-ui='true']")) continue;

      let style;
      let rectangle;
      try {
        style = getComputedStyle(element);
        rectangle = element.getBoundingClientRect();
      } catch {
        continue;
      }

      if (!["fixed", "absolute"].includes(style.position) || style.pointerEvents === "none") continue;
      if (rectangle.width / window.innerWidth < 0.72 || rectangle.height / window.innerHeight < 0.55) continue;

      const zIndex = Number.parseInt(style.zIndex, 10);
      const opacity = Number.parseFloat(style.opacity || "1");
      const hasLittleText = (element.textContent || "").trim().length < 12;
      const transparentBackground = (
        style.backgroundColor === "transparent" ||
        /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(style.backgroundColor)
      );

      if (!Number.isFinite(zIndex) || zIndex < 500) continue;
      if (!(opacity <= 0.08 || (transparentBackground && hasLittleText))) continue;

      element.dataset.threatwatchNeutralized = "true";
      element.style.setProperty("pointer-events", "none", "important");
      report({ type: "click-overlay", action: "neutralized" });
    }
  }

  function showDownloadBlockedNotice() {
    if (window !== window.top) return;

    if (downloadNoticeHost?.isConnected) {
      clearTimeout(downloadNoticeTimer);
      downloadNoticeTimer = setTimeout(removeDownloadNotice, 4_500);
      return;
    }

    const host = document.createElement("div");
    host.dataset.threatwatchUi = "true";
    host.style.cssText = "all:initial;position:fixed;right:16px;top:16px;z-index:2147483647";
    const shadowRoot = host.attachShadow({ mode: "closed" });
    shadowRoot.innerHTML = '<div style="max-width:390px;box-sizing:border-box;border:1px solid #f79009;border-radius:12px;background:#101828;color:#fff;padding:13px 15px;font:600 14px/1.45 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35)"><b style="color:#fec84b">Threatwatch blocked a download.</b><div style="margin-top:3px;color:#d0d5dd;font-weight:500">The request was blocked or cancelled before Chrome could finish the download.</div></div>';

    downloadNoticeHost = host;
    (document.documentElement || document.body).appendChild(host);
    downloadNoticeTimer = setTimeout(removeDownloadNotice, 4_500);
  }

  function removeDownloadNotice() {
    downloadNoticeHost?.remove();
    downloadNoticeHost = null;
    downloadNoticeTimer = null;
  }

  function showClickFixWarning() {
    const host = document.createElement("div");
    host.dataset.threatwatchUi = "true";
    host.style.cssText = "all:initial;position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647";

    const shadowRoot = host.attachShadow({ mode: "closed" });
    shadowRoot.innerHTML = '<div style="width:min(720px,calc(100vw - 32px));box-sizing:border-box;border:1px solid #f04438;border-radius:12px;background:#101828;color:#fff;padding:14px;font:600 14px/1.45 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35)"><b style="color:#fda29b">Threatwatch warning:</b> this page resembles a ClickFix verification flow. Do not paste commands into Run, Terminal, PowerShell, or Command Prompt.</div>';
    (document.documentElement || document.body).appendChild(host);
  }

  function report(event) {
    chrome.runtime.sendMessage({ type: "event", event }).catch(() => undefined);
  }
})();
