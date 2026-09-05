# Threat Model

## Protected assets

Threatwatch seeks to protect:

- the user's click intent
- the current browsing context
- browser permission settings
- the clipboard from command-payload injection
- the device from forced or disguised downloads
- local Threatwatch configuration
- the local threat-event record

## Expected hostile download behavior

Threatwatch assumes a protected page may:

- add or remove a download attribute immediately before a click
- call a cached or native anchor click method
- submit a form to a forced-download response
- hide executable extensions behind URL encoding or query strings
- return a dangerous MIME type from a harmless-looking URL
- use `Content-Disposition` to force an attachment
- open a short-lived tab and begin a download before the tab closes
- omit a referrer or use `noopener`
- create a blob URL and invoke a save API
- request a file or directory handle and write to it
- trigger several downloads in a short burst
- rely on a service worker or cache path that does not reach DNR
- race Chrome's download manager and endpoint security

## Trust boundaries

The hostile page, its frames, and all page-world JavaScript are untrusted.

The isolated content bridge is trusted for observations but has no configuration mutation rights.

The service worker owns profile identity, mode policy, event validation, URL sanitization, DNR rules, browser content settings, registered scripts, and persisted configuration.

Page-world reports cannot change modes, profiles, allowlists, event severity, or stored detail text.

## Fail-closed behavior

Registered-guard updates add and verify desired scripts before stale scripts are removed.

Configuration is not persisted until the replacement protection set is ready.

Download blocking remains active when local reporting or residual-file cleanup fails.

When a late download item appears from a protected Strict or Learn context, the extension blocks it regardless of its apparent file type. Filename and MIME classifiers exist to stop common attempts earlier, not to permit an unclassified download.

## Known gaps

Threatwatch cannot promise containment against:

- Chrome security defects
- endpoint malware or security products acting outside Chrome
- malicious extensions with stronger permissions
- files created outside the monitored Chrome profile
- unsafe user-approved exceptions
- attacks in another browser or profile
- network or DNS manipulation
- social engineering that convinces the user to disable protection
- page behavior that never touches a monitored browser API

Declarative Net Request applies only to requests that reach Chrome's network stack. Responses generated entirely by a page service worker or CacheStorage require the later page and download-manager controls.
