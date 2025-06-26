import {
  CloudDownload,
  ContentCopy,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import LabeledCheckbox from './LabeledCheckbox';
import {
  AdminedTournament,
  CopyHostFormat,
  EnforcerSetting,
  Mode,
} from '../common/types';

function LabeledRadioButton({ label, value }: { label: string; value: Mode }) {
  return (
    <FormControlLabel
      disableTypography
      label={label}
      labelPlacement="end"
      value={value}
      control={<Radio />}
      sx={{ typography: 'caption' }}
    />
  );
}

export default function Settings({
  appVersion,
  latestAppVersion,
  gotSettings,
  mode,
  setMode,
  startggApiKey,
  setStartggApiKey,
  challongeApiKey,
  setChallongeApiKey,
  enforcerSetting,
  setEnforcerSetting,
  vlerkMode,
  setVlerkMode,
  guidedMode,
  setGuidedMode,
  smuggleCostumeIndex,
  setSmuggleCostumeIndex,
  useLAN,
  setUseLAN,
  fileNameFormat,
  setFileNameFormat,
  folderNameFormat,
  setFolderNameFormat,
  setAdminedTournaments,
  showErrorDialog,
  enforcerVersion,
  hostFormat,
}: {
  appVersion: string;
  latestAppVersion: string;
  gotSettings: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  startggApiKey: string;
  setStartggApiKey: (key: string) => void;
  challongeApiKey: string;
  setChallongeApiKey: (key: string) => void;
  enforcerSetting: EnforcerSetting;
  setEnforcerSetting: (enforcerSetting: EnforcerSetting) => void;
  vlerkMode: boolean;
  setVlerkMode: (vlerkMode: boolean) => void;
  guidedMode: boolean;
  setGuidedMode: (guidedMode: boolean) => void;
  smuggleCostumeIndex: boolean;
  setSmuggleCostumeIndex: (smuggleCostumeIndex: boolean) => void;
  useLAN: boolean;
  setUseLAN: (useLAN: boolean) => void;
  fileNameFormat: string;
  setFileNameFormat: (fileNameFormat: string) => void;
  folderNameFormat: string;
  setFolderNameFormat: (folderNameFormat: string) => void;
  setAdminedTournaments: (tournaments: AdminedTournament[]) => void;
  showErrorDialog: (errors: string[]) => void;
  enforcerVersion: string;
  hostFormat: CopyHostFormat;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [shouldGetTournaments, setShouldGetTournaments] = useState(false);

  const needUpdate = useMemo(() => {
    if (!appVersion || !latestAppVersion) {
      return false;
    }

    const versionStrArr = appVersion.split('.');
    const latestVersionStrArr = latestAppVersion.split('.');
    if (versionStrArr.length !== 3 || latestVersionStrArr.length !== 3) {
      return false;
    }

    const mapPred = (versionPartStr: string) =>
      Number.parseInt(versionPartStr, 10);
    const versionNumArr = versionStrArr.map(mapPred);
    const latestVersionNumArr = latestVersionStrArr.map(mapPred);
    const somePred = (versionPart: number) => Number.isNaN(versionPart);
    if (versionNumArr.some(somePred) || latestVersionNumArr.some(somePred)) {
      return false;
    }

    if (versionNumArr[0] < latestVersionNumArr[0]) {
      return true;
    }
    if (versionNumArr[1] < latestVersionNumArr[1]) {
      return true;
    }
    if (versionNumArr[2] < latestVersionNumArr[2]) {
      return true;
    }
    return false;
  }, [appVersion, latestAppVersion]);
  if (
    gotSettings &&
    !hasAutoOpened &&
    ((mode === Mode.STARTGG && !startggApiKey) ||
      (mode === Mode.CHALLONGE && !challongeApiKey) ||
      needUpdate)
  ) {
    setOpen(true);
    setHasAutoOpened(true);
  }

  const [trashDir, setTrashDir] = useState('');
  useEffect(() => {
    (async () => {
      const trashDirPromise = window.electron.getTrashDir();
      setTrashDir(await trashDirPromise);
    })();
  }, []);

  const [choosingTrashDir, setChoosingTrashDir] = useState(false);

  return (
    <>
      <Tooltip title="Settings">
        <Fab
          onClick={() => setOpen(true)}
          size="small"
          style={{ position: 'absolute', bottom: 8, left: 8 }}
        >
          <SettingsIcon />
        </Fab>
      </Tooltip>
      <Dialog
        fullWidth
        open={open}
        onClose={async () => {
          try {
            await Promise.all([
              window.electron.setChallongeKey(challongeApiKey),
              window.electron.setStartggKey(startggApiKey),
              window.electron.setFileNameFormat(fileNameFormat),
              window.electron.setFolderNameFormat(folderNameFormat),
            ]);
          } catch (e: any) {
            showErrorDialog([e instanceof Error ? e.message : e]);
          }
          if (shouldGetTournaments) {
            if (
              (mode === Mode.STARTGG && startggApiKey) ||
              (mode === Mode.CHALLONGE && challongeApiKey)
            ) {
              try {
                setAdminedTournaments(await window.electron.getTournaments());
              } catch (e: any) {
                showErrorDialog([e instanceof Error ? e.message : e]);
              } finally {
                setShouldGetTournaments(false);
              }
            } else {
              setAdminedTournaments([]);
              setShouldGetTournaments(false);
            }
          }
          setOpen(false);
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="24px"
        >
          <DialogTitle>Settings</DialogTitle>
          <Typography variant="caption">
            Replay Manager for Slippi version {appVersion}
          </Typography>
        </Stack>
        <DialogContent sx={{ pt: 0 }}>
          <Stack>
            <FormControl>
              <FormLabel id="mode-radio-group-label">Mode</FormLabel>
              <RadioGroup
                aria-labelledby="mode-radio-group-label"
                name="mode-radio-group"
                row
                value={mode}
                onChange={async (event: ChangeEvent<HTMLInputElement>) => {
                  const newMode = event.target.value as Mode;
                  await window.electron.setMode(newMode);
                  setMode(newMode);
                  setShouldGetTournaments(true);
                }}
              >
                <LabeledRadioButton label="start.gg" value={Mode.STARTGG} />
                <LabeledRadioButton label="Challonge" value={Mode.CHALLONGE} />
                <LabeledRadioButton label="Manual" value={Mode.MANUAL} />
              </RadioGroup>
            </FormControl>
          </Stack>
          {mode === Mode.STARTGG && (
            <>
              <DialogContentText>
                Get your start.gg API key by clicking “Create new token” in the
                <br />
                “Personal Access Tokens” tab of{' '}
                <Link
                  href="https://start.gg/admin/profile/developer"
                  target="_blank"
                  rel="noreferrer"
                >
                  this page
                </Link>
                . Keep it private!
              </DialogContentText>
              <Stack alignItems="center" direction="row" gap="8px">
                <TextField
                  autoFocus
                  fullWidth
                  label="start.gg API key (Keep it private!)"
                  onChange={(event) => {
                    setStartggApiKey(event.target.value);
                    setShouldGetTournaments(true);
                  }}
                  size="small"
                  type="password"
                  value={startggApiKey}
                  variant="standard"
                />
                <Button
                  disabled={copied}
                  endIcon={copied ? undefined : <ContentCopy />}
                  onClick={async () => {
                    await window.electron.copyToClipboard(startggApiKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 5000);
                  }}
                  variant="contained"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </Stack>
            </>
          )}
          {mode === Mode.CHALLONGE && (
            <>
              <DialogContentText>
                Get your Challonge v1 API key on{' '}
                <Link
                  href="https://challonge.com/settings/developer"
                  target="_blank"
                  rel="noreferrer"
                >
                  this page
                </Link>{' '}
                (you may need to click “Generate a new API key”). Keep it
                private!
              </DialogContentText>
              <Stack alignItems="center" direction="row" gap="8px">
                <TextField
                  autoFocus
                  fullWidth
                  label="Challonge v1 API key (Keep it private!)"
                  onChange={(event) => {
                    setChallongeApiKey(event.target.value);
                    setShouldGetTournaments(true);
                  }}
                  size="small"
                  type="password"
                  value={challongeApiKey}
                  variant="standard"
                />
                <Button
                  disabled={copied}
                  endIcon={copied ? undefined : <ContentCopy />}
                  onClick={async () => {
                    await window.electron.copyToClipboard(challongeApiKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 5000);
                  }}
                  variant="contained"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </Stack>
            </>
          )}
          <Stack>
            <LabeledCheckbox
              checked={guidedMode}
              label="Use walkthrough mode"
              labelPlacement="end"
              set={async (checked) => {
                await window.electron.setGuidedMode(checked);
                setGuidedMode(checked);
              }}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <LabeledCheckbox
                checked={trashDir.length > 0}
                disabled={!trashDir}
                label={
                  trashDir
                    ? 'Using trash folder:'
                    : 'Deleting replays permanently'
                }
                labelPlacement="end"
                set={async (checked) => {
                  if (!checked) {
                    await window.electron.clearTrashDir();
                    setTrashDir('');
                  }
                }}
                style={{ flexShrink: 0 }}
              />
              {trashDir ? (
                <Typography
                  overflow="hidden"
                  textAlign="left"
                  textOverflow="ellipsis"
                  style={{ direction: 'rtl', opacity: '0.5' }}
                  variant="caption"
                  whiteSpace="nowrap"
                >
                  {trashDir}
                </Typography>
              ) : (
                <Button
                  disabled={choosingTrashDir}
                  endIcon={
                    choosingTrashDir ? (
                      <CircularProgress size="24px" />
                    ) : undefined
                  }
                  onClick={async () => {
                    setChoosingTrashDir(true);
                    try {
                      setTrashDir(await window.electron.chooseTrashDir());
                    } catch {
                      // just catch
                    } finally {
                      setChoosingTrashDir(false);
                    }
                  }}
                  variant="contained"
                >
                  Set trash folder
                </Button>
              )}
            </Stack>
            <LabeledCheckbox
              checked={vlerkMode}
              label={
                <span>
                  Use &quot;Vlerk mode&quot; for post tournament supplemental
                  reporting,{' '}
                  <Link
                    href={`https://github.com/jmlee337/replay-manager-for-slippi/blob/${appVersion}/src/docs/vlerk.md`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    see more details
                  </Link>
                </span>
              }
              labelPlacement="end"
              set={async (checked) => {
                await window.electron.setVlerkMode(checked);
                setVlerkMode(checked);
              }}
            />
            <LabeledCheckbox
              checked={useLAN}
              label="Use LAN"
              labelPlacement="end"
              set={async (checked) => {
                await window.electron.setUseLAN(checked);
                setUseLAN(checked);
              }}
            />
            {mode === Mode.STARTGG && (
              <LabeledCheckbox
                disabled={hostFormat.smuggleCostumeIndex !== undefined}
                checked={smuggleCostumeIndex}
                label={
                  <span>
                    Report character color,{' '}
                    <Link
                      href={`https://github.com/jmlee337/replay-manager-for-slippi/blob/${appVersion}/src/docs/color.md`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      see more details
                    </Link>
                  </span>
                }
                labelPlacement="end"
                set={async (checked) => {
                  await window.electron.setSmuggleCostumeIndex(checked);
                  setSmuggleCostumeIndex(checked);
                }}
              />
            )}
            <FormControl variant="standard" style={{ marginBottom: '8px' }}>
              <InputLabel id="enforcer-setting-select-label">
                SLP Enforcer {enforcerVersion} (logged to copy folder
                enforcer.csv)
              </InputLabel>
              <Select
                labelId="enforcer-setting-select-label"
                disabled={hostFormat.enforcerSetting !== undefined}
                value={enforcerSetting}
                onChange={async (event) => {
                  const newEnforcerSetting = event.target
                    .value as EnforcerSetting;
                  await window.electron.setEnforcerSetting(newEnforcerSetting);
                  setEnforcerSetting(newEnforcerSetting);
                }}
              >
                <MenuItem value={EnforcerSetting.NONE}>Off</MenuItem>
                <MenuItem value={EnforcerSetting.LOG_ONLY}>Log Only</MenuItem>
                <MenuItem value={EnforcerSetting.POP_UP_GOOMWAVE}>
                  Alert on Goomwave
                </MenuItem>
                <MenuItem value={EnforcerSetting.POP_UP_ALL}>
                  Alert on All Violations
                </MenuItem>
              </Select>
            </FormControl>
            <DialogContentText>
              File/Folder name format placeholders documented{' '}
              <Link
                href={`https://github.com/jmlee337/replay-manager-for-slippi/blob/${appVersion}/src/docs/format.md`}
                target="_blank"
                rel="noreferrer"
              >
                here
              </Link>
              .
            </DialogContentText>
            <Stack alignItems="end" direction="row" gap="8px">
              <TextField
                fullWidth
                disabled={Boolean(hostFormat.fileNameFormat)}
                label="File name format"
                onChange={(event) => {
                  const newFileNameFormat = event.target.value;
                  if (newFileNameFormat) {
                    setFileNameFormat(newFileNameFormat.slice(9));
                  }
                }}
                size="small"
                value={`{ordinal}${fileNameFormat}`}
                variant="standard"
              />
              <DialogContentText paddingBottom="5px">.slp</DialogContentText>
              <Button
                disabled={Boolean(hostFormat.fileNameFormat)}
                onClick={async () => {
                  setFileNameFormat(
                    await window.electron.resetFileNameFormat(),
                  );
                }}
                variant="contained"
              >
                Reset
              </Button>
            </Stack>
            <Stack alignItems="end" direction="row" gap="8px">
              <TextField
                fullWidth
                disabled={Boolean(hostFormat.folderNameFormat)}
                label="Folder name format"
                onChange={(event) => {
                  const newFolderNameFormat = event.target.value;
                  if (newFolderNameFormat) {
                    setFolderNameFormat(newFolderNameFormat);
                  }
                }}
                size="small"
                value={folderNameFormat}
                variant="standard"
              />
              <Button
                disabled={Boolean(hostFormat.folderNameFormat)}
                onClick={async () => {
                  setFolderNameFormat(
                    await window.electron.resetFolderNameFormat(),
                  );
                }}
                variant="contained"
              >
                Reset
              </Button>
            </Stack>
          </Stack>
          {needUpdate && (
            <Alert
              severity="warning"
              style={{ marginTop: '8px' }}
              action={
                <Button
                  endIcon={<CloudDownload />}
                  variant="contained"
                  onClick={() => {
                    window.electron.update();
                  }}
                >
                  Quit and download
                </Button>
              }
            >
              Update available! Version {latestAppVersion}
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
