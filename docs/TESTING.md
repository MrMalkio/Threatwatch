# Testing

## Automated checks

Run:

```bash
npm run check
```

The suite performs JavaScript syntax validation and Node tests covering:

- Normal, Strict, and Learn mode separation
- URL and domain sanitization
- profile deduplication and registered-script identity
- early MAIN-world download-guard registration
- risky filename and encoded-extension recognition
- DNR risky-URL rules
- DNR attachment-filename and MIME response rules
- browser danger and MIME classification
- blank popup, protocol, and risky `window.open()` interception
- download anchors and programmatic anchor clicks
- risky form submissions
- save picker and file-handle write interception
- ClickFix and overlay regression cases
- local blocked-download notice wiring
- download-manager creation and filename-determination fallback wiring
- watchlist search, filtering, sorting, bounded scrolling, and collapsed detail controls
- popup and settings theme consistency
- reduced-motion support
- remote asset prohibition
- documentation link and repository-map integrity

## Interface review checklist

Load the extension options page with at least 20 profiles and enough local events to exercise every display state.

- The watchlist remains compact when every profile is closed.
- The profile list scrolls inside its panel rather than growing without a limit.
- Search matches a profile label and its hostname.
- Strict, Learn, Normal, and Paused filters return the right profiles.
- Recent activity and event-count sorting use local event data.
- Opening one profile does not open every profile.
- Open-state preferences survive a settings refresh.
- Enabled switches can be changed without opening the profile.
- Allowlist controls and removal actions remain reachable from the expanded row.
- The layout stays usable at desktop, tablet, and narrow widths.
- Keyboard focus is visible.
- Pressing `/` outside a form focuses profile search.
- Reduced-motion mode stops the decorative watch sweep.
- The popup and options page use the same terminology and status colors.

## Chrome integration checklist

Node tests cannot prove browser event ordering. Before release, load the extension unpacked into Chrome 145 or newer and test a local fixture plus a disposable browser profile.

### Early page guard

- Click an `<a download>` link to a harmless text file.
- Call `.click()` on a script-created download anchor.
- Submit a form whose action ends in `.exe`.
- Call `window.open()` with `.exe`, `%2Eexe`, and `%252Eexe` targets.
- Invoke save and directory pickers.
- Attempt `FileSystemFileHandle.createWritable()` from an existing handle.

Expected result: native actions do not run, no download shelf item completes, and a Threatwatch notice appears.

### Network layer

Use a local server with endpoints that return:

- `Content-Disposition: attachment`
- `Content-Disposition: inline; filename="payload.exe"`
- `Content-Type: application/x-msdownload`
- a risky URL with no disposition header
- a redirect from a harmless URL to a risky URL

Expected result: the request is blocked before a completed download is created.

### Download-manager fallback

Use a harmless endpoint with an opaque URL and a response that Chrome treats as a download but that does not match the early rules.

Expected result: Threatwatch pauses and cancels the item, removes a completed file if the download wins the race, records one deduplicated event, and leaves protection health at `healthy`.

### Source ancestry

Open a new tab from a protected fixture and start a download from the child immediately.

Expected result: the child is closed under Strict or Learn, the protected source context remains available long enough to cancel the download, and the event identifies the protected profile.

## Release gate

- `npm run check` passes.
- Chrome reports no manifest or service-worker errors.
- Threatwatch health reads `healthy`.
- A 20-profile watchlist remains quick to search and edit.
- Internal video playback still works on the protected test sites.
- No test download reaches completion.
- Normal mode permits downloads and does not install Strict-only guards.
