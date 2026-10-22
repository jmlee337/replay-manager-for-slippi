# Lucky Stats game data uploads

This opt-in integration uploads finalized Start.gg sets to Lucky Stats after Copy, including Report with **Also copy** enabled. Folder, ZIP and individual-file copy outputs use the same finalized bytes. It does not upload directly from the source USB or require a storage credential.

## Connect

1. Connect the Start.gg account that administers your tournament on [Lucky Stats game data](https://luckystats.gg/?tab=gamedata).
2. Create a device-specific key at [Account → API keys → App uploads](https://luckystats.gg/account?tab=api#upload-keys). The **How to integrate** guide there documents the service contract.
3. Open **Lucky Stats** in this app, paste the key and select **Connect**.
4. Enable **Upload copied sets automatically**. Copy each completed set as usual, or use **Add existing set folder** for a folder containing its game files and `context.json`.
5. At the end of the tournament, wait for every set and correction on every device to finish uploading, then select **Finish tournament** and confirm. This closes this account's tournament upload to further changes.

The automatic hook currently supports online Start.gg mode. Other bracket modes keep their existing behavior. Adding an existing folder requires a real Start.gg set ID and event slug in its context. Start.gg reporting itself remains independent of Lucky Stats upload success.

## Lifecycle

- Public app ID: `replay-reporter`. Only the main process handles the upload key, API calls and storage transfers. The key is encrypted with Electron `safeStorage`; the insecure Linux `basic_text` fallback is rejected. The renderer never receives the saved key.
- The app snapshots finalized files into `userData/lucky-stats-uploads` before the existing copy operation returns. It journals manifests, idempotency keys and receipts using atomic file replacement. Source files can subsequently be removed by the existing reporting flow.
- A single transfer queue requests `POST /api/integrations/v1/uploads`, streams each approved file to S3 with the returned headers, then calls `/uploads/:id/complete`. Signed URLs and storage credentials are not persisted. API credentials are never sent to S3.
- **Uploaded** means the server verified and accepted the files. It is separate from analytics completion. Recopying changed data for the same set creates a replacement; unchanged latest content is deduplicated locally. Earlier failed revisions must be retried or discarded before later corrections upload.
- Network/5xx/429 failures retry with capped exponential backoff, jitter and `Retry-After`. Expired sessions get a new persisted idempotency key. A lost transfer or completion response can be retried safely; S3 `412` is verified by the completion call.
- Pausing stops automatic snapshots and new transfers after the active operation. Already queued data remains on disk. Reopening the app resumes pending uploads when enabled. Disconnect removes the encrypted credential and pauses; reconnect with the original key for the existing queue. Switching keys/accounts with a populated queue is intentionally rejected.
- Confirmed local snapshots are deleted only after the server receipt is saved. **Discard pending upload** cancels an approved session before deleting that private snapshot. Original source/output files are untouched.
- **Finish tournament** calls `/tournaments/:id/complete` only after all local uploads are accepted/discarded and no snapshot is being prepared. The server also checks in-flight uploads for this account. A lost finish response is retried with the same batch ID while further changes remain locked.
- After finish, read-only `/tournaments/:id` polling reports each import batch and advanced analytics counts, respects `pollAfterSeconds` (at least ten seconds), and stops at `null`. Analytics percentages describe currently tracked sets, not elapsed worker time.

The app must be open to transfer or poll. There is no operating-system background daemon. A second installation can still have unapproved local files, so the operator must confirm that every device has finished copying before finalization.

## Verification

```sh
npm ci
npx tsc --noEmit --incremental false
npm run build
npm run test:lucky-stats
# macOS arm64 unsigned local build:
npx electron-builder --dir --mac --arm64 --publish never
ELECTRON_APP="$PWD/release/build/mac-arm64/ReplayReporterForSlippi.app/Contents/MacOS/ReplayReporterForSlippi" npm run test:lucky-stats:e2e
```

The E2E script launches the packaged Electron app in a disposable profile. It substitutes a local HTTP server for API/storage calls and selects a generated fixture folder through the native folder chooser boundary. It exercises the real renderer, preload, IPC, encrypted credential storage, queue persistence, transfer, replacement, finalization and status UI. Its final analytics results are **fixtures**, not production processing. Screenshots go to `docs/lucky-stats/screenshots` (override with `SHOTS`). It never uses a production key.

Additional live verification on October 22, 2026 used the packaged app and an isolated, temporary credential against the real Lucky Stats API and S3. Connection, signed upload, handoff and correction/replacement succeeded. Those screenshots are prefixed `live-`. The fixture files were not playable games and were never finalized into production imports. Temporary credentials and database fixtures were removed; stored objects were tagged for the existing storage expiration policy.

A real tournament's import-to-analytics completion, Windows/Linux packaging, and automatic Copy/Report interaction against a real Start.gg bracket are not covered by the live check. The finalized-file writer hook is covered for folder, ZIP and individual-file outputs in the regression tests. This is a draft for upstream review before a tournament trial.
