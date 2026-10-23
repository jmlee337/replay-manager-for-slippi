# Lucky Stats game data uploads

This opt-in integration uploads finalized Start.gg or Parry sets to Lucky Stats after Copy, including Report with **Also copy** enabled. Folder, ZIP and individual-file copy outputs use the same finalized bytes. It does not upload directly from the source USB or require a storage credential.

## Connect

1. For Start.gg, connect your organizer account on [Lucky Stats game data](https://luckystats.gg/?tab=gamedata). For Parry, configure your organizer API key in the app and import the tournament into Lucky Stats.
2. Create a device-specific key at [Account → API keys → App uploads](https://luckystats.gg/account?tab=api#upload-keys). The **How to integrate** guide there documents the service contract.
3. Open **Lucky Stats** in this app, paste the key and select **Connect**.
4. Uploads start automatically when the key connects. Copy each completed set as usual, or use **Add existing set folder** for a folder containing its game files and `context.json`.
5. At the end of the tournament, wait for every set and correction on every device to finish uploading, then select **Finish tournament** and confirm. This submits the shared collection from all authorized accounts. **Reopen uploads** accepts late sets and corrections.

The automatic hook supports online Start.gg and Parry modes. Existing folders need a confirmed set identity and tournament reference in their context.

## Lifecycle

- Public app ID: `replay-reporter`. Only the main process handles the upload key, API calls and storage transfers. The key is encrypted with Electron `safeStorage`; the insecure Linux `basic_text` fallback is rejected. The renderer never receives the saved key.
- The app snapshots finalized files into `userData/lucky-stats-uploads` before the existing copy operation returns. It journals manifests, idempotency keys and receipts using atomic file replacement. Source files can subsequently be removed by the existing reporting flow.
- A single transfer queue requests `POST /api/integrations/v1/uploads`, streams each approved file to S3 with the returned headers, then calls `/uploads/:id/complete`. Signed URLs and storage credentials are not persisted. API credentials are never sent to S3.
- **Uploaded** means the server verified and accepted the files. It is separate from analytics completion. Recopying changed data for the same set creates a replacement; unchanged latest content is deduplicated locally. Earlier failed revisions must be retried or discarded before later corrections upload.
- Network/5xx/429 failures retry with capped exponential backoff, jitter and `Retry-After`. Expired sessions get a new persisted idempotency key. A lost transfer or completion response can be retried safely; S3 `412` is verified by the completion call.
- **Settings → Lucky Stats → Pause Lucky Stats uploads** stops automatic snapshots and new transfers after the active operation. Already queued data remains on disk. Reopening the app resumes pending uploads when enabled. Disconnect removes the encrypted credential and pauses; reconnect with the original key for the existing queue. Switching keys/accounts with a populated queue is intentionally rejected.
- Confirmed local snapshots are deleted only after the server receipt is saved. **Discard pending upload** cancels an approved session before deleting that private snapshot. Original source/output files are untouched.
- **Finish tournament** calls `/tournaments/:id/complete` only after all local uploads are accepted/discarded and no snapshot is being prepared. The server also checks in-flight uploads across all contributors. A lost finish response is retried with the same batch ID while further changes remain locked.
- Shared `/tournaments/:id` status is polled every 15 seconds while connected, including during collection and after processing completes. Polling runs independently of file transfers. Server status controls the UI after another reporter finishes/reopens or the inactivity job auto-finishes. Analytics percentages describe currently tracked sets, not elapsed worker time.

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


## Parry uploads

Parry Copy/Report uses the same automatic upload queue, including forced context generation when enabled. New context files include `startgg.tournament.parryId`; sets retain their UUID in `startgg.set.internalId` with a null numeric ID. Recopy older folders that lack the tournament ID.

The app sends its configured Parry API key to Lucky Stats in `X-Parry-API-Key`. Lucky Stats checks admin, manager, or reporter permissions with Parry for that tournament; ordinary organizers do not need Lucky Stats game-data-admin access. The credential is not persisted by Lucky Stats or sent to S3. The Parry tournament must already be imported into Lucky Stats.

Validation: UUID/context tests, all three writer output modes, and the packaged Electron UI using `PLATFORM=parry npm run test:lucky-stats:e2e` with local API/storage/analytics fixtures. Screenshots in `screenshots/parry/` show that fixture flow, not a live Parry tournament. A live organizer-credential check remains pending.


## Shared collection, reopening and auto-finish

Authorized accounts using this app share one collection for the same tournament. The UI shows total uploaded sets, active uploads, and per-key counts using only truncated key prefixes. A correction replaces the current accepted revision of that set across contributors. Individual upload sessions stay key-scoped.

Finish and reopen carry the server's `collectionVersion`. Ambiguous retries preserve that version, so an old finish request cannot finalize a reopened collection. Reopen preserves submitted imports, restarts the inactivity timer, and permits new sets/corrections; a subsequent finish waits for previous imports to finish. Local files blocked by `tournament_finalized` resume after reopening, including when another laptop reopens remotely.

The server checks every 15 minutes and auto-finishes after 6 idle hours (configurable with `UPLOAD_AUTO_FINISH_IDLE_HOURS`). It requires an ingested tournament whose end date passed, complete positive standings and a champion in each imported Melee event, completed-match evidence, and no unresolved matches or active uploads. Missing evidence defers auto-finish. The server cannot detect files still local to an offline laptop; reopen if they arrive later.

Roll out the companion Lucky Stats API change and `prisma/20261023_shared_upload_batches.sql` before using these controls. Legacy per-account batch links are preserved. The desktop fixture test covers remote manual finish, remote reopen, automatic finish, and local reopen without restarting, in addition to the transfer/replacement flow. These are simulated server transitions; production multi-account/auto-finish trials remain pending.
