# Threatwatch 0.3 Specification

## Goal

Threatwatch contains hostile browser behavior on sites the user explicitly protects. It is meant for pages that steal clicks, spawn rotating redirects, display fake verification flows, abuse browser permissions, or try to place files on the device.

## Mode contract

### Normal

- Apply the global domain block list.
- Block notifications, popups, and automatic multi-download permission when the profile flags request it.
- Log unknown external web navigation and allow it.
- Do not install MAIN-world protocol, download, or clipboard guards.
- Do not block downloads, custom protocols, ClickFix flows, or overlays.

### Strict

- Apply every Normal permission control.
- Block unknown external top-level navigation.
- Block non-web protocols.
- Block download attempts.
- Block suspicious command clipboard writes.
- Warn on ClickFix-style instructions.
- Neutralize likely transparent click overlays.

### Learn

- Use Strict containment.
- Mark unexpected navigation records as decision candidates.

## Download policy

When `blockSuspiciousDownloads` is enabled under Strict or Learn, the effective behavior is download lockdown for the protected browsing context.

### Pre-interaction and page API controls

The MAIN-world guard must run at `document_start` in every matching frame and stop:

- anchors carrying the `download` attribute
- risky executable, script, archive, disk-image, package, macro, or extension URLs
- programmatic `HTMLAnchorElement.click()` calls for those targets
- form submissions to risky targets
- `showSaveFilePicker()` and `showDirectoryPicker()`
- `FileSystemFileHandle.createWritable()`
- legacy browser save APIs
- `document.execCommand("SaveAs")`
- risky HTTP or HTTPS targets passed to `window.open()`

The guard must report through the isolated content bridge. A reporting failure must not restore the blocked call.

### Network controls

For each enabled Strict or Learn profile, dynamic rules must:

- block risky filename extensions in request URLs
- recognize single-encoded and double-encoded extension separators
- cover top-level navigation, frames, XHR, objects, and other network requests
- apply from both the request initiator and the protected top-level domain
- block responses whose `Content-Disposition` declares an attachment
- block responses whose disposition filename carries a risky extension
- block executable or forced-download MIME types

Normal profiles must receive none of these download rules.

### Download-manager fallback

Any download that still reaches `chrome.downloads` from a protected Strict or Learn context must be contained regardless of apparent file type.

The monitor must:

1. Use cached configuration and in-memory tab provenance for the fastest available pause.
2. Resolve attribution from referrer, remembered tab context, the live tab, and its opener.
3. invoke pause and cancel without waiting for one to finish before starting the other.
4. run from both `downloads.onCreated` and `downloads.onDeterminingFilename`.
5. remove a file that raced to completion when Chrome exposes one.
6. notify the originating tab.
7. persist a sanitized threat event.

## Source-context preservation

When a protected page spawns a new tab, Threatwatch must remember the protected source against the new tab before attempting to close it. This permits download attribution during short races between tab creation, download creation, and tab closure.

## Event requirements

Download events use type `dangerous-download` and may carry these actions:

- `blocked`
- `paused`
- `cancelled`
- `removed`

The service worker controls severity, action validation, and detail text. URL queries, fragments, credentials, malformed raw input, and non-web payloads must not be persisted.

## Acceptance checks

- A user click on an anchor with `download` never reaches the native click method under Strict or Learn.
- A script-created risky anchor cannot invoke the native click method.
- A risky form target cannot reach native submit methods.
- Save picker and existing file-handle write calls reject before the native method runs.
- Risky `window.open()` targets are rejected.
- DNR rules exist for risky URL and response-header patterns under Strict and Learn.
- Normal has no download DNR rules and no MAIN-world download guard.
- A created protected download is paused and cancelled.
- Filename determination remains pending until containment has run.
- Spawned-tab provenance is available to the download monitor.
- A visible notice appears for blocked or cancelled downloads.
- No residual-file cleanup error crashes the worker.

## Limits

Threatwatch is not an endpoint scanner, kernel filter, DNS service, or malware sandbox. It cannot promise precedence over endpoint security or stop files created outside the monitored Chrome profile. Network responses generated from a service worker cache may bypass DNR, so the page guard and downloads monitor remain required.
