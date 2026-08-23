(() => {
  if (window.__threatwatchPageGuardInstalled) return;
  Object.defineProperty(window, "__threatwatchPageGuardInstalled", { value: true });

  const CHANNEL = "__THREATWATCH_PAGE_GUARD__";
  const nativeOpen = window.open;

  function report(type, payload = {}) {
    try {
      window.postMessage({
        channel: CHANNEL,
        type,
        payload: {
          ...payload,
          sourceUrl: location.href
        }
      }, "*");
    } catch {
      // Reporting must never restore the blocked behavior.
    }
  }

  function classifyTarget(value) {
    const raw = value == null ? "" : String(value).trim();
    if (!raw) return { kind: "blank", raw: "about:blank" };

    try {
      const target = new URL(raw, location.href);
      if (
        target.protocol.toLowerCase() === "about:" &&
        ["blank", "srcdoc"].includes(target.pathname.toLowerCase())
      ) {
        return { kind: "blank", raw: target.href };
      }

      if (target.protocol !== "http:" && target.protocol !== "https:") {
        return { kind: "protocol", raw: target.href };
      }

      return { kind: "web", raw: target.href };
    } catch {
      return { kind: "invalid", raw };
    }
  }

  function guardedOpen(url, ...argumentsAfterUrl) {
    const target = classifyTarget(url);

    if (target.kind === "blank" || target.kind === "invalid") {
      report("popup-blocked", { targetUrl: target.raw });
      return null;
    }

    if (target.kind === "protocol") {
      report("protocol-blocked", { targetUrl: target.raw });
      return null;
    }

    return nativeOpen.call(window, url, ...argumentsAfterUrl);
  }

  try {
    Object.defineProperty(window, "open", {
      value: guardedOpen,
      configurable: false,
      writable: false
    });
  } catch {
    try {
      window.open = guardedOpen;
    } catch {
      // The browser keeps its native implementation if the property is locked.
    }
  }
})();
