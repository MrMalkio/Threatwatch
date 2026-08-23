export function normalizeDomain(input = "") {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!parsed.hostname || parsed.username || parsed.password || parsed.port) return "";

    const hostname = parsed.hostname.replace(/^www\./, "").replace(/\.$/, "");
    if (!hostname || hostname.includes("*") || hostname.length > 253) return "";
    return hostname;
  } catch {
    return "";
  }
}

export function hostnameFromUrl(input = "") {
  try {
    return new URL(String(input)).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function matchesDomain(hostname, domain) {
  const normalizedHost = String(hostname || "").toLowerCase().replace(/\.$/, "");
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedHost || !normalizedDomain) return false;
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

export function uniqueDomains(inputs = []) {
  return [...new Set(inputs.map(normalizeDomain).filter(Boolean))];
}

export function findProfileForUrl(config, url, options = {}) {
  const hostname = hostnameFromUrl(url);
  if (!hostname) return null;
  const enabledOnly = options.enabledOnly !== false;
  return config.profiles.find((profile) => (enabledOnly ? profile.enabled : true) && matchesDomain(hostname, profile.domain)) || null;
}

export function isAllowedTopLevelUrl(url, profile) {
  const hostname = hostnameFromUrl(url);
  if (!hostname) return false;

  const allowedDomains = uniqueDomains([
    profile.domain,
    ...(profile.allowedTopLevelDomains || [])
  ]);

  return allowedDomains.some((domain) => matchesDomain(hostname, domain));
}

export function isWebUrl(input) {
  try {
    const parsed = new URL(String(input));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
