# Privacy

Threatwatch has no account system, server component, telemetry, advertising, analytics, remote code, or externally connectable API.

## Local data

Chrome local extension storage contains:

- protected site profiles
- global blocked domains
- local threat events
- runtime protection health
- one temporary legacy-state backup after migration

Chrome session storage contains a small per-tab navigation context used to compare a new target with the last committed protected page. Session entries are removed when tabs close and do not survive a browser restart.

## Event URL handling

Event URLs are sanitized by the service worker before persistence.

For HTTP and HTTPS URLs, Threatwatch removes:

- username
- password
- query string
- fragment

For non-web URLs, Threatwatch stores only the protocol name. A malformed URL is stored as `[invalid-url]`. Raw malformed input is never used as a fallback.

## Retention

Threatwatch keeps up to 750 local events. The settings page can clear them at any time.

## Network activity

Threatwatch does not send its configuration or event data to any server. Normal browser requests made by the visited page remain subject to Chrome and the user's other browser controls.
