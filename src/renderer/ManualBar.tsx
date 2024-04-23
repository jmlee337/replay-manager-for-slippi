import { EditNote } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputBase,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { FormEvent } from 'react';

const placeholder = `Player 1
Player 2
Player 3
Player 4
...`;

export default function ManualBar({
  manualDialogOpen,
  setManualDialogOpen,
  manualNames,
  setManualNames,
}: {
  manualDialogOpen: boolean;
  setManualDialogOpen: (newManualDialogOpen: boolean) => void;
  manualNames: string[];
  setManualNames: (newManualNames: string[]) => void;
}) {
  return (
    <Stack direction="row">
      <InputBase
        disabled
        size="small"
        value="Edit player names..."
        style={{ flexGrow: 1 }}
      />
      <Tooltip arrow title="Edit player names">
        <IconButton onClick={() => setManualDialogOpen(true)}>
          <EditNote />
        </IconButton>
      </Tooltip>
      <Dialog
        open={manualDialogOpen}
        onClose={() => setManualDialogOpen(false)}
      >
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
              setManualDialogOpen(false);
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
      </Dialog>
    </Stack>
  );
}
