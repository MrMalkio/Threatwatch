# Threatwatch

Threatwatch is a Chrome Manifest V3 extension that watches streaming sites for hostile browser behavior.

It targets click hijacking, popunders, rotating redirects, fake verification prompts, suspicious clipboard writes, forced downloads, executable lures, invisible click overlays, and abusive permission prompts.

Version `0.4.0` adds a compact watchlist and a visual system built around the product idea: watching for threats while the user watches TV and movies. Site profiles stay collapsed until opened, support search, mode filters, activity sorting, event counts, and a contained scroll area.

## Public website

The static public website lives in [`website/`](website/README.md). It includes:

- product homepage
- installation and help guides
- watch-mode and download documentation
- false-positive guidance
- FAQ
- public safety model
- release changelog
- Privacy Policy
- Terms of Use
- Acceptable Use Policy

The site has no Threatwatch analytics, remote JavaScript, external fonts, or advertising scripts. `.github/workflows/pages.yml` is ready to publish the `website/` directory through GitHub Pages once Pages is enabled with GitHub Actions as the source.

See [`CHANGELOG.md`](CHANGELOG.md) for product history and [`docs/LEGAL_REVIEW_CHECKLIST.md`](docs/LEGAL_REVIEW_CHECKLIST.md) before a paid, account-based, or community-backend launch.

## Interface

The settings page is organized like a monitoring control room rather than a long configuration form.

- Compact site rows keep large watchlists manageable.
- Search matches display names and domains.
- Filters isolate Strict, Learn, Normal, and paused profiles.
- Sorting supports recent activity, name, event count, and mode.
- Per-site controls open inline only when requested.
- The page shows watchlist, active-profile, shielded-profile, and local-event totals.
- Add-site and global-block tools live in collapsible side panels.
- Recent events use their own bounded table.
- The popup uses the same screen, signal, playback, and alert language as the settings page.
- Reduced-motion preferences disable decorative motion.

The theme uses original CSS and local HTML only. It loads no remote fonts, scripts, or artwork.

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

This is browser containment, not antivirus replacement. Chrome extensions cannot promise they will always act before endpoint security, the operating system, another browser extension, or a browser defect.

## Default profiles

- `cineby.tech`, Strict
- `vumoo.to`, Strict

Profiles can be added, removed, disabled, switched between modes, and assigned explicit top-level destination allowlists. A profile is a protection configuration, not an endorsement or safety certification.

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

The check command runs syntax validation, policy tests, guard tests, interface checks, website checks, manifest checks, and documentation checks.

## Repository map

```text
Threatwatch/
├── manifest.json
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
├── website/
│   ├── index.html
│   ├── help/
│   ├── faq/
│   ├── safety/
│   ├── changelog/
│   ├── legal/
│   └── assets/
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
│   ├── LEGAL_REVIEW_CHECKLIST.md
│   ├── PRIVACY.md
│   ├── SPEC.md
│   ├── TESTING.md
│   └── THREAT_MODEL.md
└── tests/
    ├── check-syntax.js
    ├── core.test.js
    ├── docs.test.js
    ├── guards.test.js
    ├── smoke.test.js
    ├── ui.test.js
    └── website.test.js
```

## Engineering documentation

- [Specification](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Event schema](docs/EVENT_SCHEMA.md)
- [Testing](docs/TESTING.md)
- [Engineering privacy notes](docs/PRIVACY.md)
- [Public release legal checklist](docs/LEGAL_REVIEW_CHECKLIST.md)

## Privacy

Threatwatch 0.4.0 has no telemetry backend. Configuration, watchlist preferences, and threat events stay inside the browser. Persisted threat URLs have credentials, query strings, fragments, control characters, and non-web payloads removed.

The public-facing policy is [`website/legal/privacy.html`](website/legal/privacy.html).

## License

MIT
