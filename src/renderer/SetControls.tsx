import { Backup, Save } from '@mui/icons-material';
import { Button, Stack, Tooltip } from '@mui/material';
import {
  Replay,
  Set,
  StartggGame,
  StartggGameSelection,
  StartggSet,
} from '../common/types';
import { characterStartggIds, stageStartggIds } from '../common/constants';

export default function SetControls({
  entrantIds,
  selectedReplays,
  reportSet,
  set,
}: {
  entrantIds: number[];
  selectedReplays: Replay[];
  reportSet: (set: StartggSet) => Promise<void>;
  set: Set;
}) {
  let disabled = false;
  if (
    set.state === 3 ||
    selectedReplays.length === 0 ||
    selectedReplays.length % 2 === 0
  ) {
    disabled = true;
  } else {
    disabled = !selectedReplays.every((replay) => {
      const humanPlayers = replay.players.filter(
        (player) => player.playerType === 0,
      );
      const validEntrantIds = entrantIds.filter((entrantId) => entrantId !== 0);
      const numPlayers = set.entrant1Names.length + set.entrant2Names.length;
      return (
        numPlayers === validEntrantIds.length &&
        humanPlayers.every((player) => entrantIds[player.port - 1] !== 0)
      );
    });
  }

  const getSet = () => {
    const gameData = selectedReplays.map((replay, i) => {
      let selections = [] as StartggGameSelection[];
      if (entrantIds.filter((entrantId) => entrantId).length === 2) {
        selections = replay.players
          .map((player, j) => {
            let characterId = 0;
            let entrantId = 0;
            if (player.playerType === 0) {
              characterId = characterStartggIds.get(
                player.externalCharacterId,
              )!;
              entrantId = entrantIds[j];
            }
            return { characterId, entrantId } as StartggGameSelection;
          })
          .filter(
            (selection) =>
              selection.characterId !== 0 && selection.entrantId !== 0,
          );
      }

      return {
        gameNum: i + 1,
        stageId: stageStartggIds.get(replay.stageId),
        selections,
        winnerId:
          entrantIds[replay.players.findIndex((player) => player.isWinner)],
      } as StartggGame;
    });

    const gameWins = new Map<number, number>();
    let maxGames = 0;
    let winnerId = 0;
    gameData.forEach((game) => {
      const n = (gameWins.get(game.winnerId) || 0) + 1;
      if (n > maxGames) {
        maxGames = n;
        winnerId = game.winnerId;
      }
      gameWins.set(game.winnerId, n);
    });

    return { gameData, setId: set.id, winnerId } as StartggSet;
  };

  return (
    <Stack direction="row" paddingTop="8px" spacing="8px">
      <Stack direction="row" justifyContent="center" width="50%">
        <Tooltip arrow title="Save locally">
          <div>
            <Button
              disabled={disabled}
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
              disabled={disabled}
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
