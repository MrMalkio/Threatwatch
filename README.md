# Threatwatch

Threatwatch is a Chrome Manifest V3 extension that contains hostile browser behavior on sites selected by the user.

It targets click hijacking, popunders, rotating redirects, fake verification prompts, suspicious clipboard writes, forced downloads, executable lures, invisible click overlays, and abusive permission prompts.

Version `0.3.0` moves download containment earlier in Chrome's request path. Strict and Learn profiles now intercept common download APIs at `document_start`, block risky network requests before delivery, inspect response headers for forced downloads, then pause and cancel any download that still reaches Chrome's download manager.

## Modes

| Defense | Normal | Strict | Learn |
|---|---:|---:|---:|
| Global block list | Block | Block | Block |
| Notifications, popups, automatic multi-download permission | Block | Block | Block |
| Unknown external web navigation | Log and allow | Block and log | Block, log, mark for review |
| Non-web protocol launch | Allow | Block | Block |
| Download attempts | Allow | Block | Block |
| Suspicious command clipboard write | Allow | Block | Block |
| ClickFix text warning | Off | On | On |
| Transparent click-overlay neutralization | Off | On | On |

Normal mode does not install the MAIN-world download, popup, protocol, or clipboard guards.

## Download containment

Threatwatch uses several checkpoints on Strict and Learn profiles:

1. A MAIN-world guard runs at `document_start` and intercepts download anchors, risky links, programmatic anchor clicks, risky form submissions, save pickers, existing file-handle writes, legacy save APIs, and risky `window.open()` targets.
2. Dynamic Declarative Net Request rules block known risky filename extensions before the request is delivered.
3. Response-header rules block `Content-Disposition: attachment`, risky attachment filenames, dangerous executable MIME types, and forced-download MIME types before Chrome keeps the response body as a download.
4. The navigation monitor identifies risky top-level download URLs and preserves the protected source context across spawned tabs.
5. The downloads monitor pre-pauses known protected downloads, runs at both creation and filename determination, cancels the item, and removes a file that raced to completion when Chrome exposes one.
6. A local notice and threat event record what Threatwatch stopped.

This is browser containment, not antivirus replacement. Chrome extensions cannot promise they will always act before endpoint security, the operating system, another browser extension, or a browser defect. The first three checkpoints are designed to stop common attempts before a file reaches Chrome's completed-download path.

## Default profiles

- `cineby.tech`, Strict
- `vumoo.to`, Strict

Profiles can be added, removed, disabled, switched between modes, and assigned explicit top-level destination allowlists.

## Install locally

Threatwatch requires Chrome 145 or newer.

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository root containing `manifest.json`.
6. Pin Threatwatch from the extensions menu.
7. Open Threatwatch settings and confirm protection health reads `healthy`.

After pulling an update, select **Reload** on the extension card before testing it.

## Development

No runtime package install or build step is required.

```bash
npm run check
```

The check command runs syntax validation, policy tests, guard tests, manifest checks, and documentation checks.

## Repository map

```text
Threatwatch/
├── manifest.json
├── README.md
├── LICENSE
├── src/
│   ├── background.js
│   ├── content-bridge.js
│   ├── page-guard.js
│   ├── download-guard.js
│   ├── clipboard-guard.js
│   ├── shared/
│   │   └── download-policy-data.js
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
│   └── ui/
│       ├── options.html
│       ├── options.js
│       ├── popup.html
│       ├── popup.js
│       └── theme.css
├── docs/
│   ├── ARCHITECTURE.md
│   ├── EVENT_SCHEMA.md
│   ├── PRIVACY.md
│   ├── SPEC.md
│   ├── TESTING.md
│   └── THREAT_MODEL.md
└── tests/
    ├── check-syntax.js
    ├── core.test.js
    ├── docs.test.js
    ├── guards.test.js
    └── smoke.test.js
```

## Documentation

- [Specification](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Event schema](docs/EVENT_SCHEMA.md)
- [Testing](docs/TESTING.md)
- [Privacy](docs/PRIVACY.md)

## Privacy

Threatwatch has no telemetry and no server component. Configuration and threat events stay in Chrome local extension storage. Persisted URLs have credentials, query strings, fragments, control characters, and non-web payloads removed.

## License

MIT
