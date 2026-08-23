# Architecture

## Core modules

`src/core` contains browser-independent policy and data functions:

- `constants.js`: storage keys, event types, risky extensions, rule ranges
- `domain.js`: domain and URL matching
- `policy.js`: mode contract and effective policy
- `profiles.js`: profile creation, migration, deduplication, and identity checks
- `risk.js`: risky extension matching
- `rules.js`: DNR and registered-script generation
- `sanitizer.js`: persisted URL and label sanitization

## Background modules

`src/background.js` is the command router and configuration transaction coordinator.

`src/background/storage.js` owns migration and separate config, event, and runtime records.

`src/background/protection.js` registers scripts, verifies them, updates DNR, reconciles content settings, and reports health.

`src/background/events.js` validates, sanitizes, deduplicates, and persists events.

`src/background/navigation.js` records navigation attempts, spawned tabs, committed escapes, and per-tab context.

`src/background/download-monitor.js` cancels risky downloads when the effective profile policy permits it.

## Page layers

`src/content-bridge.js` runs in Chrome's isolated extension world on HTTP and HTTPS pages. It activates only when the background returns an active profile.

`src/page-guard.js` runs in the page's MAIN world only for Strict and Learn profiles. It blocks blank popup variants and non-web protocols.

`src/clipboard-guard.js` runs in the page's MAIN world only for Strict and Learn profiles with command-clipboard protection enabled.

## Configuration transaction

The service worker accepts named mutation commands instead of full-state replacement. Each configuration mutation is serialized.

The new protection set is prepared before the candidate configuration is persisted. Stale scripts are removed after persistence. Event writes use a different key and queue, so an event append cannot restore stale settings.
