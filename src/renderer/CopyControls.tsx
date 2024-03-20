import { FolderOpen } from '@mui/icons-material';
import {
  Button,
  Divider,
  IconButton,
  InputBase,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Output } from '../common/types';
import ErrorDialog from './ErrorDialog';
import LabeledCheckbox from './LabeledCheckbox';

export default function CopyControls({
  dir,
  setDir,
  error,
  setError,
  errorDialogOpen,
  setErrorDialogOpen,
  hasSelectedReplays,
  isCopying,
  onCopy,
  output,
  setOutput,
  success,
  writeDisplayNames,
  setWriteDisplayNames,
  writeFileNames,
  setWriteFileNames,
  writeStartTimes,
  setWriteStartTimes,
}: {
  dir: string;
  setDir: (dir: string) => void;
  error: string;
  setError: (error: string) => void;
  errorDialogOpen: boolean;
  setErrorDialogOpen: (errorDialogOpen: boolean) => void;
  hasSelectedReplays: boolean;
  isCopying: boolean;
  onCopy: () => Promise<void>;
  output: Output;
  setOutput: (output: Output) => void;
  success: string;
  writeDisplayNames: boolean;
  setWriteDisplayNames: (writeDisplayNames: boolean) => void;
  writeFileNames: boolean;
  setWriteFileNames: (writeFileNames: boolean) => void;
  writeStartTimes: boolean;
  setWriteStartTimes: (writeStartTimes: boolean) => void;
}) {
  const chooseDir = async () => {
    const newDir = await window.electron.chooseCopyDir();
    if (newDir) {
      setDir(newDir);
    }
  };

  return (
    <>
      <Divider />
      <Stack paddingLeft="42px">
        <Stack direction="row">
          <InputBase
            disabled
            size="small"
            value={dir || 'Set copy folder...'}
            style={{ flexGrow: 1 }}
          />
          <Tooltip arrow title="Set copy folder">
            <IconButton aria-label="Set copy folder" onClick={chooseDir}>
              <FolderOpen />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" justifyContent="right">
          <Stack>
            <Tooltip
              arrow
              title="Player tags will appear in the in-game HUD (like Slippi Broadcast/Online) depending on playback settings"
            >
              <div>
                <LabeledCheckbox
                  checked={writeDisplayNames}
                  label="Overwrite Display Names"
                  set={setWriteDisplayNames}
                />
              </div>
            </Tooltip>
            <Tooltip
              arrow
              title="New file names will indicate game start time, player tags, and characters"
            >
              <div>
                <LabeledCheckbox
                  checked={writeFileNames}
                  label="Overwrite File Names"
                  set={setWriteFileNames}
                />
              </div>
            </Tooltip>
          </Stack>
          <Stack>
            <Tooltip
              arrow
              title="Game start times will be shifted to have the set end exactly now. Useful if your Wii clocks aren't accurate"
            >
              <div>
                <LabeledCheckbox
                  checked={writeStartTimes}
                  label="Overwrite Start Times"
                  set={setWriteStartTimes}
                />
              </div>
            </Tooltip>
            <TextField
              label="Output"
              onChange={(event) =>
                setOutput(parseInt(event.target.value, 10) as Output)
              }
              select
              size="small"
              value={output}
            >
              <MenuItem value={Output.FILES}>Separate Files</MenuItem>
              <MenuItem value={Output.FOLDER}>Make Subfolder</MenuItem>
              <MenuItem value={Output.ZIP}>Make ZIP folder</MenuItem>
            </TextField>
          </Stack>
        </Stack>
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="right"
          spacing="8px"
        >
          <ErrorDialog
            message={error}
            onClose={() => {
              setError('');
              setErrorDialogOpen(false);
            }}
            open={errorDialogOpen}
          />
          {success && <Typography variant="caption">{success}</Typography>}
          <Button
            disabled={isCopying || !dir || !hasSelectedReplays}
            onClick={onCopy}
            variant="contained"
          >
            {isCopying ? 'Copying...' : 'Copy'}
          </Button>
        </Stack>
      </Stack>
    </>
  );
}
