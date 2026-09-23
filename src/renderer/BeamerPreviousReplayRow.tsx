import {
  Box,
  CircularProgress,
  ListItemButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';

export default function BeamerPreviousReplayRow({
  previousReplayName,
  downloading,
  onDownload,
}: {
  previousReplayName: string;
  downloading: boolean;
  onDownload: () => void;
}) {
  if (!previousReplayName) {
    return null;
  }

  return (
    <Tooltip arrow placement="right" title={previousReplayName}>
      <ListItemButton
        disabled={downloading}
        disableGutters
        onClick={onDownload}
      >
        <Box
          alignItems="center"
          color="text.secondary"
          display="flex"
          flexGrow={1}
          gap="8px"
          justifyContent="center"
        >
          {downloading ? (
            <CircularProgress size="20px" />
          ) : (
            <Add fontSize="small" />
          )}
          <Typography variant="body2">Download previous replay</Typography>
        </Box>
      </ListItemButton>
    </Tooltip>
  );
}
