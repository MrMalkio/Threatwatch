# Threatwatch

Threatwatch is a Chrome Manifest V3 extension for containing hostile web behavior on sites you choose to protect.

It is built for pages that use click hijacking, popunders, rotating redirect domains, fake verification prompts, suspicious clipboard writes, malicious download lures, invisible click overlays, and abusive permission prompts.

Threatwatch does not depend on a permanent list of ad domains. In Strict and Learn modes, unexpected top-level exits from a protected site are treated as hostile unless you explicitly allow the destination.

## Current status

Version `0.1.0` is a working developer build.

Default protected profiles:

- `cineby.tech` in Strict mode
- `vumoo.to` in Strict mode

You can add or remove sites from the extension UI.

## What it blocks

- Cross-site top-level navigation initiated by protected pages
- Popups and popunders spawned from protected tabs
- `window.open()` attempts to external or blank targets on Strict/Learn sites
- Programmatic external anchor clicks on Strict/Learn sites
- Custom-protocol launches such as `intent:`, `ms-*`, or other non-web schemes
- Suspicious clipboard writes that resemble ClickFix command payloads
- High-risk executable or script downloads initiated from protected pages
- Browser notification prompts, popups, and automatic multi-download permission on protected sites
- Large transparent click-capture overlays when the detector is enabled
- Known domains you place on the global block list

It warns on page text that resembles fake CAPTCHA or ClickFix instructions.

## Modes

### Normal

Blocks known-bad destinations and applies browser permission hardening. Unknown external navigation is logged rather than blanket-blocked.

### Strict

Blocks unexpected external top-level navigation, popups, suspicious downloads, dangerous protocol launches, suspicious clipboard payloads, and hostile overlay patterns.

### Learn

Uses Strict containment for top-level exits, then records attempted destinations so you can decide what to allow or permanently block.

## Install locally

Threatwatch currently targets Chrome 145 or newer.

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository root, the folder containing `manifest.json`.
6. Pin Threatwatch from the Chrome extensions menu.

No build step and no npm install are required to load the extension.

## Development

Node is used only for tests.

```bash
npm test
```

The extension itself is plain JavaScript, HTML, and CSS with no runtime dependencies and no remote code.

## Repository map

```text
Threatwatch/
├── manifest.json
├── src/
│   ├── background.js
│   ├── content-bridge.js
│   ├── page-guard.js
│   ├── clipboard-guard.js
│   ├── download-guard.js
│   ├── core/
│   │   ├── defaults.js
│   │   ├── domain.js
│   │   ├── risk.js
│   │   ├── rules.js
│   │   └── storage.js
│   └── ui/
│       ├── popup.html
│       ├── popup.js
│       ├── options.html
│       ├── options.js
│       └── theme.css
├── docs/
│   ├── SPEC.md
│   ├── THREAT_MODEL.md
│   └── PRIVACY.md
└── tests/
```

## Security model

Threatwatch uses layered containment:

1. Chrome `declarativeNetRequest` rules block external navigation before it completes.
2. A MAIN-world page guard intercepts common page APIs used for popunders and malicious clipboard tricks.
3. An isolated content script watches clicks, downloads, overlays, and ClickFix-style text.
4. `webNavigation.onCreatedNavigationTarget` catches new tabs/windows spawned from protected tabs and closes disallowed ones.
5. Chrome content settings block notifications, popups, and automatic downloads for protected domains.
6. A local event log records what was attempted.

See [docs/SPEC.md](docs/SPEC.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Limits

Threatwatch reduces browser-side abuse. It is not an antivirus product, DNS filter, browser sandbox, or guarantee that a hostile site is safe.

A malicious page can change tactics. Browser exploits, compromised extensions, malicious files opened outside Chrome, social engineering that convinces a user to disable protections, and attacks outside the extension's permission boundary remain possible.

## Privacy

Threatwatch has no telemetry and no server component. Settings and threat events stay in Chrome local extension storage. Logged URLs have query strings and fragments removed before storage.

See [docs/PRIVACY.md](docs/PRIVACY.md).

## License

MIT
