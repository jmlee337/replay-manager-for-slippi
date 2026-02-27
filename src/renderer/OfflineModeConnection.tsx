import { Cable, ContentCopy } from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  Family,
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
  const [address, setAddress] = useState('127.0.0.1');
  const [family, setFamily] = useState<Family>('IPv4');
  const [port, setPort] = useState('50000');

  const [addressCopied, setAddressCopied] = useState(false);
  const [portCopied, setPortCopied] = useState(false);

  return (
    <>
      <DialogTitle>{toLabel(offlineModeStatus)}</DialogTitle>
      <DialogContent>
        {offlineModeStatus.address ? (
          <>
            <Stack direction="row" alignItems="center" spacing="8px">
              <TextField
                fullWidth
                label={`Address (${offlineModeStatus.family})`}
                size="small"
                value={offlineModeStatus.address}
                variant="standard"
              />
              <Button
                disabled={addressCopied}
                endIcon={addressCopied ? undefined : <ContentCopy />}
                onClick={async () => {
                  await window.electron.copyToClipboard(
                    offlineModeStatus.address,
                  );
                  setAddressCopied(true);
                  setTimeout(() => setAddressCopied(false), 5000);
                }}
                variant="contained"
              >
                {addressCopied ? 'Copied!' : 'Copy'}
              </Button>
            </Stack>
            <Stack direction="row" alignItems="center" spacing="8px">
              <TextField
                fullWidth
                label="Port"
                size="small"
                value={offlineModeStatus.port}
                variant="standard"
              />
              <Button
                disabled={portCopied}
                endIcon={portCopied ? undefined : <ContentCopy />}
                onClick={async () => {
                  await window.electron.copyToClipboard(
                    `${offlineModeStatus.port}`,
                  );
                  setPortCopied(true);
                  setTimeout(() => setPortCopied(false), 5000);
                }}
                variant="contained"
              >
                {portCopied ? 'Copied!' : 'Copy'}
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Stack direction="row" alignItems="center" spacing="8px">
              <ToggleButtonGroup
                exclusive
                onChange={(event, newFamily) => {
                  setFamily(newFamily);
                }}
                value={family}
              >
                <ToggleButton value="IPv4">IPv4</ToggleButton>
                <ToggleButton value="IPv6">IPv6</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                autoFocus
                label={`Address (${family})`}
                onChange={(event) => {
                  setAddress(event.target.value);
                }}
                size="small"
                value={address}
                variant="standard"
              />
              <TextField
                label="Port"
                onChange={(event) => {
                  setPort(event.target.value);
                }}
                slotProps={{ htmlInput: { min: 1024, max: 65536 } }}
                size="small"
                type="number"
                value={port}
                variant="standard"
              />
              <Button
                disabled={!address || !port}
                onClick={async () => {
                  await window.electron.connectToOfflineMode(
                    address,
                    family,
                    Number.parseInt(port, 10),
                  );
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
        fullWidth
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
