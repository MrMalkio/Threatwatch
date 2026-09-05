import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sharedDownloadPolicySource = fs.readFileSync("src/shared/download-policy-data.js", "utf8");
const pageGuardSource = fs.readFileSync("src/page-guard.js", "utf8");
const downloadGuardSource = fs.readFileSync("src/download-guard.js", "utf8");
const contentBridgeSource = fs.readFileSync("src/content-bridge.js", "utf8");

test("page guard blocks blank popup variants, non-web protocols, and risky web targets", () => {
  const nativeCalls = [];
  const reports = [];
  const windowObject = {
    open: (...args) => {
      nativeCalls.push(args);
      return { opened: true };
    },
    postMessage: (message) => reports.push(message)
  };

  const context = vm.createContext({
    window: windowObject,
    location: { href: "https://protected.example/path" },
    URL,
    Object,
    String,
    decodeURIComponent
  });
  vm.runInContext(sharedDownloadPolicySource, context);
  vm.runInContext(pageGuardSource, context);

  assert.equal(windowObject.open(), null);
  assert.equal(windowObject.open("about:blank#x"), null);
  assert.equal(windowObject.open("ABOUT:blank?x"), null);
  assert.equal(windowObject.open("about:srcdoc#x"), null);
  assert.equal(windowObject.open("mailto:test@example.com"), null);
  assert.equal(windowObject.open("tel:+15555555555"), null);
  assert.equal(windowObject.open("javascript:alert(1)"), null);
  assert.equal(windowObject.open("custom-protocol:value"), null);
  assert.equal(windowObject.open("https://outside.example/payload%2EEXE?token=x"), null);

  const allowed = windowObject.open("https://outside.example/path");
  assert.deepEqual(allowed, { opened: true });
  assert.equal(nativeCalls.length, 1);
  assert.ok(reports.some((entry) => entry.type === "dangerous-download"));
});

test("download guard blocks declarative, programmatic, and picker save attempts before native APIs run", async () => {
  const reports = [];
  const listeners = new Map();
  let nativeAnchorClicks = 0;
  let nativeFormSubmits = 0;
  let nativePickerCalls = 0;
  let nativeWritableCalls = 0;
  let nativeExecCalls = 0;

  class FakeAnchor {
    constructor(href, download = false) {
      this.href = href;
      this.tagName = "A";
      this.download = "";
      this.attributes = new Set(download ? ["download"] : []);
    }

    hasAttribute(name) {
      return this.attributes.has(name);
    }

    getAttribute(name) {
      if (name === "href") return this.href;
      if (name === "download" && this.attributes.has(name)) return "";
      return null;
    }

    click() {
      nativeAnchorClicks += 1;
      return "native-click";
    }
  }

  class FakeFileHandle {
    constructor(name = "payload.bin") {
      this.name = name;
    }

    createWritable() {
      nativeWritableCalls += 1;
      return Promise.resolve({});
    }
  }

  class FakeForm {
    constructor(action) {
      this.action = action;
      this.tagName = "FORM";
    }

    getAttribute(name) {
      return name === "action" ? this.action : null;
    }

    submit() {
      nativeFormSubmits += 1;
      return "native-submit";
    }

    requestSubmit() {
      nativeFormSubmits += 1;
      return "native-request-submit";
    }
  }

  const documentObject = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    execCommand: () => {
      nativeExecCalls += 1;
      return true;
    }
  };

  const navigatorObject = {};
  const windowObject = {
    postMessage: (message) => reports.push(message),
    showSaveFilePicker: () => {
      nativePickerCalls += 1;
      return Promise.resolve({});
    },
    showDirectoryPicker: () => {
      nativePickerCalls += 1;
      return Promise.resolve({});
    }
  };

  const context = vm.createContext({
    window: windowObject,
    document: documentObject,
    navigator: navigatorObject,
    location: { href: "https://protected.example/path" },
    HTMLAnchorElement: FakeAnchor,
    HTMLFormElement: FakeForm,
    FileSystemFileHandle: FakeFileHandle,
    URL,
    Object,
    String,
    Promise,
    DOMException,
    decodeURIComponent,
    setTimeout
  });

  vm.runInContext(sharedDownloadPolicySource, context);
  vm.runInContext(downloadGuardSource, context);

  const declarativeDownload = new FakeAnchor("https://cdn.example/movie.mp4", true);
  assert.equal(declarativeDownload.click(), undefined);

  const riskyDownload = new FakeAnchor("https://cdn.example/update.exe", false);
  assert.equal(riskyDownload.click(), undefined);

  const safeNavigation = new FakeAnchor("https://cdn.example/watch", false);
  assert.equal(safeNavigation.click(), "native-click");

  const riskyForm = new FakeForm("https://cdn.example/payload.msi");
  assert.equal(riskyForm.submit(), undefined);

  await assert.rejects(windowObject.showSaveFilePicker(), /Blocked by Threatwatch/);
  await assert.rejects(windowObject.showDirectoryPicker(), /Blocked by Threatwatch/);
  await assert.rejects(new FakeFileHandle().createWritable(), /Blocked by Threatwatch/);
  assert.equal(documentObject.execCommand("SaveAs"), false);

  assert.equal(nativeAnchorClicks, 1);
  assert.equal(nativeFormSubmits, 0);
  assert.equal(nativePickerCalls, 0);
  assert.equal(nativeWritableCalls, 0);
  assert.equal(nativeExecCalls, 0);
  assert.ok(reports.filter((entry) => entry.type === "dangerous-download").length >= 4);
});

test("ClickFix warning state does not stop future scans", () => {
  const queueFunction = contentBridgeSource.match(/function queueScan\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.ok(queueFunction);
  assert.doesNotMatch(queueFunction, /clickFixWarningShown/);
});

test("already-neutralized overlays continue the loop", () => {
  assert.match(
    contentBridgeSource,
    /if \(element\.dataset\?\.threatwatchNeutralized\) continue;/
  );
  assert.doesNotMatch(
    contentBridgeSource,
    /if \(element\.dataset\?\.threatwatchNeutralized\) return;/
  );
});

test("content bridge shows a local notice for blocked downloads", () => {
  assert.match(contentBridgeSource, /download-blocked-notice/);
  assert.match(contentBridgeSource, /Threatwatch blocked a download/);
});
