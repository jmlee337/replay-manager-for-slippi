import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  Stack,
  Typography,
  LinearProgress,
  Box,
} from '@mui/material';

export type SlpDownloadStatus =
  | { status: 'idle' }
  | {
      status: 'downloading';
      slpUrls: string[];
      progress: number;
      currentFile: string;
    }
  | { status: 'error'; failedFiles: string[] }
  | { status: 'success' };

function LinearProgressWithLabel({ value }: { value: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: 300 }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress variant="determinate" value={value} />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography variant="body2" color="text.secondary">{`${Math.round(
          value,
        )}%`}</Typography>
      </Box>
    </Box>
  );
}

export default function SlpDownloadModal({
  status,
  onClose,
}: {
  status: SlpDownloadStatus;
  onClose: () => void;
}) {
  if (status.status === 'downloading') {
    return (
      <Dialog open PaperProps={{ sx: { minWidth: 400, textAlign: 'center' } }}>
        <DialogTitle>Downloading SLP files...</DialogTitle>
        <DialogContent>
          <Stack alignItems="center" gap={2}>
            <LinearProgressWithLabel value={status.progress} />
            <Typography variant="body2" color="text.secondary">
              {`Current file: ${status.currentFile}`}
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
    );
  }
  if (status.status === 'error') {
    return (
      <Dialog open onClose={onClose}>
        <DialogTitle>Error Downloading SLP Files</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Failed to download the following SLP files:
          </DialogContentText>
          {status.failedFiles.map((file) => (
            <DialogContentText key={file}>{file}</DialogContentText>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }
  return null;
}
