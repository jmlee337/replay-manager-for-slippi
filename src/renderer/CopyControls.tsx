import { BrowserUpdated, Close, FolderOpen, Router } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
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
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  CopySettings,
  Output,
  WebSocketServerStatus,
  CopyHostOrClient,
  CopyHostFormat,
  GuideState,
} from '../common/types';
import ErrorDialog from './ErrorDialog';
import LabeledCheckbox from './LabeledCheckbox';
import { setWindowEventListener, WindowEvent } from './setWindowEventListener';

function ClientsDialog({
  disabled,
  setHosting,
}: {
  disabled: boolean;
  setHosting: (hosting: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(WebSocketServerStatus.STOPPED);
  const [clients, setClients] = useState<CopyHostOrClient[]>([]);
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

  const [stopOpen, setStopOpen] = useState(false);

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
                  <Tooltip arrow title="Disconnect">
                    <IconButton
                      edge="end"
                      onClick={async () => {
                        await window.electron.kickCopyClient(address);
                      }}
                    >
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
        <DialogActions>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setStopOpen(true);
            }}
          >
            Stop Hosting
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={stopOpen}
        onClose={() => {
          setStopOpen(false);
        }}
      >
        <DialogTitle>Stop hosting on LAN?</DialogTitle>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setStopOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              await window.electron.stopHostServer();
              setStopOpen(false);
              setOpen(false);
            }}
          >
            Stop
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function HostsDialog({ host }: { host: CopyHostOrClient }) {
  const [open, setOpen] = useState(false);
  const [hosts, setHosts] = useState<CopyHostOrClient[]>([]);
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
      <Button
        onClick={async () => {
          setHosts([]);
          setError('');
          setSelfName(await window.electron.startListeningForHosts());
          setOpen(true);
        }}
        endIcon={<Router />}
      >
        {host.address ? 'Connected' : 'Search LAN'}
      </Button>
      <Dialog
        open={open}
        onClose={async () => {
          await window.electron.stopListeningForHosts();
          setOpen(false);
        }}
        fullWidth
      >
        <DialogTitle>Searching LAN for host Replay Reporter...</DialogTitle>
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
            {host.address && (
              <ListItem
                disablePadding
                style={{ marginRight: '-16px', width: 'calc(100% + 16px)' }}
                secondaryAction={
                  <Tooltip arrow title="Disconnect">
                    <IconButton
                      edge="end"
                      onClick={async () => {
                        await window.electron.disconnectFromHost();
                      }}
                    >
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
  host,
  hostFormat,
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
  vlerkMode,
  undoSubdir,
  hideCopyButton,
  setConfirmedCopySettings,
  guideState,
  setGuideBackdropOpen,
}: {
  dir: string;
  setDir: (dir: string) => void;
  useLAN: boolean;
  host: CopyHostOrClient;
  hostFormat: CopyHostFormat;
  error: string;
  setError: (error: string) => void;
  errorDialogOpen: boolean;
  setErrorDialogOpen: (errorDialogOpen: boolean) => void;
  hasSelectedReplays: boolean;
  isCopying: boolean;
  onCopy: () => Promise<void>;
  success: string;
  copySettings: CopySettings;
  setCopySettings: (newCopySettings: CopySettings) => void;
  elevateSettings: boolean;
  vlerkMode: boolean;
  undoSubdir: string;
  hideCopyButton: boolean;
  setConfirmedCopySettings: (confirmedCopySettings: boolean) => void;
  guideState: GuideState;
  setGuideBackdropOpen: (backdropOpen: boolean) => void;
}) {
  const [hosting, setHosting] = useState(false);
  const [copySettingsOpen, setCopySettingsOpen] = useState(elevateSettings);
  const [copyToastOpen, setCopyToastOpen] = useState(false);

  useEffect(() => {
    if (elevateSettings) {
      setCopySettingsOpen(true);
    }
  }, [elevateSettings]);

  const chooseDir = async () => {
    const newDir = await window.electron.chooseCopyDir();
    if (newDir) {
      setDir(newDir);
    }
  };

  const ctrlS = useCallback(async () => {
    if (
      vlerkMode &&
      !isCopying &&
      (dir || host.address) &&
      hasSelectedReplays
    ) {
      try {
        await onCopy();
        setCopyToastOpen(true);
      } catch (e: any) {
        const message = e instanceof Error ? e.message : e;
        setError(message);
        setErrorDialogOpen(true);
      }
    }
  }, [
    dir,
    hasSelectedReplays,
    host.address,
    isCopying,
    onCopy,
    setError,
    setErrorDialogOpen,
    vlerkMode,
  ]);

  useEffect(() => {
    setWindowEventListener(WindowEvent.CTRLS, ctrlS);
  }, [ctrlS]);

  return (
    <>
      <Divider />
      <Stack paddingLeft="42px">
        <Stack direction="row">
          <InputBase
            disabled
            size="small"
            value={
              host.address
                ? `${host.address} - ${host.name}`
                : dir || 'Set copy folder...'
            }
            style={{ flexGrow: 1 }}
          />
          {useLAN && (
            <>
              {!host.address && (
                <ClientsDialog
                  disabled={!dir}
                  setHosting={async (newHosting: boolean) => {
                    if (newHosting) {
                      setCopySettings({
                        ...copySettings,
                        output: Output.ZIP,
                      });
                    } else {
                      setCopySettings(await window.electron.getCopySettings());
                    }
                    setHosting(newHosting);
                  }}
                />
              )}
              {!hosting && <HostsDialog host={host} />}
            </>
          )}
          <Tooltip arrow title="Set copy folder">
            <IconButton onClick={chooseDir}>
              <FolderOpen />
            </IconButton>
          </Tooltip>
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
          <Button
            variant="text"
            onClick={() => {
              setCopySettingsOpen(true);
            }}
            sx={
              elevateSettings
                ? {
                    backgroundColor: 'white',
                    zIndex: (theme) => theme.zIndex.modal + 1,
                  }
                : undefined
            }
          >
            Copy Settings
          </Button>
          <Dialog
            open={copySettingsOpen}
            onClose={() => {
              setCopySettingsOpen(false);
              setConfirmedCopySettings(true);
              setGuideBackdropOpen(guideState !== GuideState.NONE);
            }}
          >
            <DialogTitle>Copy Settings</DialogTitle>
            <DialogContent>
              <Tooltip
                arrow
                placement="right"
                title="A file containing set metadata will be included in the copy folder/zip"
              >
                <div>
                  <LabeledCheckbox
                    checked={copySettings.writeContext}
                    disabled={
                      hostFormat.copySettings !== undefined ||
                      copySettings.output === Output.FILES
                    }
                    label="Write context.json"
                    set={async (checked: boolean) => {
                      const newCopySettings = { ...copySettings };
                      newCopySettings.writeContext = checked;
                      await window.electron.setCopySettings(newCopySettings);
                      setCopySettings(newCopySettings);
                    }}
                  />
                </div>
              </Tooltip>
              <Tooltip
                arrow
                placement="right"
                title="Player tags will appear in the in-game HUD (like Slippi Broadcast/Online) depending on playback settings"
              >
                <div>
                  <LabeledCheckbox
                    checked={copySettings.writeDisplayNames}
                    disabled={hostFormat.copySettings !== undefined}
                    label="Overwrite Display Names"
                    set={async (checked: boolean) => {
                      const newCopySettings = { ...copySettings };
                      newCopySettings.writeDisplayNames = checked;
                      await window.electron.setCopySettings(newCopySettings);
                      setCopySettings(newCopySettings);
                    }}
                  />
                </div>
              </Tooltip>
              <Tooltip
                arrow
                placement="right"
                title="New file names will indicate game start time, player tags, and characters"
              >
                <div>
                  <LabeledCheckbox
                    checked={copySettings.writeFileNames}
                    disabled={hostFormat.copySettings !== undefined}
                    label="Overwrite File Names"
                    set={async (checked: boolean) => {
                      const newCopySettings = { ...copySettings };
                      newCopySettings.writeFileNames = checked;
                      await window.electron.setCopySettings(newCopySettings);
                      setCopySettings(newCopySettings);
                    }}
                  />
                </div>
              </Tooltip>
              <Tooltip
                arrow
                placement="right"
                title="Game start times will be shifted to have the set end exactly now. Useful if your Wii clocks aren't accurate"
              >
                <div>
                  <LabeledCheckbox
                    checked={
                      copySettings.writeStartTimes && undoSubdir.length === 0
                    }
                    disabled={
                      hostFormat.copySettings !== undefined ||
                      undoSubdir.length > 0
                    }
                    label="Overwrite Start Times"
                    set={async (checked: boolean) => {
                      const newCopySettings = { ...copySettings };
                      newCopySettings.writeStartTimes = checked;
                      await window.electron.setCopySettings(newCopySettings);
                      setCopySettings(newCopySettings);
                    }}
                  />
                </div>
              </Tooltip>
              <TextField
                disabled={hostFormat.copySettings !== undefined || hosting}
                label="Output"
                onChange={async (event) => {
                  const newCopySettings = { ...copySettings };
                  newCopySettings.output = parseInt(event.target.value, 10);
                  await window.electron.setCopySettings(newCopySettings);
                  setCopySettings(newCopySettings);
                }}
                select
                size="small"
                style={{ marginTop: '8px' }}
                value={copySettings.output}
              >
                <MenuItem value={Output.FILES}>Separate Files</MenuItem>
                <MenuItem value={Output.FOLDER}>Make Subfolder</MenuItem>
                <MenuItem value={Output.ZIP}>Make ZIP folder</MenuItem>
              </TextField>
            </DialogContent>
          </Dialog>
          {(vlerkMode || !hideCopyButton) && (
            <>
              {success && <Typography variant="caption">{success}</Typography>}
              <Button
                disabled={
                  isCopying || (!dir && !host.address) || !hasSelectedReplays
                }
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
            </>
          )}
        </Stack>
      </Stack>
      {vlerkMode && (
        <Snackbar
          open={copyToastOpen}
          autoHideDuration={5000}
          onClose={(ev, reason) => {
            if (reason === 'clickaway') {
              return;
            }
            setCopyToastOpen(false);
          }}
          message="Copied!"
        />
      )}
    </>
  );
}
