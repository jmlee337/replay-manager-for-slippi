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
import { useEffect, useState } from 'react';
import {
  OfflineModeStatus,
  RendererOfflineModeTournament,
} from '../common/types';

function toLabel(offlineModeStatus: OfflineModeStatus) {
  return offlineModeStatus.address
    ? 'Offline Mode connected'
    : 'Connect to Offline Mode';
}

export function OfflineModeConnectionDialogContent({
  offlineModeStatus,
}: {
  offlineModeStatus: OfflineModeStatus;
}) {
  const [port, setPort] = useState(50000);

  return (
    <>
      <DialogTitle>{toLabel(offlineModeStatus)}</DialogTitle>
      <DialogContent>
        {offlineModeStatus.address ? (
          <DialogContentText>{offlineModeStatus.address}</DialogContentText>
        ) : (
          <>
            <Stack direction="row" alignItems="center" spacing="8px">
              <TextField
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
                onClick={async () => {
                  await window.electron.connectToOfflineMode(port);
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
    </>
  );
}

export default function OfflineModeConnection({
  offlineModeStatus,
  offlineModeTournament,
}: {
  offlineModeStatus: OfflineModeStatus;
  offlineModeTournament: RendererOfflineModeTournament;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (offlineModeStatus.address) {
      setOpen(false);
    }
  }, [offlineModeStatus]);

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
      <Tooltip arrow title={toLabel(offlineModeStatus)}>
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
        <OfflineModeConnectionDialogContent
          offlineModeStatus={offlineModeStatus}
        />
      </Dialog>
    </Stack>
  );
}
