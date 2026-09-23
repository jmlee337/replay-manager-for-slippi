import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  LinearProgress,
  Box,
  Snackbar,
  Paper,
} from '@mui/material';
import { Close, Download, Remove } from '@mui/icons-material';

import { SlpDownloadStatus } from '../common/types';

const MAX_VISIBLE_SOURCES = 3;

function CloseIconButton({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <Tooltip arrow title={title}>
      <IconButton size="small" onClick={onClick}>
        <Close />
      </IconButton>
    </Tooltip>
  );
}

function MinimizeIconButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip arrow title="Minimize (download continues)">
      <IconButton size="small" onClick={onClick}>
        <Remove />
      </IconButton>
    </Tooltip>
  );
}

function LinearProgressWithLabel({ value }: { value: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
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

export default function BeamerDownloadSnackbar({
  status,
  onClose,
  onCancel,
}: {
  status: SlpDownloadStatus;
  onClose: () => void;
  onCancel: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (status.status === 'error') {
      setHidden(false);
    }
  }, [status]);

  if (hidden && status.status === 'downloading') {
    return (
      <Tooltip arrow title="Show downloads">
        <Chip
          color="primary"
          icon={<Download />}
          label={`${Math.round(status.progress)}%`}
          onClick={() => setHidden(false)}
          sx={{
            position: 'absolute',
            left: 56,
            bottom: 8,
            height: 40,
            borderRadius: 20,
            zIndex: (t) => t.zIndex.snackbar,
          }}
        />
      </Tooltip>
    );
  }

  const open =
    !hidden &&
    (status.status === 'downloading' ||
      status.status === 'cancelled' ||
      status.status === 'error');

  let content = null;
  if (status.status === 'downloading') {
    const { filesDone, totalFiles, failedCount, attempt } = status;
    const names = status.sources.map((source) => source.label);
    const visible = names.slice(0, MAX_VISIBLE_SOURCES).join(', ');
    const overflow = names.length - MAX_VISIBLE_SOURCES;
    const counted = ` (${Math.min(
      filesDone + 1,
      totalFiles,
    )} of ${totalFiles})`;
    const failed = failedCount === 0 ? '' : `${failedCount} failed, `;
    content = (
      <Stack gap={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">Downloading SLP files...</Typography>
          <MinimizeIconButton onClick={() => setHidden(true)} />
        </Stack>
        <LinearProgressWithLabel value={status.progress} />
        <Typography variant="body2" color="text.secondary">
          {failed}
          {visible || status.currentFile}
          {overflow > 0 && (
            <Typography component="span" variant="body2" color="text.disabled">
              {` + ${overflow} more`}
            </Typography>
          )}
          {counted}
        </Typography>
        {attempt !== undefined && attempt > 1 && (
          <Typography variant="body2" color="text.secondary">
            {`Connection dropped, retrying (attempt ${attempt})...`}
          </Typography>
        )}
        <Stack direction="row" justifyContent="flex-end">
          <Button size="small" onClick={onCancel}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    );
  } else if (status.status === 'cancelled') {
    content = (
      <Stack gap={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">Download Cancelled</Typography>
          <CloseIconButton title="Close" onClick={onClose} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {`Stopped after ${status.filesDone} of ${status.totalFiles} files. ` +
            'Partly downloaded files are kept, so refreshing picks up where ' +
            'this left off.'}
        </Typography>
      </Stack>
    );
  } else if (status.status === 'error') {
    content = (
      <Stack gap={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">
            Error Downloading SLP Files
          </Typography>
          <CloseIconButton title="Close" onClick={onClose} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Failed to download the following SLP files:
        </Typography>
        {status.failedFiles.map((file) => (
          <Typography
            key={`${file.label}|${file.fileName ?? ''}|${file.reason}`}
            variant="body2"
            color="text.secondary"
          >
            {`${file.label}${file.fileName ? ` - ${file.fileName}` : ''}: ${
              file.reason
            }`}
          </Typography>
        ))}
      </Stack>
    );
  }

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      onClose={(event, reason) => {
        if (reason === 'clickaway' || status.status === 'downloading') {
          return; // not dismissable - click the cancel button...
        }
        onClose();
      }}
      sx={{
        left: 8,
        bottom: 8,
        right: 'auto',
      }}
    >
      <Paper elevation={6} sx={{ p: 1.5, width: 360 }}>
        {content}
      </Paper>
    </Snackbar>
  );
}
