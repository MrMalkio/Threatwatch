(() => {
  if (window.__threatwatchDownloadGuardInstalled) return;
  Object.defineProperty(window, "__threatwatchDownloadGuardInstalled", { value: true });

  const CHANNEL = "__THREATWATCH_PAGE_GUARD__";
  const downloadPolicy = globalThis.__THREATWATCH_DOWNLOAD_POLICY__;
  const riskyExtensions = downloadPolicy?.riskyExtensions || [];

  function report(type, targetUrl = "") {
    try {
      window.postMessage({
        channel: CHANNEL,
        type,
        payload: {
          targetUrl: String(targetUrl || ""),
          sourceUrl: location.href
        }
      }, "*");
    } catch {
      // Blocking remains active when reporting fails.
    }
  }

  function decodeCandidate(value) {
    let candidate = String(value || "").split(/[?#]/, 1)[0].replace(/\\/g, "/").toLowerCase();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const decoded = decodeURIComponent(candidate);
        if (decoded === candidate) break;
        candidate = decoded;
      } catch {
        break;
      }
    }
    return candidate;
  }

  function hasRiskyExtension(value) {
    const candidate = decodeCandidate(value);
    return riskyExtensions.some((extension) => candidate.endsWith(extension));
  }

  function anchorTarget(anchor) {
    return anchor?.href || anchor?.getAttribute?.("href") || "";
  }

  function anchorDeclaresDownload(anchor) {
    return Boolean(anchor?.hasAttribute?.("download"));
  }

  function formTarget(form, submitter = null) {
    return (
      submitter?.formAction ||
      submitter?.getAttribute?.("formaction") ||
      form?.action ||
      form?.getAttribute?.("action") ||
      location.href
    );
  }

  function blockReasonForAnchor(anchor) {
    const targetUrl = anchorTarget(anchor);
    if (anchorDeclaresDownload(anchor)) {
      return {
        type: "dangerous-download",
        targetUrl
      };
    }
    if (hasRiskyExtension(targetUrl)) {
      return { type: "dangerous-download", targetUrl };
    }
    return null;
  }

  function blockReasonForForm(form, submitter = null) {
    const targetUrl = formTarget(form, submitter);
    return hasRiskyExtension(targetUrl)
      ? { type: "dangerous-download", targetUrl }
      : null;
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function findInPath(event, tagName) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const candidate of path) {
      if (candidate?.tagName === tagName) return candidate;
    }

    let candidate = event.target;
    while (candidate && candidate !== document) {
      if (candidate.tagName === tagName) return candidate;
      candidate = candidate.parentNode;
    }
    return null;
  }

  function handleAnchorActivation(event) {
    const anchor = findInPath(event, "A");
    if (!anchor) return;
    const reason = blockReasonForAnchor(anchor);
    if (!reason) return;

    stopEvent(event);
    report(reason.type, reason.targetUrl);
  }

  document.addEventListener("click", handleAnchorActivation, true);
  document.addEventListener("auxclick", handleAnchorActivation, true);

  document.addEventListener("submit", (event) => {
    const form = findInPath(event, "FORM") || event.target;
    const reason = blockReasonForForm(form, event.submitter || null);
    if (!reason) return;

    stopEvent(event);
    report(reason.type, reason.targetUrl);
  }, true);

  const anchorPrototype = globalThis.HTMLAnchorElement?.prototype;
  if (anchorPrototype && typeof anchorPrototype.click === "function") {
    const nativeAnchorClick = anchorPrototype.click;
    const guardedAnchorClick = function guardedAnchorClick() {
      const reason = blockReasonForAnchor(this);
      if (reason) {
        report(reason.type, reason.targetUrl);
        return undefined;
      }
      return nativeAnchorClick.call(this);
    };

    try {
      Object.defineProperty(anchorPrototype, "click", {
        value: guardedAnchorClick,
        configurable: false,
        writable: false
      });
    } catch {
      try {
        anchorPrototype.click = guardedAnchorClick;
      } catch {
        // Capture-phase handling remains active.
      }
    }
  }

  const formPrototype = globalThis.HTMLFormElement?.prototype;
  if (formPrototype) {
    for (const methodName of ["submit", "requestSubmit"]) {
      if (typeof formPrototype[methodName] !== "function") continue;
      const nativeMethod = formPrototype[methodName];
      const guardedMethod = function guardedFormSubmission(submitter) {
        const reason = blockReasonForForm(this, submitter || null);
        if (reason) {
          report(reason.type, reason.targetUrl);
          return undefined;
        }
        return nativeMethod.call(this, submitter);
      };

      try {
        Object.defineProperty(formPrototype, methodName, {
          value: guardedMethod,
          configurable: false,
          writable: false
        });
      } catch {
        try {
          formPrototype[methodName] = guardedMethod;
        } catch {
          // Capture-phase handling remains active for user submissions.
        }
      }
    }
  }

  function blockedSavePicker() {
    report("dangerous-download", location.href);
    return Promise.reject(new DOMException("Blocked by Threatwatch", "NotAllowedError"));
  }

  for (const pickerName of ["showSaveFilePicker", "showDirectoryPicker"]) {
    if (typeof window[pickerName] !== "function") continue;
    try {
      Object.defineProperty(window, pickerName, {
        value: blockedSavePicker,
        configurable: false,
        writable: false
      });
    } catch {
      try {
        window[pickerName] = blockedSavePicker;
      } catch {
        // Browser permissions still gate access to the picker.
      }
    }
  }

  const fileHandlePrototype = globalThis.FileSystemFileHandle?.prototype;
  if (fileHandlePrototype && typeof fileHandlePrototype.createWritable === "function") {
    const blockedCreateWritable = function blockedCreateWritable() {
      report("dangerous-download", this?.name || location.href);
      return Promise.reject(new DOMException("Blocked by Threatwatch", "NotAllowedError"));
    };

    try {
      Object.defineProperty(fileHandlePrototype, "createWritable", {
        value: blockedCreateWritable,
        configurable: false,
        writable: false
      });
    } catch {
      try {
        fileHandlePrototype.createWritable = blockedCreateWritable;
      } catch {
        // New picker calls remain blocked when the prototype is locked.
      }
    }
  }

  if (typeof window.chooseFileSystemEntries === "function") {
    const nativeChooseFileSystemEntries = window.chooseFileSystemEntries.bind(window);
    const guardedChooseFileSystemEntries = (options = {}, ...remainingArguments) => {
      const type = String(options?.type || "").toLowerCase();
      if (type === "save-file" || type === "savefile") {
        return blockedSavePicker();
      }
      return nativeChooseFileSystemEntries(options, ...remainingArguments);
    };

    try {
      Object.defineProperty(window, "chooseFileSystemEntries", {
        value: guardedChooseFileSystemEntries,
        configurable: false,
        writable: false
      });
    } catch {
      try {
        window.chooseFileSystemEntries = guardedChooseFileSystemEntries;
      } catch {
        // The legacy picker remains browser-gated.
      }
    }
  }

  for (const saveMethod of ["msSaveBlob", "msSaveOrOpenBlob"]) {
    if (typeof navigator?.[saveMethod] !== "function") continue;
    const blockedLegacySave = () => {
      report("dangerous-download", location.href);
      return false;
    };

    try {
      Object.defineProperty(navigator, saveMethod, {
        value: blockedLegacySave,
        configurable: false,
        writable: false
      });
    } catch {
      try {
        navigator[saveMethod] = blockedLegacySave;
      } catch {
        // Modern Chromium does not expose these legacy APIs.
      }
    }
  }

  if (typeof document.execCommand === "function") {
    const nativeExecCommand = document.execCommand.bind(document);
    const guardedExecCommand = (commandName, ...argumentsAfterCommand) => {
      if (String(commandName || "").toLowerCase() === "saveas") {
        report("dangerous-download", location.href);
        return false;
      }
      return nativeExecCommand(commandName, ...argumentsAfterCommand);
    };

    try {
      Object.defineProperty(document, "execCommand", {
        value: guardedExecCommand,
        configurable: false,
        writable: false
      });
    } catch {
      try {
        document.execCommand = guardedExecCommand;
      } catch {
        // The browser may expose execCommand as a locked legacy property.
      }
    }
  }
})();
