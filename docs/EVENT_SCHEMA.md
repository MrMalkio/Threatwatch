# Event Schema

Each stored event has this shape:

```json
{
  "id": "uuid",
  "timestamp": 1787500000000,
  "type": "external-navigation",
  "severity": "medium",
  "action": "blocked",
  "profileId": "p-uuid",
  "sourceUrl": "https://protected.example/path",
  "targetUrl": "https://outside.example/path",
  "sourceLayer": "navigation",
  "decisionCandidate": true,
  "detail": "Recorded an unexpected external navigation from a protected page."
}
```

## Controlled fields

The service worker owns `severity`, allowed `action` values, and `detail`. Content scripts cannot supply arbitrary stored descriptions or severity.

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

## Source layers

- `content`
- `navigation`
- `download`
- `background`
- `migration`

## Learn marker

`decisionCandidate` is true for unexpected navigation and spawned-navigation events created under Learn mode. It does not weaken blocking.
