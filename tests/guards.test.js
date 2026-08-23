import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const pageGuardSource = fs.readFileSync("src/page-guard.js", "utf8");
const contentBridgeSource = fs.readFileSync("src/content-bridge.js", "utf8");

test("page guard blocks blank popup variants and non-web protocols", () => {
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
    String
  });
  vm.runInContext(pageGuardSource, context);

  assert.equal(windowObject.open(), null);
  assert.equal(windowObject.open("about:blank#x"), null);
  assert.equal(windowObject.open("ABOUT:blank?x"), null);
  assert.equal(windowObject.open("about:srcdoc#x"), null);
  assert.equal(windowObject.open("mailto:test@example.com"), null);
  assert.equal(windowObject.open("tel:+15555555555"), null);
  assert.equal(windowObject.open("javascript:alert(1)"), null);
  assert.equal(windowObject.open("custom-protocol:value"), null);

  const allowed = windowObject.open("https://outside.example/path");
  assert.deepEqual(allowed, { opened: true });
  assert.equal(nativeCalls.length, 1);
  assert.ok(reports.length >= 8);
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
