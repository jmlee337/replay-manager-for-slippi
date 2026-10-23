import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { LuckySnapshot } from '../common/luckyStats';

const labels = {
  pending: 'Queued',
  uploading: 'Uploading',
  staged: 'Uploaded · waiting for tournament finish',
  superseded: 'Replaced',
  blocked: 'Needs attention',
  cancelled: 'Discarded',
};
const analyticsLabels: Record<string, string> = {
  waiting_for_tournament: 'Waiting for tournament finish',
  waiting_for_import: 'Waiting for import',
  processing: 'Processing',
  ready: 'Ready',
  needs_attention: 'Needs attention',
  unavailable: 'Unavailable',
};
export default function LuckyStats({
  onEnabledChange,
}: {
  onEnabledChange: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<LuckySnapshot>();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState<string>();
  const [reopen, setReopen] = useState<string>();
  const [confirm, setConfirm] = useState<string>();
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const state = await window.electron.luckyStatus();
        if (active) {
          setSnapshot(state);
          onEnabledChange(state.connected && state.enabled);
        }
      } catch {
        if (active) setError('Could not read Lucky Stats upload status.');
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [onEnabledChange]);
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      const state = await window.electron.luckyStatus();
      setSnapshot(state);
      onEnabledChange(state.connected && state.enabled);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not update Lucky Stats.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CloudUpload />}
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 8,
          left: 56,
          zIndex: 1200,
          backgroundColor: 'background.paper',
        }}
      >
        Lucky Stats
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Lucky Stats game data</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography>
              Upload each copied Start.gg or Parry set automatically. Corrected
              copies replace the previous set. Start advanced analytics when the
              tournament finishes.
            </Typography>
            {error || snapshot?.error ? (
              <Alert severity="error">{error || snapshot?.error}</Alert>
            ) : null}
            <Link
              href="https://luckystats.gg/account?tab=api#upload-keys"
              target="_blank"
              rel="noreferrer"
            >
              Create an upload key on Lucky Stats
            </Link>
            <Typography variant="body2">
              For Start.gg, connect your account on Lucky Stats. For Parry, use
              your Parry API key in app settings; Lucky Stats checks its
              tournament permissions with Parry.
            </Typography>
            {snapshot?.connected ? (
              <Chip
                label={snapshot.enabled ? 'Automatic uploads on' : 'Connected'}
                color="success"
                sx={{ alignSelf: 'flex-start' }}
              />
            ) : (
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  type="password"
                  label="Upload key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                />
                <Button
                  disabled={busy || !key.trim()}
                  onClick={() =>
                    act(async () => {
                      await window.electron.luckyConnect(key);
                      setKey('');
                    })
                  }
                >
                  Connect
                </Button>
              </Stack>
            )}
            {snapshot?.connected && (
              <Button
                disabled={busy}
                onClick={() => act(() => window.electron.luckyDisconnect())}
              >
                Disconnect
              </Button>
            )}
            {!snapshot?.connected && Boolean(snapshot?.jobs.length) && (
              <Typography variant="body2">
                Reconnect with the original key to resume this queue.
              </Typography>
            )}
            {snapshot?.connected && !snapshot.enabled && (
              <Alert severity="warning">
                Uploads paused. Resume in Settings → Lucky Stats.
              </Alert>
            )}
            <Typography variant="body2">
              Use Copy or Report with “Also copy” enabled. Keep the app open for
              transfers.
            </Typography>
            <Button
              disabled={busy || !snapshot?.connected}
              onClick={() => act(() => window.electron.luckyAddFolder())}
            >
              Add existing set folder
            </Button>
            {!snapshot?.jobs.length && (
              <Typography color="text.secondary">
                Copied sets will appear here.
              </Typography>
            )}
            {Array.from(new Set(snapshot?.jobs.map((j) => j.tournament))).map(
              (tournament) => {
                const jobs = snapshot!.jobs.filter(
                  (j) => j.tournament === tournament,
                );
                const batch = snapshot!.batches.find(
                  (b) => b.tournament === tournament,
                );
                const waiting = jobs.some(
                  (j) =>
                    !['staged', 'superseded', 'cancelled'].includes(j.status),
                );
                return (
                  <Box
                    key={tournament}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="h6">
                        {tournament.replace(/^tournament\//, '')}
                      </Typography>
                      {batch?.progress && (
                        <Stack spacing={1}>
                          <Typography>
                            <strong>
                              {batch.progress.totalUploadedSets} sets uploaded
                            </strong>{' '}
                            · {batch.progress.inFlightUploads} uploads in
                            progress
                          </Typography>
                          <Typography>
                            {!batch.finalized && 'Collecting sets'}
                            {batch.finalized &&
                              batch.progress.finalizedBy === 'automatic' &&
                              'Finished automatically'}
                            {batch.finalized &&
                              batch.progress.finalizedBy !== 'automatic' &&
                              'Finished'}
                          </Typography>
                          {batch.progress.contributions?.map((contribution) => (
                            <Typography
                              variant="body2"
                              key={contribution.keyPrefix}
                            >
                              <code>{contribution.keyPrefix}…</code> ·{' '}
                              {contribution.uploadedSets}{' '}
                              {contribution.uploadedSets === 1 ? 'set' : 'sets'}
                            </Typography>
                          ))}
                          {!batch.finalized && (
                            <Typography variant="body2">
                              Auto-finishes after{' '}
                              {batch.progress.autoFinishIdleHours} hours without
                              upload activity once Lucky Stats has complete
                              tournament standings.
                            </Typography>
                          )}
                        </Stack>
                      )}
                      {jobs.map((job) => (
                        <Box key={job.id} sx={{ py: 1 }}>
                          <Typography>
                            Set {job.setId} ·{' '}
                            {job.status === 'staged' &&
                            (batch?.finalized ||
                              batch?.progress?.sets?.some(
                                (set) =>
                                  set.uploadId === job.uploadId &&
                                  set.status === 'queued',
                              ))
                              ? 'Uploaded · submitted for processing'
                              : labels[job.status]}
                          </Typography>
                          {job.status === 'uploading' && (
                            <>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(
                                  100,
                                  (job.sentBytes /
                                    job.files.reduce(
                                      (sum, f) => sum + f.size,
                                      0,
                                    )) *
                                    100,
                                )}
                              />
                              <Typography variant="caption">
                                {(job.sentBytes / 1024 / 1024).toFixed(1)} MiB
                                sent
                              </Typography>
                            </>
                          )}
                          {job.error && (
                            <Alert
                              severity={
                                job.status === 'pending' ? 'warning' : 'error'
                              }
                            >
                              {job.error}
                            </Alert>
                          )}
                          {['pending', 'blocked'].includes(job.status) && (
                            <Button
                              disabled={busy}
                              onClick={() => setDiscard(job.id)}
                            >
                              Discard pending upload
                            </Button>
                          )}
                          {job.status === 'blocked' && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                act(() => window.electron.luckyRetry(job.id))
                              }
                            >
                              Retry set {job.setId}
                            </Button>
                          )}
                        </Box>
                      ))}
                      {batch?.error && (
                        <Alert severity="error">{batch.error}</Alert>
                      )}
                      {batch && !batch.finalized && (
                        <Button
                          variant="contained"
                          disabled={
                            busy ||
                            waiting ||
                            batch.finishing ||
                            batch.reopening ||
                            Boolean(batch.progress?.inFlightUploads)
                          }
                          onClick={() => setConfirm(batch.id)}
                        >
                          {batch.finishing
                            ? 'Confirming tournament finish…'
                            : 'Finish tournament'}
                        </Button>
                      )}
                      {batch?.finalized && (
                        <Button
                          disabled={busy || batch.finishing || batch.reopening}
                          onClick={() => setReopen(batch.id)}
                        >
                          {batch.reopening ? 'Reopening…' : 'Reopen uploads'}
                        </Button>
                      )}
                      {batch?.progress?.imports.map((run) => (
                        <Box key={run.importRunId}>
                          <Typography>
                            Import: {run.import.phase.replace(/_/g, ' ')} ·{' '}
                            {run.import.importedSets} sets ·{' '}
                            {run.import.importedGames} games
                          </Typography>
                          {run.import.percent !== null && (
                            <LinearProgress
                              aria-label="Import progress"
                              variant="determinate"
                              value={run.import.percent}
                            />
                          )}
                          <Typography>
                            Advanced analytics:{' '}
                            {analyticsLabels[run.analytics.state] || 'Unknown'}{' '}
                            · {run.analytics.readySets}/
                            {run.analytics.totalSets} sets
                          </Typography>
                          {run.analytics.percent !== null && (
                            <LinearProgress
                              aria-label="Advanced analytics progress"
                              variant="determinate"
                              value={run.analytics.percent}
                            />
                          )}
                          {run.skipped.length > 0 && (
                            <Alert severity="warning">
                              {run.skipped.length} set groups could not be
                              imported. Check the tournament on Lucky Stats.
                            </Alert>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                );
              },
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(discard)} onClose={() => setDiscard(undefined)}>
        <DialogTitle>Discard pending upload?</DialogTitle>
        <DialogContent>
          This removes the queued copy from this app. Your original files remain
          available to copy again.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscard(undefined)}>Keep upload</Button>
          <Button
            disabled={busy}
            onClick={() => {
              const id = discard!;
              setDiscard(undefined);
              act(() => window.electron.luckyCancel(id));
            }}
          >
            Discard upload
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(reopen)} onClose={() => setReopen(undefined)}>
        <DialogTitle>Reopen tournament uploads?</DialogTitle>
        <DialogContent>
          All authorized contributors can add sets and corrections again.
          Processing already started will continue. The inactivity timer
          restarts.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopen(undefined)}>Keep finished</Button>
          <Button
            disabled={busy}
            onClick={() => {
              const id = reopen!;
              setReopen(undefined);
              act(() => window.electron.luckyReopen(id));
            }}
          >
            Reopen uploads
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(undefined)}>
        <DialogTitle>Finish tournament uploads?</DialogTitle>
        <DialogContent>
          Confirm every laptop has finished uploading. This submits the latest
          uploaded sets from all contributors. Files still queued on another
          laptop are not included. You can reopen uploads to add more sets
          afterward.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(undefined)}>Keep uploading</Button>
          <Button
            disabled={busy}
            onClick={() => {
              const id = confirm!;
              setConfirm(undefined);
              act(() => window.electron.luckyFinish(id));
            }}
          >
            Finish tournament
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
