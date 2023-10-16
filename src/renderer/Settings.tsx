import styled from '@emotion/styled';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { FormEvent, useState } from 'react';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
`;

export default function Settings({
  startggApiKey,
  setStartggApiKey,
}: {
  startggApiKey: string;
  setStartggApiKey: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
        <DialogTitle>Settings</DialogTitle>
        <DialogContent>
          <Form onSubmit={setNewStartggKey}>
            <Stack alignItems="center" direction="row" gap="8px">
              <TextField
                autoFocus
                defaultValue={startggApiKey}
                fullWidth
                label="start.gg API key (Treat this as a password!)"
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
        </DialogContent>
      </Dialog>
    </>
  );
}
