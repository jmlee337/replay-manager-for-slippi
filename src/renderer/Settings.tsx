import styled from '@emotion/styled';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
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
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import LabeledCheckbox from './LabeledCheckbox';
import { Mode } from '../common/types';

const Form = styled.form`
  display: flex;
  align-items: end;
  flex-direction: column;
  gap: 8px;
`;

function LabeledRadioButton({ label, value }: { label: string; value: Mode }) {
  return (
    <FormControlLabel
      disableTypography
      label={label}
      labelPlacement="start"
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

  const setNewStartggKey = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      key: { value: string };
    };
    const newKey = target.key.value;
    event.preventDefault();
    event.stopPropagation();
    if (newKey) {
      await window.electron.setStartggKey(newKey);
      setStartggApiKey(newKey);
      setOpen(false);
    }
  };

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
      <Dialog fullWidth open={open} onClose={() => setOpen(false)}>
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
            <FormControl style={{ alignItems: 'end' }}>
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
            <Form onSubmit={setNewStartggKey}>
              <DialogContentText textAlign="end">
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
                  defaultValue={startggApiKey}
                  fullWidth
                  label="start.gg API key (Keep it private!)"
                  name="key"
                  size="small"
                  type="password"
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
              <Stack direction="row" justifyContent="end">
                <Button type="submit" variant="contained">
                  Set!
                </Button>
              </Stack>
            </Form>
          )}
          <Divider sx={{ marginTop: '8px' }} />
          <Stack justifyContent="flex-end">
            <LabeledCheckbox
              checked={autoDetectUsb}
              label="Auto-detect USB"
              labelPlacement="start"
              set={async (checked) => {
                await window.electron.setAutoDetectUsb(checked);
                setAutoDetectUsb(checked);
              }}
            />
            <LabeledCheckbox
              checked={scrollToBottom}
              label="Auto-scroll to end of replay list"
              labelPlacement="start"
              set={async (checked) => {
                await window.electron.setScrollToBottom(checked);
                setScrollToBottom(checked);
              }}
            />
            <LabeledCheckbox
              checked={useEnforcer}
              label="Use SLP Enforcer"
              labelPlacement="start"
              set={async (checked) => {
                await window.electron.setUseEnforcer(checked);
                setUseEnforcer(checked);
              }}
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
