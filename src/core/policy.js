import { MODES } from "./constants.js";

export const MODE_POLICY = Object.freeze({
  normal: Object.freeze({
    blockExternalNavigation: false,
    logExternalNavigation: true,
    recordDecisionCandidate: false,
    blockProtocols: false,
    blockDownloads: false,
    blockClipboard: false,
    scanClickFix: false,
    scanOverlays: false
  }),
  strict: Object.freeze({
    blockExternalNavigation: true,
    logExternalNavigation: true,
    recordDecisionCandidate: false,
    blockProtocols: true,
    blockDownloads: true,
    blockClipboard: true,
    scanClickFix: true,
    scanOverlays: true
  }),
  learn: Object.freeze({
    blockExternalNavigation: true,
    logExternalNavigation: true,
    recordDecisionCandidate: true,
    blockProtocols: true,
    blockDownloads: true,
    blockClipboard: true,
    scanClickFix: true,
    scanOverlays: true
  })
});

export function normalizeMode(input) {
  return MODES.includes(input) ? input : "strict";
}

export function modeStrength(mode) {
  return { normal: 1, strict: 2, learn: 3 }[normalizeMode(mode)];
}

export function strongerMode(modes = []) {
  return modes.reduce(
    (strongest, candidate) => modeStrength(candidate) > modeStrength(strongest) ? normalizeMode(candidate) : strongest,
    "normal"
  );
}

export function getEffectivePolicy(profile) {
  const mode = normalizeMode(profile?.mode);
  const base = MODE_POLICY[mode];

  return Object.freeze({
    mode,
    blockExternalNavigation: base.blockExternalNavigation,
    logExternalNavigation: base.logExternalNavigation,
    recordDecisionCandidate: base.recordDecisionCandidate,
    blockProtocols: base.blockProtocols,
    blockDownloads: base.blockDownloads && profile?.blockSuspiciousDownloads !== false,
    blockClipboard: base.blockClipboard && profile?.blockSuspiciousClipboard !== false,
    scanClickFix: base.scanClickFix,
    scanOverlays: base.scanOverlays && profile?.removeClickOverlays !== false,
    blockNotifications: profile?.blockNotifications !== false,
    blockPopups: profile?.blockPopups !== false,
    blockAutomaticDownloads: profile?.blockAutomaticDownloads !== false
  });
}
