import { Cable, ContentCopy } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
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
  listenError,
}: {
  offlineModeStatus: OfflineModeStatus;
  listenError: string;
}) {
  const [address, setAddress] = useState('127.0.0.1');
  const [family, setFamily] = useState<Family>('IPv4');
  const [port, setPort] = useState('50000');

  const [addressCopied, setAddressCopied] = useState(false);
  const [portCopied, setPortCopied] = useState(false);

  const [remoteOfflineModes, setRemoteOfflineModes] = useState<
    { address: string; computerName: string; family: Family; port: number }[]
  >([]);
  useEffect(() => {
    window.electron.onRemoteOfflineMode((event, newRemoteOfflineModes) => {
      setRemoteOfflineModes(newRemoteOfflineModes);
    });
  }, []);

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
                onClick={() => {
                  window.electron.connectToOfflineMode(
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
            {listenError ? (
              <Alert severity="error">{listenError}</Alert>
            ) : (
              <>
                {remoteOfflineModes.length === 0 && (
                  <Stack direction="row" justifyContent="center" margin="8px 0">
                    <CircularProgress />
                  </Stack>
                )}
                {remoteOfflineModes.length > 0 && (
                  <List>
                    {remoteOfflineModes.map((remoteOfflineMode) => (
                      <ListItemButton
                        key={`${remoteOfflineMode.address}${remoteOfflineMode.port}`}
                        onClick={() => {
                          window.electron.connectToOfflineMode(
                            remoteOfflineMode.address,
                            remoteOfflineMode.family,
                            remoteOfflineMode.port,
                          );
                        }}
                      >
                        <ListItemText>
                          {remoteOfflineMode.family === 'IPv4'
                            ? remoteOfflineMode.address
                            : `[${remoteOfflineMode.address}]`}
                          :{remoteOfflineMode.port}
                          {remoteOfflineMode.computerName &&
                            ` - ${remoteOfflineMode.computerName}`}
                        </ListItemText>
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </>
            )}
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
  const [listenError, setListenError] = useState('');

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
        <IconButton
          onClick={async () => {
            setOpen(true);
            if (!offlineModeStatus.address) {
              try {
                await window.electron.listenForOfflineMode();
                setListenError('');
              } catch (e: any) {
                setListenError(e instanceof Error ? e.message : e.toString());
              }
            }
          }}
        >
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
          listenError={listenError}
        />
      </Dialog>
    </Stack>
  );
}
