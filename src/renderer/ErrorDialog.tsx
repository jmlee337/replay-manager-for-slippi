import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

export default function ErrorDialog({
  messages,
  onClose,
  open,
}: {
  messages: string[];
  onClose: () => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Error! (You may want to copy this message)</DialogTitle>
      <DialogContent>
        {messages.map((message) => (
          <DialogContentText>{message}</DialogContentText>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
