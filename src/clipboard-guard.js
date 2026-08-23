(() => {
  if (window.__threatwatchClipboardGuardInstalled) return;
  Object.defineProperty(window, "__threatwatchClipboardGuardInstalled", { value: true });

  const CHANNEL = "__THREATWATCH_PAGE_GUARD__";
  const commandPatterns = [
    /\bpowershell(?:\.exe)?\b/i,
    /\bpwsh(?:\.exe)?\b/i,
    /\bcmd(?:\.exe)?\s*\/c\b/i,
    /\bmshta(?:\.exe)?\b/i,
    /\brundll32(?:\.exe)?\b/i,
    /\bregsvr32(?:\.exe)?\b/i,
    /\bcertutil(?:\.exe)?\b/i,
    /\bwscript(?:\.exe)?\b/i,
    /\bcscript(?:\.exe)?\b/i,
    /\binvoke-expression\b/i,
    /\biex\s*\(/i,
    /\bfrombase64string\b/i,
    /\bencodedcommand\b/i
  ];

  function isSuspiciousClipboardText(text) {
    if (typeof text !== "string") return false;
    const sample = text.slice(0, 5000);
    return commandPatterns.some((pattern) => pattern.test(sample));
  }

  function reportBlockedClipboard() {
    try {
      window.postMessage({
        channel: CHANNEL,
        type: "clipboard-blocked",
        payload: { sourceUrl: location.href }
      }, "*");
    } catch {
      // Reporting must never permit the rejected write.
    }
  }

  try {
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") return;

    const nativeWriteText = clipboard.writeText.bind(clipboard);
    const guardedWriteText = (text) => {
      if (!isSuspiciousClipboardText(text)) return nativeWriteText(text);
      reportBlockedClipboard();
      return Promise.reject(new DOMException("Blocked by Threatwatch", "NotAllowedError"));
    };

    try {
      Object.defineProperty(clipboard, "writeText", {
        value: guardedWriteText,
        configurable: false,
        writable: false
      });
    } catch {
      try {
        clipboard.writeText = guardedWriteText;
      } catch {
        // Some browser builds expose an immutable clipboard object.
      }
    }
  } catch {
    // Clipboard access itself may throw in a restricted frame.
  }
})();
