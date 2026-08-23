# Threat Model

## Protected assets

Threatwatch seeks to protect:

- the user's active browsing context
- the user's attention and click intent
- browser permission settings
- the clipboard from command-payload injection
- the device from risky download lures
- local Threatwatch configuration
- the local event record

## Expected hostile behavior

Threatwatch assumes a protected page may:

- intercept early clicks with full-page elements
- call `window.open()` with blank or external targets
- create popunders or new tabs
- navigate the top frame to rotating advertising domains
- launch custom protocols or external applications
- display fake verification instructions
- write shell commands to the clipboard
- offer executable or script downloads
- use third-party frames or scripts
- forge page-world messages sent to the isolated content script
- mutate the DOM repeatedly to replace removed or disabled nodes

## Trust boundaries

The hostile page and all page-world JavaScript are untrusted.

The isolated content script is trusted for observations but has no configuration mutation rights.

The service worker owns:

- profile identity
- domain normalization
- mode policy
- event action and severity
- URL sanitization
- DNR rules
- browser content settings
- registered MAIN-world scripts
- persisted configuration

Page-world reports cannot add allowlist entries, change modes, replace profiles, or choose stored severity and detail text.

## Fail-closed behavior

Registered guard updates add and verify desired scripts before stale scripts are removed. A rejected registration batch leaves existing guards intact.

Configuration is not persisted until the replacement protection set is ready. Errors mark runtime health degraded and retain the prior stored configuration.

A cleanup error may leave extra guards registered. Extra protection is preferred to silent loss of protection.

## Known gaps

Threatwatch cannot promise containment against:

- Chrome security defects
- malicious extensions with stronger permissions
- endpoint malware
- downloads opened outside Chrome
- user-approved exceptions
- attacks in another browser or profile
- network or DNS manipulation
- social engineering that convinces the user to disable protection
- behaviors that never touch the monitored browser APIs

MAIN-world messages may be forged by a protected page. The service worker treats them as observations only and rechecks the active profile and mode before accepting them.
