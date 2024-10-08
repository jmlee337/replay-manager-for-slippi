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
import { CopySettings, Output } from '../common/types';
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
  success,
  copySettings,
  setCopySettings,
  elevateSettings,
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
  success: string;
  copySettings: CopySettings;
  setCopySettings: (newCopySettings: CopySettings) => Promise<void>;
  elevateSettings: boolean;
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
        <Stack
          direction="row"
          justifyContent="right"
          bgcolor={elevateSettings ? 'white' : undefined}
          sx={{
            zIndex: (theme) =>
              elevateSettings ? theme.zIndex.drawer + 2 : undefined,
          }}
        >
          <Stack>
            <Tooltip
              arrow
              title="A file containing set metadata will be included in the copy folder/zip"
            >
              <div>
                <LabeledCheckbox
                  checked={copySettings.writeContext}
                  disabled={copySettings.output === Output.FILES}
                  label="Write context.json"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeContext = checked;
                    setCopySettings(newCopySettings);
                  }}
                />
              </div>
            </Tooltip>
          </Stack>
          <Stack>
            <Tooltip
              arrow
              title="Player tags will appear in the in-game HUD (like Slippi Broadcast/Online) depending on playback settings"
            >
              <div>
                <LabeledCheckbox
                  checked={copySettings.writeDisplayNames}
                  label="Overwrite Display Names"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeDisplayNames = checked;
                    setCopySettings(newCopySettings);
                  }}
                />
              </div>
            </Tooltip>
            <Tooltip
              arrow
              title="New file names will indicate game start time, player tags, and characters"
            >
              <div>
                <LabeledCheckbox
                  checked={copySettings.writeFileNames}
                  label="Overwrite File Names"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeFileNames = checked;
                    setCopySettings(newCopySettings);
                  }}
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
                  checked={copySettings.writeStartTimes}
                  label="Overwrite Start Times"
                  set={(checked: boolean) => {
                    const newCopySettings = { ...copySettings };
                    newCopySettings.writeStartTimes = checked;
                    setCopySettings(newCopySettings);
                  }}
                />
              </div>
            </Tooltip>
            <TextField
              label="Output"
              onChange={(event) => {
                const newCopySettings = { ...copySettings };
                newCopySettings.output = parseInt(event.target.value, 10);
                setCopySettings(newCopySettings);
              }}
              select
              size="small"
              value={copySettings.output}
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
            messages={[error]}
            onClose={() => {
              setError('');
              setErrorDialogOpen(false);
            }}
            open={errorDialogOpen}
          />
          {success && <Typography variant="caption">{success}</Typography>}
          <Button
            disabled={isCopying || !dir || !hasSelectedReplays}
            onClick={async () => {
              try {
                await onCopy();
              } catch (e: any) {
                const message = e instanceof Error ? e.message : e;
                setError(message);
                setErrorDialogOpen(true);
              }
            }}
            variant="contained"
          >
            {isCopying ? 'Copying...' : 'Copy'}
          </Button>
        </Stack>
      </Stack>
    </>
  );
}
