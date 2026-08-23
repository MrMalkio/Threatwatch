import {
  EVENT_LIMIT,
  EVENT_SCHEMA_VERSION,
  RUNTIME_SCHEMA_VERSION,
  STORAGE_KEYS
} from "../core/constants.js";
import { createDefaultConfig, normalizeConfig } from "../core/profiles.js";
import { sanitizeEventType, sanitizeEventUrl } from "../core/sanitizer.js";

let initializationPromise;
let configQueue = Promise.resolve();
let eventQueue = Promise.resolve();

function clone(value) {
  return structuredClone(value);
}

function defaultEventStore() {
  return { schemaVersion: EVENT_SCHEMA_VERSION, revision: 0, items: [] };
}

function defaultRuntimeState() {
  return {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    protectionStatus: "initializing",
    configRevision: 0,
    appliedConfigRevision: 0,
    lastSyncAt: 0,
    lastErrorCode: ""
  };
}

function normalizeStoredEvents(events = [], defaultSourceLayer = "migration") {
  if (!Array.isArray(events)) return [];

  return events.slice(0, EVENT_LIMIT).map((event) => ({
    id: typeof event?.id === "string" && event.id ? event.id : crypto.randomUUID(),
    timestamp: Number.isFinite(event?.timestamp) ? event.timestamp : Date.now(),
    type: sanitizeEventType(event?.type) || "unknown",
    severity: ["low", "medium", "high"].includes(event?.severity) ? event.severity : "medium",
    action: String(event?.action || "observed").slice(0, 32),
    profileId: String(event?.profileId || "").slice(0, 80),
    sourceUrl: sanitizeEventUrl(event?.sourceUrl),
    targetUrl: sanitizeEventUrl(event?.targetUrl),
    sourceLayer: String(event?.sourceLayer || defaultSourceLayer).replace(/[^a-z0-9-]/gi, "").slice(0, 40),
    decisionCandidate: event?.decisionCandidate === true,
    detail: String(event?.detail || "Migrated legacy event.").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 240)
  }));
}

function normalizeEventStore(input = {}) {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    revision: Number.isSafeInteger(input.revision) && input.revision >= 0 ? input.revision : 0,
    items: normalizeStoredEvents(input.items, "background").slice(0, EVENT_LIMIT)
  };
}

function normalizeRuntime(input = {}) {
  const defaults = defaultRuntimeState();
  return {
    ...defaults,
    ...input,
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    configRevision: Number.isSafeInteger(input.configRevision) ? input.configRevision : defaults.configRevision,
    appliedConfigRevision: Number.isSafeInteger(input.appliedConfigRevision) ? input.appliedConfigRevision : defaults.appliedConfigRevision,
    lastSyncAt: Number.isFinite(input.lastSyncAt) ? input.lastSyncAt : defaults.lastSyncAt,
    lastErrorCode: String(input.lastErrorCode || "").slice(0, 120)
  };
}

export async function initializeStorage() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.config,
      STORAGE_KEYS.events,
      STORAGE_KEYS.runtime,
      STORAGE_KEYS.legacy,
      STORAGE_KEYS.legacyBackup
    ]);

    const legacy = stored[STORAGE_KEYS.legacy];
    const config = normalizeConfig(
      stored[STORAGE_KEYS.config] ||
      (legacy ? { profiles: legacy.profiles, blockedDomains: legacy.blockedDomains, revision: 1 } : createDefaultConfig())
    );

    if (config.revision === 0) config.revision = 1;

    const events = stored[STORAGE_KEYS.events]
      ? normalizeEventStore(stored[STORAGE_KEYS.events])
      : {
          schemaVersion: EVENT_SCHEMA_VERSION,
          revision: legacy?.events?.length ? 1 : 0,
          items: normalizeStoredEvents(legacy?.events, "migration")
        };

    const runtime = normalizeRuntime(stored[STORAGE_KEYS.runtime]);
    runtime.configRevision = config.revision;

    const writes = {
      [STORAGE_KEYS.config]: config,
      [STORAGE_KEYS.events]: events,
      [STORAGE_KEYS.runtime]: runtime
    };

    if (legacy && !stored[STORAGE_KEYS.legacyBackup]) {
      writes[STORAGE_KEYS.legacyBackup] = legacy;
    }

    await chrome.storage.local.set(writes);
    return { config: clone(config), events: clone(events), runtime: clone(runtime) };
  })();

  try {
    return await initializationPromise;
  } catch (error) {
    initializationPromise = undefined;
    throw error;
  }
}

export async function readConfig() {
  await initializeStorage();
  const stored = await chrome.storage.local.get(STORAGE_KEYS.config);
  return normalizeConfig(stored[STORAGE_KEYS.config]);
}

export async function writeConfig(config) {
  const normalized = normalizeConfig(config);
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: normalized });
  return clone(normalized);
}

export async function readEventStore() {
  await initializeStorage();
  const stored = await chrome.storage.local.get(STORAGE_KEYS.events);
  return normalizeEventStore(stored[STORAGE_KEYS.events]);
}

export async function writeEventStore(store) {
  const normalized = normalizeEventStore(store);
  await chrome.storage.local.set({ [STORAGE_KEYS.events]: normalized });
  return clone(normalized);
}

export async function readRuntimeState() {
  await initializeStorage();
  const stored = await chrome.storage.local.get(STORAGE_KEYS.runtime);
  return normalizeRuntime(stored[STORAGE_KEYS.runtime]);
}

export async function writeRuntimeState(runtime) {
  const normalized = normalizeRuntime(runtime);
  await chrome.storage.local.set({ [STORAGE_KEYS.runtime]: normalized });
  return clone(normalized);
}

export function runConfigExclusive(task) {
  configQueue = configQueue.catch(() => undefined).then(task);
  return configQueue;
}

export function runEventExclusive(task) {
  eventQueue = eventQueue.catch(() => undefined).then(task);
  return eventQueue;
}

export async function clearLegacyBackup() {
  await chrome.storage.local.remove(STORAGE_KEYS.legacyBackup);
}
