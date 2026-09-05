import "../shared/download-policy-data.js";

const downloadPolicy = globalThis.__THREATWATCH_DOWNLOAD_POLICY__;

export const STORAGE_KEYS = Object.freeze({
  config: "threatwatch.config.v2",
  events: "threatwatch.events.v1",
  runtime: "threatwatch.runtime.v1",
  legacy: "threatwatchState",
  legacyBackup: "threatwatchState.backup.v1"
});

export const SESSION_KEY_PREFIX = "threatwatch.navigation.tab.";
export const SCHEMA_VERSION = 2;
export const EVENT_SCHEMA_VERSION = 1;
export const RUNTIME_SCHEMA_VERSION = 1;
export const EVENT_LIMIT = 750;
export const EVENT_DEDUPE_WINDOW_MS = 1500;
export const PROTECTED_SCRIPT_PREFIX = "tw-";
export const RULE_ID_MIN = 50_000;
export const RULE_ID_MAX = 99_999;
export const LEGACY_RULE_ID_MIN = 1_000;
export const LEGACY_RULE_ID_MAX = 4_999;

export const MODES = Object.freeze(["normal", "strict", "learn"]);

export const RISKY_EXTENSIONS = downloadPolicy.riskyExtensions;
export const DANGEROUS_MIME_PATTERNS = downloadPolicy.dangerousMimePatterns;
export const FORCED_DOWNLOAD_MIME_PATTERNS = downloadPolicy.forcedDownloadMimePatterns;

export const CONTENT_EVENT_TYPES = Object.freeze(new Set([
  "popup-blocked",
  "protocol-blocked",
  "clipboard-blocked",
  "dangerous-download",
  "external-navigation",
  "clickfix-warning",
  "click-overlay"
]));

export const EVENT_DEFINITIONS = Object.freeze({
  "popup-blocked": Object.freeze({
    severity: "medium",
    defaultAction: "blocked",
    actions: Object.freeze(["blocked"]),
    detail: "Blocked a blank popup or popunder target."
  }),
  "protocol-blocked": Object.freeze({
    severity: "high",
    defaultAction: "blocked",
    actions: Object.freeze(["blocked"]),
    detail: "Blocked a non-web protocol launch."
  }),
  "clipboard-blocked": Object.freeze({
    severity: "high",
    defaultAction: "blocked",
    actions: Object.freeze(["blocked"]),
    detail: "Blocked a suspicious clipboard command payload."
  }),
  "dangerous-download": Object.freeze({
    severity: "high",
    defaultAction: "blocked",
    actions: Object.freeze(["blocked", "paused", "cancelled", "removed"]),
    detail: "Blocked or cancelled a download carrying a risky filename, URL, MIME type, or browser danger signal."
  }),
  "external-navigation": Object.freeze({
    severity: "medium",
    defaultAction: "observed",
    actions: Object.freeze(["observed", "blocked"]),
    detail: "Recorded an unexpected external navigation from a protected page."
  }),
  "spawned-navigation": Object.freeze({
    severity: "high",
    defaultAction: "observed",
    actions: Object.freeze(["observed", "closed"]),
    detail: "Recorded a new tab or window spawned from a protected page."
  }),
  "clickfix-warning": Object.freeze({
    severity: "high",
    defaultAction: "warned",
    actions: Object.freeze(["warned"]),
    detail: "Page text resembles a fake verification or ClickFix instruction flow."
  }),
  "click-overlay": Object.freeze({
    severity: "medium",
    defaultAction: "neutralized",
    actions: Object.freeze(["neutralized"]),
    detail: "Neutralized a transparent click-capture overlay."
  }),
  "escape-committed": Object.freeze({
    severity: "high",
    defaultAction: "detected",
    actions: Object.freeze(["detected"]),
    detail: "An unexpected external navigation committed from a Strict or Learn profile."
  }),
  "protection-error": Object.freeze({
    severity: "high",
    defaultAction: "degraded",
    actions: Object.freeze(["degraded"]),
    detail: "Threatwatch could not fully synchronize browser protection."
  })
});
