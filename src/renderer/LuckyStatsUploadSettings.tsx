import { useEffect, useState } from 'react';
import {
  Alert,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { LuckySnapshot } from '../common/luckyStats';

export default function LuckyStatsUploadSettings() {
  const [snapshot, setSnapshot] = useState<LuckySnapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await window.electron.luckyStatus();
        if (active) setSnapshot(next);
      } catch {
        if (active) setError('Could not read upload settings.');
      }
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <Stack spacing={1} sx={{ mb: 3 }}>
      <Typography variant="h6">Lucky Stats</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {snapshot?.connected ? (
        <>
          <FormControlLabel
            label="Pause Lucky Stats uploads"
            control={
              <Switch
                checked={!snapshot.enabled}
                disabled={busy}
                onChange={async (_, paused) => {
                  setBusy(true);
                  setError('');
                  try {
                    await window.electron.luckyEnable(!paused);
                    setSnapshot(await window.electron.luckyStatus());
                  } catch {
                    setError('Could not update upload settings.');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            }
          />
          <Typography variant="body2">
            Pausing lets the current transfer finish and holds queued uploads.
            Sets copied while paused are not queued; copy them again or add
            their folders after resuming.
          </Typography>
        </>
      ) : (
        <Typography variant="body2">
          Connect an upload key in Lucky Stats to upload copied sets
          automatically.
        </Typography>
      )}
    </Stack>
  );
}
