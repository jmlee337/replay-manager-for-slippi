import { FolderOpen } from '@mui/icons-material';
import {
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  InputBase,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChangeEvent, useState } from 'react';
import { format } from 'date-fns';
import { Replay } from '../common/types';
import { characterNames } from '../common/constants';
import ErrorDialog from './ErrorDialog';

function LabeledCheckbox({
  checked,
  label,
  set,
}: {
  checked: boolean;
  label: string;
  set: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            set(event.target.checked);
          }}
        />
      }
      disableTypography
      label={label}
      sx={{ typography: 'caption' }}
    />
  );
}

type NameObj = {
  characterName: string;
  displayName: string;
  nametag: string;
};

type NamesObj = {
  characterNames: Map<string, number>;
  displayName: string;
  nametags: Map<string, number>;
};

export default function CopyControls({
  selectedReplays,
}: {
  selectedReplays: Replay[];
}) {
  const [error, setError] = useState('');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  const [success, setSuccess] = useState('');
  const showSuccess = () => {
    setSuccess('Success!');
    setTimeout(() => setSuccess(''), 5000);
  };

  const [dir, setDir] = useState('');
  const chooseDir = async () => {
    const openDialogRes = await window.electron.chooseDir();
    if (!openDialogRes.canceled) {
      const newDir = openDialogRes.filePaths[0];
      setDir(newDir);
    }
  };

  const [writeDisplayNames, setWriteDisplayNames] = useState(true);
  const [writeFileNames, setWriteFileNames] = useState(false);
  const [writeStartTimes, setWriteStartTimes] = useState(true);
  const [makeNewFolder, setMakeNewFolder] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const onCopy = async () => {
    setIsCopying(true);

    let offsetMs = 0;
    let startDate = new Date(selectedReplays[0].startAt);
    if (writeStartTimes) {
      const lastReplay = selectedReplays[selectedReplays.length - 1];
      const lastStartMs = new Date(lastReplay.startAt).getTime();
      const lastDurationMs = Math.round((lastReplay.lastFrame + 124) / 0.05994);
      offsetMs = Date.now() - lastStartMs - lastDurationMs;
      startDate = new Date(
        new Date(selectedReplays[0].startAt).getTime() + offsetMs,
      );
    }

    let fileNames = selectedReplays.map((replay) => replay.fileName);
    let subdir = '';
    if (writeFileNames || makeNewFolder) {
      const nameObjs = selectedReplays.map((replay) =>
        replay.players.map((player) =>
          player.playerType === 0 || player.playerType === 1
            ? ({
                characterName: characterNames.get(player.externalCharacterId),
                displayName: writeDisplayNames
                  ? player.playerOverrides.displayName || player.displayName
                  : player.displayName,
                nametag: player.nametag,
              } as NameObj)
            : ({ characterName: '', displayName: '', nametag: '' } as NameObj),
        ),
      );

      const toLabel = (nameObj: NameObj) => {
        if (nameObj.displayName) {
          return `${nameObj.displayName} (${nameObj.characterName})`;
        }
        if (nameObj.nametag) {
          return `${nameObj.characterName} (${nameObj.nametag})`;
        }
        return nameObj.characterName;
      };

      if (makeNewFolder) {
        const folderLabels = nameObjs
          .reduce(
            (namesObj, game) => {
              game.forEach((nameObj, i) => {
                if (nameObj.characterName) {
                  namesObj[i].displayName = nameObj.displayName;

                  const charCount =
                    namesObj[i].characterNames.get(nameObj.characterName) || 0;
                  namesObj[i].characterNames.set(
                    nameObj.characterName,
                    charCount + 1,
                  );

                  const nameCount =
                    namesObj[i].nametags.get(nameObj.nametag) || 0;
                  namesObj[i].nametags.set(nameObj.nametag, nameCount + 1);
                }
              });
              return namesObj;
            },
            [
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              } as NamesObj,
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              } as NamesObj,
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              } as NamesObj,
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              } as NamesObj,
            ],
          )
          .map((namesObj) => ({
            displayName: namesObj.displayName,
            characterName: [...namesObj.characterNames.entries()]
              .sort(
                (entryA: [string, number], entryB: [string, number]) =>
                  entryB[1] - entryA[1],
              )
              .map((entry) => entry[0])
              .join(', '),
            nametag: [...namesObj.nametags.entries()]
              .sort(
                (entryA: [string, number], entryB: [string, number]) =>
                  entryB[1] - entryA[1],
              )
              .map((entry) => entry[0])
              .join(', '),
          }))
          .filter((nameObj) => nameObj.characterName)
          .map(toLabel)
          .join(', ');
        const writeStartAt = format(startDate, "yyyyMMdd'T'HHmmss");
        subdir = `${writeStartAt} ${folderLabels}`;
      }

      if (writeFileNames) {
        fileNames = nameObjs.map((game, i) => {
          let prefix = `${i + 1}`;
          if (!makeNewFolder) {
            const { startAt } = selectedReplays[i];
            const writeStartDate = writeStartTimes
              ? new Date(new Date(startAt).getTime() + offsetMs)
              : new Date(startAt);
            const writeStartAt = format(writeStartDate, "yyyyMMdd'T'HHmmss");
            prefix = `${writeStartAt}_${prefix}`;
          }
          const labels = game
            .filter((nameObj) => nameObj.characterName)
            .map(toLabel)
            .join(', ');
          return `${prefix} ${labels}.slp`;
        });
      }
    }

    let startTimes: string[] = [];
    if (writeStartTimes) {
      startTimes = selectedReplays.map((replay) =>
        new Date(new Date(replay.startAt).getTime() + offsetMs).toISOString(),
      );
    }

    try {
      await window.electron.writeReplays(
        dir,
        fileNames,
        selectedReplays,
        startTimes,
        subdir,
        writeDisplayNames,
      );
      showSuccess();
    } catch (e: any) {
      setError(e.toString());
      setErrorDialogOpen(true);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <>
      <Divider />
      <Stack paddingLeft="58px">
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
            <LabeledCheckbox
              checked={writeDisplayNames}
              label="Overwrite Display Names"
              set={setWriteDisplayNames}
            />
            <LabeledCheckbox
              checked={writeFileNames}
              label="Overwrite File Names"
              set={setWriteFileNames}
            />
          </Stack>
          <Stack>
            <LabeledCheckbox
              checked={writeStartTimes}
              label="Overwrite Start Times"
              set={setWriteStartTimes}
            />
            <LabeledCheckbox
              checked={makeNewFolder}
              label="Make New Subfolder"
              set={setMakeNewFolder}
            />
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
            disabled={isCopying || !dir || selectedReplays.length === 0}
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
