import { BrowserUpdated, Close, FolderOpen, Router } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  CopySettings,
  Output,
  WebSocketServerStatus,
  CopyRemote,
} from '../common/types';
import ErrorDialog from './ErrorDialog';
import LabeledCheckbox from './LabeledCheckbox';

function ClientsDialog({
  disabled,
  setHosting,
}: {
  disabled: boolean;
  setHosting: (hosting: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(WebSocketServerStatus.STOPPED);
  const [clients, setClients] = useState<CopyRemote[]>([]);
  const [selfAddress, setSelfAddress] = useState('');
  const [selfName, setSelfName] = useState('');

  useEffect(() => {
    (async () => {
      setClients(await window.electron.getCopyClients());
    })();
  }, []);

  useEffect(() => {
    window.electron.onHostServerStatus((event, newStatus) => {
      setStatus(newStatus);
      setHosting(newStatus !== WebSocketServerStatus.STOPPED);
    });
  }, [setHosting]);
  useEffect(() => {
    window.electron.onCopyClients((event, newClients) => {
      setClients(newClients);
    });
  }, []);

  return (
    <>
      <Button
        disabled={disabled}
        endIcon={<BrowserUpdated />}
        onClick={async () => {
          setSelfName(await window.electron.startHostServer());
          setSelfAddress(await window.electron.startBroadcastingHost());
          setOpen(true);
        }}
      >
        {status === WebSocketServerStatus.STOPPED
          ? 'Host on LAN'
          : `Add Clients (${clients.length})`}
      </Button>
      <Dialog
        open={open}
        onClose={async () => {
          if (clients.length === 0) {
            await window.electron.stopHostServer();
          }
          await window.electron.stopBroadcastingHost();
          setOpen(false);
        }}
        fullWidth
      >
        <DialogTitle>Hosting on LAN...</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Hosting at {selfAddress} - {selfName}
          </DialogContentText>
          <List>
            {clients.map(({ address, name }) => (
              <ListItem
                key={address}
                disablePadding
                style={{ marginRight: '-16px', width: 'calc(100% + 16px)' }}
                secondaryAction={
                  <Tooltip title="Disconnect">
                    <IconButton edge="end">
                      <Close />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText>
                  {address} - {name}
                </ListItemText>
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HostsDialog({ host }: { host: CopyRemote }) {
  const [open, setOpen] = useState(false);
  const [hosts, setHosts] = useState<CopyRemote[]>([]);
  const [selfName, setSelfName] = useState('');
  useEffect(() => {
    window.electron.onCopyHosts((event, newHosts) => {
      setHosts(newHosts);
    });
  }, []);

  const [connecting, setConnecting] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [error, setError] = useState('');

  return (
    <>
      <Tooltip title="Search LAN">
        <Button
          onClick={async () => {
            setHosts([]);
            setError('');
            setSelfName(await window.electron.startListeningForHosts());
            setOpen(true);
          }}
          endIcon={<Router />}
        >
          {host.address && host.name ? 'Connected' : 'Search LAN'}
        </Button>
      </Tooltip>
      <Dialog
        open={open}
        onClose={async () => {
          await window.electron.stopListeningForHosts();
          setOpen(false);
        }}
        fullWidth
      >
        <DialogTitle>Searching LAN for host Replay Manager...</DialogTitle>
        <DialogContent>
          <form
            style={{
              alignItems: 'center',
              display: 'flex',
              marginTop: '8px',
              marginBottom: '8px',
              gap: '8px',
            }}
            onSubmit={async (event) => {
              event.preventDefault();
              event.stopPropagation();

              setConnecting(true);
              await window.electron.stopListeningForHosts();
              try {
                await window.electron.connectToHost(manualAddress);
                setOpen(false);
              } catch (e: unknown) {
                if (e instanceof Error) {
                  setError(e.message);
                }
              } finally {
                setConnecting(false);
              }
            }}
          >
            <TextField
              autoFocus
              label="IP Address"
              placeholder="192.168.0.106"
              size="small"
              variant="outlined"
              value={manualAddress}
              onChange={(event) => {
                setManualAddress(event.target.value);
              }}
            />
            <Button
              disabled={connecting}
              endIcon={connecting && <CircularProgress size="24px" />}
              type="submit"
              variant="contained"
            >
              Connect
            </Button>
          </form>
          {error && <Alert severity="error">{error}</Alert>}
          <DialogContentText>Searching as {selfName}</DialogContentText>
          <List>
            {host.address && host.name && (
              <ListItem
                disablePadding
                style={{ marginRight: '-16px', width: 'calc(100% + 16px)' }}
                secondaryAction={
                  <Tooltip title="Disconnect">
                    <IconButton edge="end">
                      <Close />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText>
                  {host.address} - {host.name}
                </ListItemText>
              </ListItem>
            )}
            {hosts.map(({ address, name }) => (
              <ListItem
                key={address}
                disablePadding
                style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }}
              >
                <ListItemButton
                  onClick={async () => {
                    setConnecting(true);
                    await window.electron.stopListeningForHosts();
                    try {
                      await window.electron.connectToHost(address);
                      setOpen(false);
                    } catch (e: unknown) {
                      if (e instanceof Error) {
                        setError(e.message);
                      }
                    } finally {
                      setConnecting(false);
                    }
                  }}
                >
                  <ListItemText>
                    {address} - {name}
                  </ListItemText>
                </ListItemButton>
              </ListItem>
            ))}
            <ListItem disableGutters>
              <CircularProgress size="24px" />
            </ListItem>
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CopyControls({
  dir,
  setDir,
  useLAN,
  error,
  setError,
  errorDialogOpen,
  setErrorDialogOpen,
  hasSelectedReplays,
  isCopying,
  onCopy,
  success,
  copySettings,
  setCopySettings,
  elevateSettings,
}: {
  dir: string;
  setDir: (dir: string) => void;
  useLAN: boolean;
  error: string;
  setError: (error: string) => void;
  errorDialogOpen: boolean;
  setErrorDialogOpen: (errorDialogOpen: boolean) => void;
  hasSelectedReplays: boolean;
  isCopying: boolean;
  onCopy: () => Promise<void>;
  success: string;
  copySettings: CopySettings;
  setCopySettings: (newCopySettings: CopySettings) => Promise<void>;
  elevateSettings: boolean;
}) {
  const [hosting, setHosting] = useState(false);
  const [host, setHost] = useState<CopyRemote>({
    name: '',
    address: '',
  });

  useEffect(() => {
    (async () => {
      const hostPromise = window.electron.getCopyHost();
      setHost(await hostPromise);
    })();
  }, []);

  useEffect(() => {
    window.electron.onCopyHost((event, newHost) => {
      setHost(newHost);
    });
  }, []);

  const chooseDir = async () => {
    const newDir = await window.electron.chooseCopyDir();
    if (newDir) {
      setDir(newDir);
    }
  };

  return (
    <>
      <Divider />
      <Stack paddingLeft="42px">
        <Stack direction="row">
          <InputBase
            disabled
            size="small"
            value={
              host.name && host.address
                ? `${host.address} - ${host.name}`
                : dir || 'Set copy folder...'
            }
            style={{ flexGrow: 1 }}
          />
          {useLAN && (
            <>
              {!(host.address && host.name) && (
                <ClientsDialog disabled={!dir} setHosting={setHosting} />
              )}
              {!hosting && <HostsDialog host={host} />}
            </>
          )}
          <Tooltip title="Set copy folder">
            <IconButton onClick={chooseDir}>
              <FolderOpen />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack
          direction="row"
          justifyContent="right"
          bgcolor={elevateSettings ? 'white' : undefined}
          sx={{
            zIndex: (theme) =>
              elevateSettings ? theme.zIndex.drawer + 2 : undefined,
          }}
        >
          <Stack>
            <Tooltip
              arrow
              title="A file containing set metadata will be included in the copy folder/zip"
            >
              <div>
                <LabeledCheckbox
                  checked={copySettings.writeContext}
                  disabled={copySettings.output === Output.FILES}
                  label="Write context.json"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeContext = checked;
                    setCopySettings(newCopySettings);
                  }}
                />
              </div>
            </Tooltip>
          </Stack>
          <Stack>
            <Tooltip
              arrow
              title="Player tags will appear in the in-game HUD (like Slippi Broadcast/Online) depending on playback settings"
            >
              <div>
                <LabeledCheckbox
                  checked={copySettings.writeDisplayNames}
                  label="Overwrite Display Names"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeDisplayNames = checked;
                    setCopySettings(newCopySettings);
                  }}
                />
              </div>
            </Tooltip>
            <Tooltip
              arrow
              title="New file names will indicate game start time, player tags, and characters"
            >
              <div>
                <LabeledCheckbox
                  checked={copySettings.writeFileNames}
                  label="Overwrite File Names"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeFileNames = checked;
                    setCopySettings(newCopySettings);
                  }}
                />
              </div>
            </Tooltip>
          </Stack>
          <Stack>
            <Tooltip
              arrow
              title="Game start times will be shifted to have the set end exactly now. Useful if your Wii clocks aren't accurate"
            >
              <div>
                <LabeledCheckbox
                  checked={copySettings.writeStartTimes}
                  label="Overwrite Start Times"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeStartTimes = checked;
                    setCopySettings(newCopySettings);
                  }}
                />
              </div>
            </Tooltip>
            <TextField
              label="Output"
              onChange={(event) => {
                const newCopySettings = { ...copySettings };
                newCopySettings.output = parseInt(event.target.value, 10);
                setCopySettings(newCopySettings);
              }}
              select
              size="small"
              value={copySettings.output}
            >
              <MenuItem value={Output.FILES}>Separate Files</MenuItem>
              <MenuItem value={Output.FOLDER}>Make Subfolder</MenuItem>
              <MenuItem value={Output.ZIP}>Make ZIP folder</MenuItem>
            </TextField>
          </Stack>
        </Stack>
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="right"
          spacing="8px"
        >
          <ErrorDialog
            messages={[error]}
            onClose={() => {
              setError('');
              setErrorDialogOpen(false);
            }}
            open={errorDialogOpen}
          />
          {success && <Typography variant="caption">{success}</Typography>}
          <Button
            disabled={isCopying || !dir || !hasSelectedReplays}
            onClick={async () => {
              try {
                await onCopy();
              } catch (e: any) {
                const message = e instanceof Error ? e.message : e;
                setError(message);
                setErrorDialogOpen(true);
              }
            }}
            variant="contained"
          >
            {isCopying ? 'Copying...' : 'Copy'}
          </Button>
        </Stack>
      </Stack>
    </>
  );
}
