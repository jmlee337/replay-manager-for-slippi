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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FormEvent, useMemo, useState } from 'react';
import LabeledCheckbox from './LabeledCheckbox';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export default function Settings({
  appVersion,
  latestAppVersion,
  gotSettings,
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

    const versionArr = appVersion.split('.');
    const latestVersionArr = latestAppVersion.split('.');
    if (versionArr.length !== 3 || latestVersionArr.length !== 3) {
      return false;
    }

    if (versionArr[0] < latestVersionArr[0]) {
      return true;
    }
    if (versionArr[1] < latestVersionArr[1]) {
      return true;
    }
    if (versionArr[2] < latestVersionArr[2]) {
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
          <Form onSubmit={setNewStartggKey}>
            <DialogContentText>
              Get your start.gg API key by clicking “Create new token” in the
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
