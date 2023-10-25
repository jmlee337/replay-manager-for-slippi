import styled from '@emotion/styled';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useState } from 'react';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export default function Settings({
  appVersion,
  gotStartggApiKey,
  startggApiKey,
  setStartggApiKey,
}: {
  appVersion: string;
  gotStartggApiKey: boolean;
  startggApiKey: string;
  setStartggApiKey: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noApiKeyOpened, setNoApiKeyOpened] = useState(false);

  if (gotStartggApiKey && !startggApiKey && !noApiKeyOpened) {
    setOpen(true);
    setNoApiKeyOpened(true);
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
      <Button
        endIcon={<SettingsIcon />}
        onClick={() => setOpen(true)}
        size="small"
        variant="contained"
      >
        Settings
      </Button>
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
          </Form>
          <DialogActions sx={{ pl: 0, pr: 0 }}>
            <Button type="submit" variant="contained">
              Set!
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}
