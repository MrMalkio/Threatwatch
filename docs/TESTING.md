# Testing

Run:

```bash
npm run check
```

The command first parses every JavaScript file with Node, then runs the Node test suite.

## Unit coverage

The suite checks:

- Normal, Strict, and Learn mode policy
- domain normalization and matching
- duplicate-domain migration
- profile ID uniqueness
- DNR rule generation
- registered-script ID uniqueness
- event URL sanitization
- risky extension matching
- manifest references
- documentation links
- popup blank-target variants in a VM harness
- source regressions for overlay scan continuation
- removal of the old whole-state `save-state` command

## Browser checks before release

Load the unpacked extension in Chrome 145 or newer and use a controlled fixture page to test:

- internal link
- external link
- script-assigned top navigation
- new tab and popunder
- `about:blank#fragment`
- `mailto:` and `tel:`
- executable link
- clipboard command payload
- ClickFix text followed by a newly inserted overlay
- two overlays where the first is already neutralized
- forced registered-script failure with old guards already present

The Node suite cannot prove Chrome DNR and `webNavigation` ordering under every redirect chain. A Chrome fixture run remains a release gate.
