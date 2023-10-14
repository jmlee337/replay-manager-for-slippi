import styled from '@emotion/styled';
import { Settings as SettingsIcon } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { FormEvent, useState } from 'react';

const Form = styled.form`
  align-items: center;
  display: flex;
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
            <Button type="submit">Set!</Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
