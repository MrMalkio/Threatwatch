import { SCHEMA_VERSION } from "./constants.js";
import { normalizeDomain, uniqueDomains } from "./domain.js";
import { normalizeMode, strongerMode } from "./policy.js";
import { sanitizeLabel } from "./sanitizer.js";

const PROFILE_ID_PATTERN = /^p-[a-z0-9-]{8,64}$/;
const SECURITY_FLAGS = Object.freeze([
  "blockNotifications",
  "blockPopups",
  "blockAutomaticDownloads",
  "blockSuspiciousClipboard",
  "blockSuspiciousDownloads",
  "removeClickOverlays"
]);

function fallbackId() {
  const random = Math.random().toString(36).slice(2);
  return `p-${Date.now().toString(36)}-${random}`.slice(0, 66);
}

export function createProfileId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `p-${uuid}` : fallbackId();
}

export function isValidProfileId(value) {
  return PROFILE_ID_PATTERN.test(String(value || ""));
}

export function createProfile(domainInput, options = {}) {
  const domain = normalizeDomain(domainInput);
  if (!domain) throw new Error("A valid domain is required.");

  const id = isValidProfileId(options.id) ? options.id : createProfileId();
  return {
    id,
    label: sanitizeLabel(options.label, domain),
    domain,
    enabled: options.enabled !== false,
    mode: normalizeMode(options.mode),
    allowedTopLevelDomains: uniqueDomains([domain, ...(options.allowedTopLevelDomains || [])]),
    blockNotifications: options.blockNotifications !== false,
    blockPopups: options.blockPopups !== false,
    blockAutomaticDownloads: options.blockAutomaticDownloads !== false,
    blockSuspiciousClipboard: options.blockSuspiciousClipboard !== false,
    blockSuspiciousDownloads: options.blockSuspiciousDownloads !== false,
    removeClickOverlays: options.removeClickOverlays !== false
  };
}

function intersectAllowlists(domain, profiles) {
  const sets = profiles.map((profile) => new Set(uniqueDomains([
    domain,
    ...(profile.allowedTopLevelDomains || [])
  ])));

  if (!sets.length) return [domain];
  const intersection = [...sets[0]].filter((candidate) => sets.every((set) => set.has(candidate)));
  return uniqueDomains([domain, ...intersection]);
}

function mergeDuplicateProfiles(domain, profiles, usedIds) {
  const candidateId = profiles.map((profile) => profile.id).find((id) => isValidProfileId(id) && !usedIds.has(id));
  const merged = createProfile(domain, {
    id: candidateId,
    label: profiles.map((profile) => profile.label).find(Boolean) || domain,
    enabled: profiles.some((profile) => profile.enabled !== false),
    mode: strongerMode(profiles.map((profile) => profile.mode)),
    allowedTopLevelDomains: intersectAllowlists(domain, profiles)
  });

  for (const flag of SECURITY_FLAGS) {
    merged[flag] = profiles.some((profile) => profile[flag] !== false);
  }

  if (usedIds.has(merged.id)) merged.id = createProfileId();
  usedIds.add(merged.id);
  return merged;
}

export function normalizeConfig(input = {}) {
  const rawProfiles = Array.isArray(input.profiles) ? input.profiles : [];
  const groups = new Map();

  for (const rawProfile of rawProfiles) {
    const domain = normalizeDomain(rawProfile?.domain);
    if (!domain) continue;
    const group = groups.get(domain) || [];
    group.push(rawProfile);
    groups.set(domain, group);
  }

  const usedIds = new Set();
  const profiles = [];
  for (const [domain, group] of groups.entries()) {
    profiles.push(mergeDuplicateProfiles(domain, group, usedIds));
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    revision: Number.isSafeInteger(input.revision) && input.revision >= 0 ? input.revision : 0,
    profiles,
    blockedDomains: uniqueDomains(Array.isArray(input.blockedDomains) ? input.blockedDomains : [])
  };
}

export function createDefaultConfig() {
  return normalizeConfig({
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    profiles: [
      createProfile("cineby.tech", { label: "Cineby", mode: "strict" }),
      createProfile("vumoo.to", { label: "Vumoo", mode: "strict" })
    ],
    blockedDomains: []
  });
}

export function getProfileById(config, profileId) {
  return config.profiles.find((profile) => profile.id === profileId) || null;
}

export function assertUniqueProfileDomain(config, domainInput, excludedProfileId = "") {
  const domain = normalizeDomain(domainInput);
  if (!domain) throw new Error("A valid domain is required.");

  const duplicate = config.profiles.find(
    (profile) => profile.domain === domain && profile.id !== excludedProfileId
  );
  if (duplicate) throw new Error(`A profile already exists for ${domain}.`);
  return domain;
}

export function assertProfileIntegrity(config) {
  const ids = new Set();
  const domains = new Set();

  for (const profile of config.profiles) {
    if (!isValidProfileId(profile.id)) throw new Error(`Invalid profile ID for ${profile.domain}.`);
    if (ids.has(profile.id)) throw new Error(`Duplicate profile ID: ${profile.id}.`);
    if (domains.has(profile.domain)) throw new Error(`Duplicate profile domain: ${profile.domain}.`);
    ids.add(profile.id);
    domains.add(profile.domain);
  }

  return true;
}

export const PROFILE_SECURITY_FLAGS = SECURITY_FLAGS;
