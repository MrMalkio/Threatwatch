# Threatwatch 0.2 Specification

## Goal

Threatwatch contains hostile browser behavior on sites the user explicitly protects. It is meant for pages that hijack early clicks, spawn rotating redirect domains, push fake verification flows, abuse permissions, create transparent click overlays, or attempt risky downloads.

## Mode contract

### Normal

- Applies the global domain block list.
- Applies browser permission hardening configured on the profile.
- Logs unexpected external HTTP and HTTPS top-level navigation.
- Allows that navigation to proceed.
- Does not run protocol, risky-download, command-clipboard, ClickFix, or overlay defenses.
- Does not register the MAIN-world popup or clipboard guards.

### Strict

- Includes the global block list and permission hardening.
- Blocks and logs unexpected external top-level navigation.
- Blocks blank popup variants and non-web protocols.
- Blocks risky executable and script downloads.
- Blocks suspicious command clipboard writes.
- Warns on ClickFix-style visible text.
- Neutralizes likely transparent click overlays.

### Learn

- Uses the same containment behavior as Strict.
- Marks external navigation and spawned-navigation events as decision candidates.
- Records destinations observed before DNR prevents commit.

## Profiles

- Canonical domains are unique.
- Profile IDs are created and validated by the service worker.
- The profile domain is immutable. A domain change requires removing and recreating the profile.
- Duplicate domains in legacy state are merged during migration.
- Duplicate legacy allowlists are intersected rather than united.
- Registered content-script IDs are generated from validated unique profile IDs.

## Configuration mutation

The options page and popup may not replace the full state object. They send named mutation commands:

- `profile.create`
- `profile.update`
- `profile.delete`
- `allowlist.add`
- `allowlist.remove`
- `blocklist.add`
- `blocklist.remove`
- `events.clear`
- `protection.retry`

Configuration and event records use separate storage keys and separate serialized mutation queues.

## Protection synchronization

1. Normalize and validate the candidate configuration.
2. Register missing MAIN-world scripts without removing old guards.
3. Update changed registered scripts without unregistering them first.
4. Query registered scripts and verify every desired definition.
5. Replace Threatwatch-owned DNR rules in one dynamic-rule update.
6. Reconcile browser content settings.
7. Persist the candidate configuration.
8. Remove stale registered scripts.
9. Mark runtime health healthy.

If setup fails before persistence, the previous configuration remains active and old guards remain registered. Failures set runtime health to degraded and create a local `protection-error` event.

## Navigation logging

The content bridge records click-driven exits. Browser navigation listeners cover script and redirect-driven exits.

- `onBeforeNavigate` compares the target with the last committed protected context.
- Normal records the attempt as observed.
- Strict and Learn record the attempt as blocked.
- Learn marks the event as a decision candidate.
- `onCommitted` emits `escape-committed` when an external target still commits from Strict or Learn.
- `onCreatedNavigationTarget` closes disallowed spawned tabs in Strict and Learn and records them in all modes.

Event deduplication collapses matching content-layer and navigation-layer reports within a short window.

## URL persistence

Every event URL passes through the background sanitizer immediately before storage.

- HTTP and HTTPS credentials are removed.
- HTTP and HTTPS query strings are removed.
- HTTP and HTTPS fragments are removed.
- Non-web targets retain only their scheme.
- Control characters are removed.
- Malformed values are stored as `[invalid-url]`.
- The caller's raw malformed value is never used as a fallback.

## Popup handling

Strict and Learn block:

- empty targets
- whitespace-only targets
- `about:blank`
- `about:blank` with query or fragment variants
- `about:srcdoc`
- `mailto:`
- `tel:`
- `javascript:`
- `data:`
- `file:`
- custom protocols
- invalid popup targets

Normal does not register this guard.

## ClickFix and overlay scanning

A ClickFix warning may be shown once per document. That warning state does not disable future scans.

The overlay loop skips already-neutralized elements with `continue`. It does not return from the full scan. Threatwatch UI and its descendants are excluded.

A candidate overlay must:

- use fixed or absolute positioning
- accept pointer events
- cover most of the viewport
- have a high z-index
- be nearly invisible or transparent with little visible text

The node is not deleted. Pointer events are disabled.

## Acceptance checks

- Internal navigation works in every mode.
- Normal logs and allows unknown external web navigation.
- Normal does not activate protocol, risky-download, clipboard, ClickFix, or overlay defenses.
- Strict and Learn block unknown external top-level web navigation.
- Learn records blocked destinations as decision candidates.
- Explicitly allowed destination domains work.
- Blank popup variants are blocked in Strict and Learn.
- Non-web protocols are blocked in Strict and Learn.
- Risky links and downloads are blocked only in Strict and Learn.
- Suspicious clipboard writes are rejected only in Strict and Learn.
- ClickFix warning state does not stop overlay scans.
- One neutralized element does not stop later overlay checks.
- Duplicate profile input cannot disable registered guards.
- A registration error leaves old guards registered.
- Concurrent event and configuration writes cannot overwrite each other.
- Stored event URLs contain no HTTP query, fragment, or credential data.
- All documented repository paths exist.
