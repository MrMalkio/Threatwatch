import {
  EVENT_DEDUPE_WINDOW_MS,
  EVENT_DEFINITIONS,
  EVENT_LIMIT
} from "../core/constants.js";
import { sanitizeEventType, sanitizeEventUrl } from "../core/sanitizer.js";
import {
  readEventStore,
  runEventExclusive,
  writeEventStore
} from "./storage.js";

function eventId() {
  return globalThis.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeAction(definition, action) {
  return definition.actions.includes(action) ? action : definition.defaultAction;
}

function fingerprint(event) {
  return [
    event.type,
    event.action,
    event.profileId,
    event.sourceUrl,
    event.targetUrl
  ].join("|");
}

export function normalizeEvent(raw = {}) {
  const type = sanitizeEventType(raw.type);
  const definition = EVENT_DEFINITIONS[type];
  if (!definition) throw new Error(`Unsupported event type: ${type || "unknown"}.`);

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 100) : eventId(),
    timestamp: Number.isFinite(raw.timestamp) ? raw.timestamp : Date.now(),
    type,
    severity: definition.severity,
    action: normalizeAction(definition, raw.action),
    profileId: String(raw.profileId || "").slice(0, 80),
    sourceUrl: sanitizeEventUrl(raw.sourceUrl),
    targetUrl: sanitizeEventUrl(raw.targetUrl),
    sourceLayer: String(raw.sourceLayer || "background").replace(/[^a-z0-9-]/gi, "").slice(0, 40),
    decisionCandidate: raw.decisionCandidate === true,
    detail: definition.detail
  };
}

export function appendEvent(raw) {
  return runEventExclusive(async () => {
    const store = await readEventStore();
    const event = normalizeEvent(raw);
    const eventFingerprint = fingerprint(event);

    const duplicate = store.items.find((candidate) => (
      event.timestamp - candidate.timestamp <= EVENT_DEDUPE_WINDOW_MS &&
      event.timestamp >= candidate.timestamp &&
      fingerprint(candidate) === eventFingerprint
    ));

    if (duplicate) return duplicate;

    store.items.unshift(event);
    store.items = store.items.slice(0, EVENT_LIMIT);
    store.revision += 1;
    await writeEventStore(store);
    return event;
  });
}

export function clearEvents() {
  return runEventExclusive(async () => {
    const store = await readEventStore();
    store.items = [];
    store.revision += 1;
    return writeEventStore(store);
  });
}
