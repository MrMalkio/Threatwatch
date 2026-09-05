# Architecture

## Protection sequence

Threatwatch uses an early-to-late containment sequence:

1. MAIN-world interception at `document_start`
2. Declarative Net Request blocking before or at response headers
3. browser navigation correlation
4. Chrome download-manager pause and cancellation
5. residual completed-file removal after a cancellation race
6. local event logging and user notice

The later layers are fallbacks. They do not replace the earlier controls.

## Shared download policy

`src/shared/download-policy-data.js` is a classic script that places an immutable download policy object on `globalThis`.

It is used in two places:

- imported by `src/core/constants.js` for service-worker rule generation and tests
- injected before MAIN-world guards so page scripts and background logic use one extension and MIME definition set

This prevents the extension lists from drifting across the service worker and page guards.

## Core modules

`src/core/constants.js` owns storage keys, event definitions, rule ranges, and shared download policy exports.

`src/core/domain.js` owns canonical domain and URL matching.

`src/core/policy.js` owns the mode contract and effective profile policy.

`src/core/profiles.js` owns profile creation, migration, deduplication, and identity checks.

`src/core/risk.js` classifies filename, URL, MIME, and Chrome danger signals and builds network-rule patterns.

`src/core/rules.js` builds DNR rules and persistent MAIN-world script registrations.

`src/core/sanitizer.js` sanitizes persisted URLs and labels.

## Background modules

`src/background.js` routes commands and coordinates configuration transactions.

`src/background/storage.js` owns migration and separate config, event, and runtime records.

`src/background/protection.js` registers and verifies scripts, updates DNR, reconciles content settings, and reports health.

`src/background/events.js` validates, sanitizes, deduplicates, and persists events.

`src/background/navigation.js` keeps in-memory plus session tab provenance, records navigation attempts, closes spawned tabs, and flags committed escapes.

`src/background/download-monitor.js` preloads configuration, pre-pauses downloads from known protected contexts, resolves source ancestry, pauses and cancels download items, and removes residual files that raced to completion.

## Page layers

`src/content-bridge.js` runs in Chrome's isolated extension world on HTTP and HTTPS pages. It activates only after the service worker returns an enabled profile and effective policy. It logs page observations and presents local warnings.

`src/page-guard.js` runs in the page's MAIN world on Strict and Learn profiles. It blocks blank popup targets, non-web protocols, and risky web targets before native `window.open()` runs.

`src/download-guard.js` runs in the page's MAIN world on Strict and Learn profiles with download blocking enabled. It intercepts user and programmatic save paths before native page APIs run.

`src/clipboard-guard.js` runs in the page's MAIN world on Strict and Learn profiles with clipboard protection enabled.

## Protection synchronization

Desired scripts are registered and verified before stale scripts are removed. Dynamic-rule updates are atomic. Configuration is persisted only after the candidate protection set is ready. A cleanup failure may leave extra protection installed rather than removing a working guard.
