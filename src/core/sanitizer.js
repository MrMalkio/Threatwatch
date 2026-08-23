const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export function sanitizeEventUrl(input) {
  const raw = typeof input === "string" ? input.trim().replace(CONTROL_CHARACTERS, "") : "";
  if (!raw) return "";

  try {
    const parsed = new URL(raw);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      parsed.username = "";
      parsed.password = "";
      parsed.search = "";
      parsed.hash = "";
      return `${parsed.origin}${parsed.pathname}`.slice(0, 500);
    }

    return parsed.protocol.slice(0, 32);
  } catch {
    return "[invalid-url]";
  }
}

export function sanitizeLabel(input, fallback = "Protected site") {
  const label = String(input ?? "")
    .replace(CONTROL_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return label || fallback;
}

export function sanitizeEventType(input) {
  return String(input ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 64).toLowerCase();
}
