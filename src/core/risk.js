import { RISKY_EXTENSIONS } from "./constants.js";

export function stripUrlSuffix(input = "") {
  return String(input || "").split(/[?#]/, 1)[0].toLowerCase();
}

export function hasRiskyExtension(input = "") {
  const candidate = stripUrlSuffix(input);
  return RISKY_EXTENSIONS.some((extension) => candidate.endsWith(extension));
}
