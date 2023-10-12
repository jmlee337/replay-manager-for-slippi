import { Backup, Save } from '@mui/icons-material';
import { Button, Stack, Tooltip } from '@mui/material';
import {
  Player,
  Replay,
  Set,
  StartggGameSelection,
  StartggSet,
} from '../common/types';
import {
  characterStartggIds,
  isValidCharacter,
  stageStartggIds,
} from '../common/constants';

function isValid(player: Player) {
  return player.playerType === 0 || player.playerType === 1;
}

function isWinner(player: Player) {
  return player.overrideWin || player.isWinner;
}

function setAndReplaysValid(selectedReplays: Replay[], set: Set) {
  if (set.state === 3 || selectedReplays.length === 0) {
    return false;
  }

  return selectedReplays.every((replay) => {
    const validPlayers = replay.players.filter(isValid);
    const numPlayers = set.entrant1Names.length + set.entrant2Names.length;
    return (
      numPlayers === validPlayers.length &&
      validPlayers.every((player) => player.playerOverrides.entrantId) &&
      validPlayers.find(isWinner)
    );
  });
}

function getWinnerId(selectedReplays: Replay[]) {
  const gameWins = new Map<number, number>();
  let leaderId = 0;
  let leaderWins = 0;
  selectedReplays.forEach((replay) => {
    const gameWinnerId = replay.players.filter(isValid).find(isWinner)
      ?.playerOverrides.entrantId!;

    const n = (gameWins.get(gameWinnerId) || 0) + 1;
    if (n > leaderWins) {
      leaderWins = n;
      leaderId = gameWinnerId;
    }
    gameWins.set(gameWinnerId, n);
  });

  return leaderWins / selectedReplays.length > 0.5 ? leaderId : 0;
}

export default function SetControls({
  selectedReplays,
  reportSet,
  set,
}: {
  selectedReplays: Replay[];
  reportSet: (set: StartggSet) => Promise<void>;
  set: Set;
}) {
  const validSelections = setAndReplaysValid(selectedReplays, set);
  let winnerId = 0;
  if (validSelections) {
    winnerId = getWinnerId(selectedReplays);
  }
  const enabled = validSelections && winnerId;

  const getSet = () => {
    const gameData = selectedReplays.map((replay, i) => {
      const selections: StartggGameSelection[] = replay.players
        .filter(
          (player) =>
            isValid(player) && isValidCharacter(player.externalCharacterId),
        )
        .map((player) => ({
          characterId: characterStartggIds.get(player.externalCharacterId)!,
          entrantId: player.playerOverrides.entrantId,
        }));

      return {
        gameNum: i + 1,
        stageId: stageStartggIds.get(replay.stageId),
        selections,
        winnerId: replay.players.find(isWinner)?.playerOverrides.entrantId!,
      };
    });
    return { gameData, setId: set.id, winnerId } as StartggSet;
  };

  return (
    <Stack direction="row" paddingTop="8px" spacing="8px">
      <Stack direction="row" justifyContent="center" width="50%">
        <Tooltip arrow title="Save locally">
          <div>
            <Button
              disabled={!enabled}
              endIcon={<Save />}
              onClick={() => console.log(getSet())}
              size="small"
              variant="contained"
            >
              Save
            </Button>
          </div>
        </Tooltip>
      </Stack>
      <Stack direction="row" justifyContent="center" width="50%">
        <Tooltip arrow title="Report on start.gg">
          <div>
            <Button
              disabled={!enabled}
              endIcon={<Backup />}
              onClick={() => reportSet(getSet())}
              size="small"
              variant="contained"
            >
              Report
            </Button>
          </div>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
