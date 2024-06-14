import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChangeEvent, useMemo, useState } from 'react';
import LabeledCheckbox from './LabeledCheckbox';
import { Mode } from '../common/types';

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
  autoDetectUsb,
  setAutoDetectUsb,
  scrollToBottom,
  setScrollToBottom,
  useEnforcer,
  setUseEnforcer,
  fileNameFormat,
  setFileNameFormat,
  folderNameFormat,
  setFolderNameFormat,
}: {
  appVersion: string;
  latestAppVersion: string;
  gotSettings: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  startggApiKey: string;
  setStartggApiKey: (key: string) => void;
  autoDetectUsb: boolean;
  setAutoDetectUsb: (autoDetectUsb: boolean) => void;
  scrollToBottom: boolean;
  setScrollToBottom: (scrollToBottom: boolean) => void;
  useEnforcer: boolean;
  setUseEnforcer: (useEnforcer: boolean) => void;
  fileNameFormat: string;
  setFileNameFormat: (fileNameFormat: string) => void;
  folderNameFormat: string;
  setFolderNameFormat: (folderNameFormat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

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
  if (gotSettings && !hasAutoOpened && (!startggApiKey || needUpdate)) {
    setOpen(true);
    setHasAutoOpened(true);
  }

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
          await Promise.all([
            window.electron.setStartggKey(startggApiKey),
            window.electron.setFileNameFormat(fileNameFormat),
            window.electron.setFolderNameFormat(folderNameFormat),
          ]);
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
                value={mode}
                onChange={async (event: ChangeEvent<HTMLInputElement>) => {
                  const newMode = event.target.value as Mode;
                  await window.electron.setMode(newMode);
                  setMode(newMode);
                }}
              >
                <LabeledRadioButton label="start.gg" value={Mode.STARTGG} />
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
                <a
                  href="https://start.gg/admin/profile/developer"
                  target="_blank"
                  rel="noreferrer"
                >
                  this page
                </a>
                . Keep it private!
              </DialogContentText>
              <Stack alignItems="center" direction="row" gap="8px">
                <TextField
                  autoFocus
                  fullWidth
                  label="start.gg API key (Keep it private!)"
                  onChange={(event) => {
                    setStartggApiKey(event.target.value);
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
          <Stack>
            <LabeledCheckbox
              checked={autoDetectUsb}
              label="Auto-detect USB"
              labelPlacement="end"
              set={async (checked) => {
                await window.electron.setAutoDetectUsb(checked);
                setAutoDetectUsb(checked);
              }}
            />
            <LabeledCheckbox
              checked={scrollToBottom}
              label="Auto-scroll to end of replay list"
              labelPlacement="end"
              set={async (checked) => {
                await window.electron.setScrollToBottom(checked);
                setScrollToBottom(checked);
              }}
            />
            <LabeledCheckbox
              checked={useEnforcer}
              label="Use SLP Enforcer"
              labelPlacement="end"
              set={async (checked) => {
                await window.electron.setUseEnforcer(checked);
                setUseEnforcer(checked);
              }}
            />
            <DialogContentText>
              File/Folder name format placeholders documented{' '}
              <a
                href={`https://github.com/jmlee337/replay-manager-for-slippi/blob/${appVersion}/src/docs/format.md`}
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
              .
            </DialogContentText>
            <Stack alignItems="end" direction="row" gap="8px">
              <TextField
                fullWidth
                label="File name format"
                onChange={(event) => {
                  setFileNameFormat(event.target.value);
                }}
                size="small"
                value={fileNameFormat}
                variant="standard"
              />
              <DialogContentText paddingBottom="5px">.slp</DialogContentText>
            </Stack>
            <TextField
              fullWidth
              label="Folder name format"
              onChange={(event) => {
                setFolderNameFormat(event.target.value);
              }}
              size="small"
              value={folderNameFormat}
              variant="standard"
            />
          </Stack>
          {needUpdate && (
            <Alert severity="warning">
              Update available!{' '}
              <a
                href="https://github.com/jmlee337/replay-manager-for-slippi/releases/latest"
                target="_blank"
                rel="noreferrer"
              >
                Version {latestAppVersion}
              </a>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
