# Contributing to Threatwatch

Threatwatch is intended to remain a focused, local-first browser safety project for streaming-type sites.

## Before opening a pull request

1. Explain the threat or product problem the change addresses.
2. Add regression tests for security behavior.
3. Run `npm run check`.
4. Keep extension logic self-contained and Manifest V3 compatible.
5. Do not add remote executable code.
6. Do not add hidden telemetry.
7. Do not loosen a protection silently.
8. Update `CHANGELOG.md` for material product changes.
9. Update public help or privacy text when user-facing behavior changes.

## Community and domain data

Do not turn public documentation into a ranked directory of working unauthorized streaming sites. Domain profiles can exist for security testing and recognition, but public contributions should focus on observed behavior, risk, and product support.

Do not submit live malware, stolen credentials, private browsing histories, personal data, or unverified accusations about individuals.

## Security changes

Protection changes should fail closed. If a candidate update cannot be verified, the previous working protection should remain active when possible.

A change that touches profile identity, message trust, DNR generation, page-world interception, download containment, remote signatures, privacy, or storage deserves explicit security review.

## Website changes

The public site lives in `website/`. Keep it static and dependency-light. Do not add analytics or tracking without a product decision, privacy update, and required user disclosure.
