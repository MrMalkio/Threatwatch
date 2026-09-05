# Security Policy

Threatwatch is security-sensitive browser software. Please avoid publishing exploit details that could place users at risk.

## Report a vulnerability

For an exploitable vulnerability in Threatwatch, use GitHub's private vulnerability-reporting path from the repository Security area when it is available.

If private reporting is not available, open a minimal public issue that says a sensitive security problem exists without posting weaponized proof-of-concept code, credentials, live malware, or detailed exploitation steps. A maintainer can arrange a safer channel.

## What belongs in a security report

- Threatwatch code that lets a protected page bypass a promised guard.
- A privilege or message-trust flaw that lets page code mutate protection settings.
- A storage or sanitization bug that leaks sensitive browser data.
- Remote feed or signature validation failures once remote data features ship.
- Supply-chain or build issues that could alter distributed extension code.

## Testing rules

- Prefer local fixtures and disposable browser profiles.
- Use harmless files instead of live malware.
- Do not probe or exploit third-party websites without authorization.
- Do not include stolen credentials, cookies, tokens, or personal data in a report.

## Response priorities

A vulnerability that can disable protection, execute attacker-controlled code with extension privileges, leak sensitive browsing data, or silently weaken a user's profile should be treated as high priority.
