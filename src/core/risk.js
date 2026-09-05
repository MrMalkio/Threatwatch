import {
  DANGEROUS_MIME_PATTERNS,
  FORCED_DOWNLOAD_MIME_PATTERNS,
  RISKY_EXTENSIONS
} from "./constants.js";

function decodeRepeatedly(value) {
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function stripUrlSuffix(input = "") {
  const raw = String(input || "").split(/[?#]/, 1)[0].replace(/\\/g, "/").toLowerCase();
  return decodeRepeatedly(raw);
}

export function hasRiskyExtension(input = "") {
  const candidate = stripUrlSuffix(input);
  return RISKY_EXTENSIONS.some((extension) => candidate.endsWith(extension));
}

function wildcardPrefixMatch(value, pattern) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const normalizedPattern = String(pattern || "").trim().toLowerCase();
  if (!normalizedValue || !normalizedPattern) return false;
  if (normalizedPattern.endsWith("*")) {
    return normalizedValue.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedValue === normalizedPattern;
}

export function isDangerousMime(mime = "") {
  return DANGEROUS_MIME_PATTERNS.some((pattern) => wildcardPrefixMatch(mime, pattern));
}

export function isForcedDownloadMime(mime = "") {
  return FORCED_DOWNLOAD_MIME_PATTERNS.some((pattern) => wildcardPrefixMatch(mime, pattern));
}

export function browserMarkedDownloadDangerous(danger = "") {
  const normalized = String(danger || "").trim().toLowerCase();
  return Boolean(normalized && !["safe", "accepted"].includes(normalized));
}

export function classifyDownloadCandidate(item = {}) {
  const candidates = [
    item.filename,
    item.finalUrl,
    item.url
  ].filter(Boolean);

  const riskyExtension = candidates.some(hasRiskyExtension);
  const dangerousMime = isDangerousMime(item.mime);
  const forcedDownloadMime = isForcedDownloadMime(item.mime);
  const browserDanger = browserMarkedDownloadDangerous(item.danger);

  return Object.freeze({
    risky: riskyExtension || dangerousMime || forcedDownloadMime || browserDanger,
    riskyExtension,
    dangerousMime,
    forcedDownloadMime,
    browserDanger
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildRiskyDownloadRegex() {
  const extensions = RISKY_EXTENSIONS
    .map((extension) => extension.replace(/^\./, ""))
    .map(escapeRegex)
    .sort((left, right) => right.length - left.length);

  return `(?:\\.|%2e|%252e)(?:${extensions.join("|")})(?:$|[/?&#;]|%00|%2f|%3f|%23|%26|%3b|%5c|%2500|%252f|%253f|%2523|%2526|%253b|%255c)`;
}

export function buildRiskyContentDispositionPatterns() {
  const patterns = ["*attachment*"];

  for (const extension of RISKY_EXTENSIONS) {
    patterns.push(`*filename*${extension}*`);
    patterns.push(`*filename*%2e${extension.slice(1)}*`);
  }

  return Object.freeze([...new Set(patterns)]);
}
