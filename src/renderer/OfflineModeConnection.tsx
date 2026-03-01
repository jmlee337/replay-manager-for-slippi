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
  Tooltip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  OfflineModeStatus,
  RendererOfflineModeTournament,
} from '../common/types';

function toLabel(offlineModeStatus: OfflineModeStatus) {
  return offlineModeStatus.addressOrHost
    ? 'Offline Mode connected'
    : 'Connect to Offline Mode';
}

export function OfflineModeConnectionDialogContent({
  offlineModeStatus,
}: {
  offlineModeStatus: OfflineModeStatus;
}) {
  const [offlineModePassword, setOfflineModePassword] = useState('');
  const [offlineModeHosts, setOfflineModeHosts] = useState<string[]>([]);
  useEffect(() => {
    window.electron.onOfflineModeHosts((event, newOfflineModeHosts) => {
      setOfflineModeHosts(newOfflineModeHosts);
    });
    (async () => {
      const offlineModePasswordPromise =
        window.electron.getOfflineModePassword();
      const offlineModeHostsPromise = window.electron.getOfflineModeHosts();
      setOfflineModePassword(await offlineModePasswordPromise);
      setOfflineModeHosts(await offlineModeHostsPromise);
    })();
  }, []);

  const [addressOrHost, setAddressOrHost] = useState('127.0.0.1');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  return (
    <>
      <DialogTitle>{toLabel(offlineModeStatus)}</DialogTitle>
      <DialogContent>
        <Stack alignItems="center" direction="row" gap="8px" marginBottom="8px">
          <TextField
            fullWidth
            disabled={Boolean(offlineModeStatus.addressOrHost)}
            label="Offline Mode password"
            onChange={(event) => {
              setOfflineModePassword(event.target.value);
            }}
            size="small"
            type="password"
            value={offlineModePassword}
            variant="standard"
          />
          <Button
            disabled={passwordCopied}
            endIcon={passwordCopied ? undefined : <ContentCopy />}
            onClick={async () => {
              await window.electron.copyToClipboard(offlineModePassword);
              setPasswordCopied(true);
              setTimeout(() => setPasswordCopied(false), 5000);
            }}
            variant="contained"
          >
            {passwordCopied ? 'Copied!' : 'Copy'}
          </Button>
        </Stack>
        {offlineModeStatus.addressOrHost ? (
          <Stack direction="row" alignItems="center" spacing="8px">
            <TextField
              fullWidth
              label="Host"
              size="small"
              value={offlineModeStatus.addressOrHost}
              variant="standard"
            />
            <Button
              disabled={addressCopied}
              endIcon={addressCopied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copyToClipboard(
                  offlineModeStatus.addressOrHost,
                );
                setAddressCopied(true);
                setTimeout(() => setAddressCopied(false), 5000);
              }}
              variant="contained"
            >
              {addressCopied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
        ) : (
          <>
            <Stack direction="row" alignItems="center" spacing="8px">
              <TextField
                autoFocus
                fullWidth
                label="Host"
                onChange={(event) => {
                  setAddressOrHost(event.target.value);
                }}
                size="small"
                style={{ flexGrow: 1 }}
                value={addressOrHost}
                variant="standard"
              />
              <Button
                disabled={!addressOrHost}
                onClick={async () => {
                  await window.electron.setOfflineModePassword(
                    offlineModePassword,
                  );
                  window.electron.connectToOfflineMode(addressOrHost);
                }}
                variant="contained"
              >
                Connect
              </Button>
            </Stack>
            {offlineModeHosts.length === 0 ? (
              <Stack direction="row" justifyContent="center" margin="8px 0">
                <CircularProgress />
              </Stack>
            ) : (
              <List>
                {offlineModeHosts.map((offlineModeHost) => (
                  <ListItemButton
                    key={offlineModeHost}
                    onClick={async () => {
                      await window.electron.setOfflineModePassword(
                        offlineModePassword,
                      );
                      window.electron.connectToOfflineMode(offlineModeHost);
                    }}
                  >
                    <ListItemText>{offlineModeHost}</ListItemText>
                  </ListItemButton>
                ))}
              </List>
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

  useEffect(() => {
    if (offlineModeStatus.addressOrHost) {
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
          offlineModeStatus.addressOrHost ||
          (offlineModeStatus.error ? 'Error!' : 'Connect to Offline Mode...')
        }
        style={{ flexGrow: 1 }}
      />
      <Tooltip arrow title={toLabel(offlineModeStatus)}>
        <IconButton
          onClick={() => {
            setOpen(true);
            if (!offlineModeStatus.addressOrHost) {
              window.electron.listenForOfflineMode();
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
        />
      </Dialog>
    </Stack>
  );
}
