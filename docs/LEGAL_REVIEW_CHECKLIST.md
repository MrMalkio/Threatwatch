# Public Release Legal Review Checklist

This is an internal project checklist, not legal advice.

Before a commercial, account-based, or server-backed Threatwatch launch, review these items with licensed counsel in the jurisdictions that matter.

## Project identity

- Select the legal entity that operates Threatwatch.
- Publish a legal and privacy contact address that does not require posting sensitive data publicly.
- Confirm ownership and licensing of the Threatwatch name, marks, code, website copy, and any future artwork.

## Terms

- Review the warranty disclaimer and $25 or 12-month-fee liability cap for enforceability.
- Decide whether to add arbitration, class-action waiver, small-claims carveout, and an opt-out procedure. Do not add arbitration casually without a workable notice and opt-out mechanism.
- Review indemnification language for consumer use.
- Confirm New Jersey governing law and venue are appropriate for the operating entity.
- Add paid-service, billing, cancellation, refund, tax, and renewal terms before charging users.
- Review age restrictions before community accounts or user-generated content launch.

## Privacy

- Map every Chrome permission to a disclosed user-facing purpose.
- Keep browsing-activity collection limited to the extension's disclosed safety purpose.
- Update the privacy policy before community telemetry, accounts, sync, payments, support tooling, or analytics begin collecting data.
- Implement notice at collection and consumer request workflows if a privacy law applies to the operator.
- Assess state privacy laws, including New Jersey and California, when business thresholds or covered processing are reached.
- Define raw submission, abuse-log, aggregate, backup, and deletion retention periods.
- Document subprocessors and international data transfers before server launch.
- Implement Global Privacy Control handling if the service becomes subject to a law requiring it.

## Chrome Web Store

- Confirm the store listing matches actual functionality and privacy fields.
- Provide the public Privacy Policy URL in the Developer Dashboard.
- Include the Chrome Web Store Limited Use statement on the website or privacy page.
- Request only permissions needed by shipped features.
- Do not fetch remote executable logic into the Manifest V3 extension.
- Review the full website, marketing, user-generated content, and extension experience against Chrome Web Store policies.

## Community reputation

- Approve vocabulary that distinguishes availability, experience, observed risk, and evidence confidence.
- Avoid unsupported claims such as safe, clean, virus-free, or official.
- Create moderation rules, domain-owner dispute process, appeals, takedown handling, and an audit log.
- Keep paid status, advertising, or sponsorship from affecting ratings or moderation results.
- Review defamation, platform-liability, intellectual-property, and notice-and-takedown exposure before public user submissions.

## Streaming-site product boundary

- Keep Threatwatch positioned as browser harm reduction.
- Do not market the service as a way to find copyrighted content for free.
- Do not publish ranked outbound-link directories of replacement unauthorized streaming domains without separate legal review.
- Keep legality and licensing questions outside the reputation score unless supported by authoritative evidence and a reviewed process.

## Security and incident response

- Publish a vulnerability-reporting path.
- Create breach and incident-response procedures before collecting server-side user data.
- Define security logging and access controls.
- Create feed-signing key rotation and revocation procedures before remote profiles ship.
