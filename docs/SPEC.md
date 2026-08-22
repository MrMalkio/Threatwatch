# Threatwatch V1 Spec

## Goal

Threatwatch contains hostile browser behavior on sites the user explicitly protects. It is designed for sites that hijack early clicks, spawn rotating redirect domains, push fake verification flows, abuse notifications, create invisible click overlays, or attempt suspicious downloads.

## Protection modes

- **Normal**: permission hardening plus the global block list. Does not blanket-block unknown external navigation.
- **Strict**: blocks unexpected external top-level navigation and adds popup, protocol, clipboard, download, ClickFix, and overlay defenses.
- **Learn**: uses Strict containment and records attempted destinations so the user can decide what to allow or block.

## V1 layers

1. `declarativeNetRequest` dynamic rules block cross-site main-frame navigation from Strict/Learn profiles.
2. A second DNR rule uses `topDomains` to cover escapes initiated by third-party frames under a protected top-level page.
3. `webNavigation.onCreatedNavigationTarget` closes new tabs/windows spawned from a protected source tab when the destination is not allowed.
4. MAIN-world guards intercept blank `window.open()` popunder patterns, non-web protocol launches, and suspicious clipboard writes.
5. An isolated content script captures external link escapes, dangerous download links, fake ClickFix copy, and likely transparent click-capture overlays.
6. Chrome content settings block notifications, popups, and automatic multi-download permission for protected domains.
7. The download monitor cancels high-risk executable/script downloads with a protected referrer.
8. A local event log stores action, type, time, source, target, and detail with URL query strings/fragments stripped.

## Default profiles

- `cineby.tech`, Strict
- `vumoo.to`, Strict

Profiles can be added, removed, disabled, switched between modes, and given explicit top-level destination allowlists.

## High-risk download extensions

Threatwatch V1 blocks or cancels common executable/script formats including `.exe`, `.msi`, `.msix`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.js`, `.scr`, `.hta`, `.reg`, `.lnk`, `.jar`, `.apk`, `.dmg`, and `.pkg` when initiated from protected pages.

## ClickFix handling

Threatwatch warns when visible page text resembles verification instructions that tell the user to open Windows Run or paste a command. It blocks clipboard writes containing command patterns such as PowerShell, `cmd /c`, `mshta`, `rundll32`, `regsvr32`, `certutil`, script hosts, `Invoke-Expression`, or encoded-command indicators.

## Overlay heuristic

A likely click-capture overlay is neutralized only when it is fixed/absolute, covers most of the viewport, has a high z-index, accepts pointer events, and is visually hidden through very low opacity or transparent styling with almost no text. Threatwatch disables pointer events rather than deleting the node.

## Security constraints

- Manifest V3 only.
- No remote code or telemetry.
- No externally connectable API.
- Privileged configuration decisions stay in the service worker.
- Page-world messages can report observations but cannot alter settings or allowlists.
- Imported/stored domains are normalized before rule generation.
- Event URLs are sanitized before persistence.

## Chrome version

V1 requires Chrome 145+ so the DNR `topDomains` condition is available. Chrome 151 satisfies this requirement.

## Known limits

Threatwatch is not antivirus, DNS filtering, a malware sandbox, or a guarantee that a hostile site is safe. It does not stop browser zero-days, endpoint malware, malicious extensions with stronger privileges, unsafe user-approved exceptions, or attacks outside the monitored browser behaviors.

## Acceptance checks

- Internal navigation on a Strict profile still works.
- Unknown external top-level navigation is blocked.
- Explicitly allowlisted destinations work.
- Blank popunders are blocked.
- Spawned disallowed tabs/windows are closed.
- Non-web protocol launches are blocked.
- High-risk download links are blocked/cancelled.
- Suspicious command clipboard writes are rejected.
- ClickFix-style verification copy produces a warning.
- Likely transparent click overlays lose pointer events.
- Notifications, popups, and automatic downloads are blocked for enabled profiles.
- Event logs do not retain query strings or fragments.

## Next iteration

- One-click Allow/Block actions on individual threat-log events.
- Temporary exceptions with expiry.
- Better registrable-domain/public-suffix handling.
- Optional signed threat-intelligence feeds.
- Side-panel live event stream.
- Export to DNS/Pi-hole/Cloudflare-style block lists.
