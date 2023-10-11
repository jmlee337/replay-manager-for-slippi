import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

export default function ErrorDialog({
  message,
  onClose,
  open,
}: {
  message: string;
  onClose: () => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Error! (You may want to copy this message)</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
