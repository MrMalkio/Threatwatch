# Event Schema

Each stored event uses this shape:

```json
{
  "id": "uuid",
  "timestamp": 1787500000000,
  "type": "dangerous-download",
  "severity": "high",
  "action": "cancelled",
  "profileId": "p-uuid",
  "sourceUrl": "https://protected.example/path",
  "targetUrl": "https://outside.example/payload.exe",
  "sourceLayer": "download-created",
  "decisionCandidate": false,
  "detail": "Blocked or cancelled a download carrying a risky filename, URL, MIME type, or browser danger signal."
}
```

## Controlled fields

The service worker owns `severity`, allowed `action` values, and `detail`. Content scripts cannot supply arbitrary stored descriptions or severity.

Persisted HTTP and HTTPS URLs lose credentials, queries, and fragments. Non-web URLs retain only their protocol. Malformed input becomes a fixed invalid marker.

## Event types

- `popup-blocked`
- `protocol-blocked`
- `clipboard-blocked`
- `dangerous-download`
- `external-navigation`
- `spawned-navigation`
- `clickfix-warning`
- `click-overlay`
- `escape-committed`
- `protection-error`

## Download actions

- `blocked`: stopped by a page or network-adjacent guard before a download item was retained
- `paused`: paused as a containment step
- `cancelled`: cancelled through the Chrome downloads API
- `removed`: a file that raced to completion was removed

Current download-manager events are stored with the terminal `cancelled` action. Residual-file removal retries are best-effort cleanup and do not create extra events.

## Source layers

- `content`
- `navigation`
- `download-created`
- `download-filename`
- `background`
- `migration`

## Learn marker

`decisionCandidate` is true for unexpected navigation records created under Learn mode. Download blocking is not weakened in Learn mode.
