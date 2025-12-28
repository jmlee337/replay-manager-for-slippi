import { Cable } from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputBase,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { RendererOfflineModeTournament } from '../common/types';

export default function OfflineModeConnection({
  offlineModeStatus,
  offlineModeTournament,
}: {
  offlineModeStatus: { address: string; error: string };
  offlineModeTournament: RendererOfflineModeTournament;
}) {
  const [open, setOpen] = useState(false);
  const [port, setPort] = useState(50000);
  const [connecting, setConnecting] = useState(false);

  const label = useMemo(
    () =>
      offlineModeStatus.address
        ? 'Offline Mode connected'
        : 'Connect to Offline Mode',
    [offlineModeStatus],
  );

  return (
    <Stack direction="row">
      <InputBase
        disabled
        size="small"
        value={
          offlineModeTournament.slug ||
          offlineModeStatus.address ||
          (offlineModeStatus.error ? 'Error!' : 'Connect to Offline Mode...')
        }
        style={{ flexGrow: 1 }}
      />
      <Tooltip arrow title={label}>
        <IconButton onClick={() => setOpen(true)}>
          <Cable />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <DialogTitle>{label}</DialogTitle>
        <DialogContent>
          {offlineModeStatus.address ? (
            <DialogContentText>{offlineModeStatus.address}</DialogContentText>
          ) : (
            <>
              <Stack direction="row" alignItems="center" spacing="8px">
                <TextField
                  disabled={connecting}
                  label="Port"
                  name="port"
                  onChange={(event) => {
                    setPort(Number.parseInt(event.target.value, 10));
                  }}
                  size="small"
                  slotProps={{ htmlInput: { min: 1024, max: 65536 } }}
                  type="number"
                  value={port}
                  variant="filled"
                />
                <Button
                  disabled={connecting}
                  onClick={async () => {
                    try {
                      setConnecting(true);
                      await window.electron.connectToOfflineMode(port);
                    } finally {
                      setConnecting(false);
                    }
                  }}
                  variant="contained"
                >
                  Connect
                </Button>
              </Stack>
              {offlineModeStatus.error && (
                <Alert severity="error">{offlineModeStatus.error}</Alert>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
