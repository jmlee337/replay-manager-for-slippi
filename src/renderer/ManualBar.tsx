import { EditNote } from '@mui/icons-material';
import { Dialog, IconButton, InputBase, Stack, Tooltip } from '@mui/material';
import ManualNamesForm from './ManualNamesForm';

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
        <ManualNamesForm
          close={() => {
            setManualDialogOpen(false);
          }}
          manualNames={manualNames}
          setManualNames={setManualNames}
        />
      </Dialog>
    </Stack>
  );
}
