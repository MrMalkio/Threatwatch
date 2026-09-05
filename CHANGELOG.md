# Changelog

All material Threatwatch changes should be recorded here. Git history remains the source of truth for individual commits.

## 2026-09-05 - Public website and documentation

### Added

- Static public website in `website/`.
- Product homepage using the Threatwatch watch-and-watch visual concept.
- Help center with installation, mode, download, and false-positive guides.
- FAQ covering privacy, permissions, endpoint security, downloads, site profiles, legal scope, and community plans.
- Public safety model.
- Privacy Policy, Terms of Use, and Acceptable Use Policy.
- GitHub Pages deployment workflow.
- Public security and contribution guidance.
- Legal review checklist for commercial and community launch.
- Website regression tests.

## 0.4.0 - 2026-09-05

### Changed

- Replaced full site-profile cards with a compact watchlist.
- Added profile search, mode filtering, paused filtering, and activity, name, event-count, and mode sorting.
- Added bounded profile and event scrolling.
- Added expandable per-site controls.
- Redesigned settings and popup around the Threatwatch TV-monitoring theme.
- Added watchlist, active-profile, shielded-profile, and local-catch totals.
- Added accessibility and reduced-motion support.

### Validation

- 31 repository checks passed.

Release commit: `dcdec479cbfc72b6f0c51f0f9ad1744069f70efb`

## 0.3.0 - 2026-09-05

### Added

- MAIN-world download containment at `document_start`.
- Pre-request DNR rules for risky filenames.
- Response-header rules for forced attachments, dangerous filenames, and selected dangerous MIME patterns.
- Source-context preservation across spawned tabs.
- Immediate download pause and cancellation fallback.
- Filename-determination retry for late attribution.
- Best-effort residual file cleanup and local download-block notice.

### Validation

- 25 repository checks passed.

Release commit: `baea8e68390bbcec9679e2c735783dd364e4551d`

## 0.2.0 - 2026-08-23

### Fixed

- Normal, Strict, and Learn policy separation.
- Persistence-boundary URL sanitization.
- Blank popup variants and non-web protocol handling.
- Canonical profile deduplication and collision-safe script IDs.
- Fail-closed registered-script replacement.
- Configuration and event write races.
- ClickFix and overlay scan continuation.
- Navigation logging and committed-escape detection.

### Changed

- Split service-worker responsibilities into background and core modules.
- Added architecture, privacy, threat-model, event-schema, and testing docs.
- Replaced whole-state saves with named mutation commands.

Remediation commit: `3bebcb09ce257d37e75cd3a1972fc1f667a79ee6`

## 0.1.0 - 2026-08-22

### Added

- Chrome Manifest V3 project skeleton.
- Threatwatch service worker.
- Initial popup and settings interface.
- MAIN-world popup guard.
- ClickFix clipboard guard.
- Isolated protection bridge.
- Initial DNR containment and local threat-event logging.
- Site profiles and watch modes.
- Engineering specification, smoke tests, and CI.

First project commit: `d1d1910179edfca899fb8f0e8f8106ae6cdfd782`
