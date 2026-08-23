# Threatwatch

Threatwatch is a Chrome Manifest V3 extension that contains hostile browser behavior on sites the user selects.

It targets click hijacking, popunders, rotating redirect domains, fake verification prompts, suspicious clipboard writes, executable download lures, invisible click overlays, and abusive permission prompts.

Version `0.2.0` repairs the state, mode, logging, profile-collision, script-registration, URL-sanitization, popup, and overlay defects found in the first audit.

## Modes

| Defense | Normal | Strict | Learn |
|---|---:|---:|---:|
| Global block list | Block | Block | Block |
| Notifications, popups, automatic multi-download permission | Block | Block | Block |
| Unknown external web navigation | Log and allow | Block and log | Block, log, mark for review |
| Non-web protocol launch | Allow | Block | Block |
| Suspicious executable or script download | Allow | Block | Block |
| Suspicious command clipboard write | Allow | Block | Block |
| ClickFix text warning | Off | On | On |
| Transparent click-overlay neutralization | Off | On | On |

Normal mode does not run the MAIN-world popup or clipboard guards.

## Default profiles

- `cineby.tech`, Strict
- `vumoo.to`, Strict

Duplicate canonical domains are rejected. Profile IDs are created by the service worker and checked for uniqueness before registered scripts or DNR rules are generated.

## Protection layers

1. Chrome dynamic DNR rules block unexpected top-level exits from Strict and Learn profiles.
2. A MAIN-world guard blocks blank popup variants and non-web protocols on Strict and Learn profiles.
3. A separate MAIN-world guard blocks suspicious command clipboard writes on Strict and Learn profiles when enabled.
4. The isolated content bridge applies the mode matrix, logs Normal-mode exits, blocks risky links in Strict and Learn, warns on ClickFix text, and neutralizes likely click overlays.
5. Browser navigation listeners record attempts stopped before commit and flag any external navigation that still commits from Strict or Learn.
6. The download monitor cancels risky executable or script downloads only when the profile policy permits that defense.
7. Chrome content settings block notifications, popups, and automatic multi-download permission for enabled profiles.

## Install locally

Threatwatch requires Chrome 145 or newer.

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository root, which contains `manifest.json`.
6. Pin Threatwatch from the Chrome extensions menu.

The extension has no runtime package dependencies and loads without a build step.

## Test

Node 22 is used by CI.

```bash
npm run check
```

The check command validates JavaScript syntax, the manifest, mode behavior, profile normalization, DNR and script ID uniqueness, URL sanitization, popup variants, scanner regressions, documentation links, and the removal of whole-state settings writes.

## Repository map

```text
Threatwatch/
├── .github/workflows/ci.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── EVENT_SCHEMA.md
│   ├── PRIVACY.md
│   ├── SPEC.md
│   ├── TESTING.md
│   └── THREAT_MODEL.md
├── src/
│   ├── background/
│   │   ├── download-monitor.js
│   │   ├── events.js
│   │   ├── navigation.js
│   │   ├── protection.js
│   │   └── storage.js
│   ├── core/
│   │   ├── constants.js
│   │   ├── domain.js
│   │   ├── policy.js
│   │   ├── profiles.js
│   │   ├── risk.js
│   │   ├── rules.js
│   │   └── sanitizer.js
│   ├── ui/
│   │   ├── options.html
│   │   ├── options.js
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── theme.css
│   ├── background.js
│   ├── clipboard-guard.js
│   ├── content-bridge.js
│   └── page-guard.js
├── tests/
│   ├── check-syntax.js
│   ├── core.test.js
│   ├── docs.test.js
│   ├── guards.test.js
│   └── smoke.test.js
├── LICENSE
├── manifest.json
├── package.json
└── README.md
```

## State and failure handling

Configuration, events, and runtime health use separate Chrome storage keys. Configuration writes use one mutation queue. Event appends and clears use a second queue, so event traffic cannot replace profile settings.

A protection update registers and verifies missing MAIN-world scripts before stale guards are removed. DNR rules are replaced atomically. The active configuration is written only after the new protection set is ready. A failed registration leaves the previous guards in place and marks runtime health as degraded.

## Privacy

Threatwatch has no telemetry, server, remote code, or externally connectable API. Event URLs are sanitized at the persistence boundary. HTTP and HTTPS queries, fragments, and credentials are removed. Non-web schemes retain the scheme only. Malformed values become `[invalid-url]`.

See [Privacy](docs/PRIVACY.md), [Threat model](docs/THREAT_MODEL.md), and [Event schema](docs/EVENT_SCHEMA.md).

## Limits

Threatwatch reduces selected browser-side abuse. It is not antivirus software, DNS filtering, an endpoint sandbox, or proof that a hostile site is safe. Browser defects, malicious extensions with broader permissions, unsafe user exceptions, malicious files opened outside Chrome, and tactics outside the monitored behaviors remain possible.

## License

MIT
