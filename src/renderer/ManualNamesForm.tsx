import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { FormEvent } from 'react';

const placeholder = `Player 1
Player 2
Player 3
Player 4
...`;

export default function ManualNamesForm({
  close,
  manualNames,
  setManualNames,
}: {
  close: () => void;
  manualNames: string[];
  setManualNames: (manualNames: string[]) => void;
}) {
  return (
    <>
      <DialogTitle>Enter Player Names</DialogTitle>
      <form
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          const target = event.target as typeof event.target & {
            names: { value: string };
          };
          const rawNames = target.names.value;
          event.preventDefault();
          event.stopPropagation();
          if (rawNames) {
            setManualNames(rawNames.split('\n'));
            close();
          }
        }}
      >
        <DialogContent style={{ paddingTop: 0 }}>
          <DialogContentText>One per line</DialogContentText>
          <TextField
            multiline
            minRows={8}
            maxRows={16}
            name="names"
            placeholder={placeholder}
            defaultValue={
              manualNames.length > 0 ? manualNames.join('\n') : undefined
            }
          />
        </DialogContent>
        <DialogActions>
          <Button type="submit" variant="contained">
            Set!
          </Button>
        </DialogActions>
      </form>
    </>
  );
}
