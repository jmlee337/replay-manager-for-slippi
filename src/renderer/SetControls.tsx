import { Backup } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import styled from '@emotion/styled';
import {
  EnforceResult,
  Player,
  Replay,
  Set,
  StartggGame,
  StartggGameSelection,
  StartggSet,
} from '../common/types';
import {
  characterNames,
  characterStartggIds,
  isValidCharacter,
  stageNames,
  stageStartggIds,
  startggCharacterIds,
  startggStageIds,
} from '../common/constants';
import SetView from './SetView';
import LabeledCheckbox from './LabeledCheckbox';

const characterIcons = require.context('./characters', true);

const EntrantSection = styled(Stack)`
  align-items: center;
  width: 50%;
`;

const EntrantText = styled(Stack)`
  margin: 0 4px;
  min-width: 0;
`;

const EntrantScore = styled(EntrantText)`
  width: 16px;
`;

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

function isValid(player: Player) {
  return player.playerType === 0 || player.playerType === 1;
}

function findWinner(players: Player[]) {
  let overrideWinnerIndex = -1;
  let winnerIndex = -1;
  players.forEach((player, i) => {
    if (player.overrideWin) {
      overrideWinnerIndex = i;
    } else if (player.isWinner) {
      winnerIndex = i;
    }
  });
  if (overrideWinnerIndex >= 0) {
    return players[overrideWinnerIndex];
  }
  if (winnerIndex >= 0) {
    return players[winnerIndex];
  }
  return undefined;
}

function setAndReplaysValid(selectedReplays: Replay[], set: Set) {
  if (selectedReplays.length === 0) {
    return false;
  }

  return selectedReplays.every((replay) => {
    const validPlayers = replay.players.filter(isValid);
    const numPlayers = set.entrant1Names.length + set.entrant2Names.length;
    return (
      numPlayers === validPlayers.length &&
      validPlayers.every((player) => player.playerOverrides.entrantId) &&
      findWinner(validPlayers)
    );
  });
}

function getScoresAndWinnerId(selectedReplays: Replay[]) {
  const gameWins = new Map<number, number>();
  let leaderId = 0;
  let leaderWins = 0;
  selectedReplays.forEach((replay) => {
    const gameWinnerId = findWinner(replay.players.filter(isValid))
      ?.playerOverrides.entrantId!;

    const n = (gameWins.get(gameWinnerId) || 0) + 1;
    if (n > leaderWins) {
      leaderWins = n;
      leaderId = gameWinnerId;
    }
    gameWins.set(gameWinnerId, n);
  });

  return {
    scores: gameWins,
    winnerId: leaderWins / selectedReplays.length > 0.5 ? leaderId : 0,
  };
}

export default function SetControls({
  copyReplays,
  deleteReplays,
  reportSet,
  copyDisabled,
  dqId,
  selectedReplays,
  set,
  useEnforcer,
}: {
  copyReplays: () => Promise<void>;
  deleteReplays: () => Promise<void>;
  reportSet: (set: StartggSet, update: boolean) => Promise<void>;
  copyDisabled: boolean;
  dqId: number;
  selectedReplays: Replay[];
  set: Set;
  useEnforcer: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [startggSet, setStartggSet] = useState<StartggSet>({
    setId: set.id,
    winnerId: 0,
    isDQ: false,
    gameData: [],
  });

  const [alsoCopy, setAlsoCopy] = useState(false);
  const [alsoDelete, setAlsoDelete] = useState(false);

  const [enforcing, setEnforcing] = useState(false);
  const [enforcerErrors, setEnforcerErrors] = useState<EnforceResult[]>([]);
  const [enforcerErrorOpen, setEnforcerErrorOpen] = useState(false);

  const isDq = dqId === set.entrant1Id || dqId === set.entrant2Id;
  const validSelections = setAndReplaysValid(selectedReplays, set);
  let scores = new Map<number, number>();
  let winnerId = 0;
  if (validSelections) {
    ({ scores, winnerId } = getScoresAndWinnerId(selectedReplays));
  } else if (isDq) {
    if (dqId === set.entrant1Id) {
      scores.set(set.entrant1Id, -1);
      scores.set(set.entrant2Id, 0);
      winnerId = set.entrant2Id;
    } else {
      scores.set(set.entrant1Id, 0);
      scores.set(set.entrant2Id, -1);
      winnerId = set.entrant1Id;
    }
  }

  const entrant1Score = scores.get(set.entrant1Id) || 0;
  const entrant2Score = scores.get(set.entrant2Id) || 0;

  const getSet = (): StartggSet => {
    if (isDq) {
      return { setId: set.id, winnerId, isDQ: true, gameData: [] };
    }

    const gameData: StartggGame[] = selectedReplays.map((replay, i) => {
      let selections: StartggGameSelection[] = [];
      const validPlayers = replay.players.filter(
        (player) =>
          isValid(player) && isValidCharacter(player.externalCharacterId),
      );
      if (validPlayers.length === 2) {
        selections = validPlayers.map((player) => ({
          characterId: characterStartggIds.get(player.externalCharacterId)!,
          entrantId: player.playerOverrides.entrantId,
        }));
        if (selections[1].entrantId === set.entrant1Id) {
          selections = [selections[1], selections[0]];
        }
      }

      return {
        gameNum: i + 1,
        stageId: stageStartggIds.get(replay.stageId),
        selections,
        winnerId: findWinner(replay.players)?.playerOverrides.entrantId!,
      };
    });
    return { setId: set.id, winnerId, isDQ: false, gameData };
  };

  return (
    <>
      <Button
        disabled={!(validSelections && (winnerId || isDq))}
        endIcon={<Backup />}
        onClick={() => {
          setStartggSet(getSet());
          if (useEnforcer) {
            setEnforcing(true);
            window.electron
              .enforceReplays(selectedReplays)
              .then((enforceResults) => {
                const gameFailures = enforceResults.filter(
                  (enforceResult) => enforceResult.playerFailures.length > 0,
                );
                // eslint-disable-next-line promise/always-return
                if (gameFailures.length > 0) {
                  setEnforcerErrors(gameFailures);
                  setEnforcerErrorOpen(true);
                }
                setEnforcing(false);
              })
              .catch(() => {});
          }
          setOpen(true);
        }}
        size="small"
        variant="contained"
      >
        Report
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setStartggSet({
            setId: set.id,
            winnerId: 0,
            isDQ: false,
            gameData: [],
          });
        }}
      >
        <DialogTitle>Report set on start.gg</DialogTitle>
        <DialogContent sx={{ width: '500px' }}>
          <SetView
            entrant1Names={set.entrant1Names}
            entrant1Score={entrant1Score.toString()}
            entrant1Win={set.entrant1Id === winnerId}
            entrant2Names={set.entrant2Names}
            entrant2Score={entrant2Score.toString()}
            fullRoundText={set.fullRoundText}
            state={set.state}
            showScores
          />
          <Divider sx={{ marginTop: '8px' }} />
          <Stack flexGrow={1}>
            {startggSet.gameData.map((gameData) => (
              <Stack key={gameData.gameNum} marginTop="8px">
                {gameData.stageId && (
                  <Box sx={{ typography: 'caption' }} textAlign="center">
                    {stageNames.get(startggStageIds.get(gameData.stageId)!)}
                  </Box>
                )}
                <Stack direction="row" sx={{ typography: 'body2' }}>
                  <EntrantSection borderRight={1} direction="row-reverse">
                    <EntrantScore textAlign="right">
                      {set.entrant1Id === gameData.winnerId ? 'W' : 'L'}
                    </EntrantScore>
                    {set.entrant1Names.length === 1 && (
                      <Avatar
                        alt={characterNames.get(
                          startggCharacterIds.get(
                            gameData.selections[0].characterId,
                          )!,
                        )}
                        src={characterIcons(
                          `./${startggCharacterIds.get(
                            gameData.selections[0].characterId,
                          )}/0/stock.png`,
                        )}
                        sx={{ height: 24, width: 24 }}
                        variant="square"
                      />
                    )}
                    <EntrantText flexGrow={1} textAlign="right">
                      <Name>{set.entrant1Names[0]}</Name>
                      {set.entrant1Names.length > 1 && (
                        <Name>{set.entrant1Names[1]}</Name>
                      )}
                    </EntrantText>
                  </EntrantSection>
                  <EntrantSection borderLeft={1} direction="row">
                    <EntrantScore>
                      {set.entrant2Id === gameData.winnerId ? 'W' : 'L'}
                    </EntrantScore>
                    {set.entrant1Names.length === 1 && (
                      <Avatar
                        alt={characterNames.get(
                          startggCharacterIds.get(
                            gameData.selections[1].characterId,
                          )!,
                        )}
                        src={characterIcons(
                          `./${startggCharacterIds.get(
                            gameData.selections[1].characterId,
                          )}/0/stock.png`,
                        )}
                        sx={{ height: 24, width: 24 }}
                        variant="square"
                      />
                    )}
                    <EntrantText flexGrow={1}>
                      <Name>{set.entrant2Names[0]}</Name>
                      {set.entrant2Names.length > 1 && (
                        <Name>{set.entrant2Names[1]}</Name>
                      )}
                    </EntrantText>
                  </EntrantSection>
                </Stack>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ marginTop: '8px' }} />
          <Stack justifyContent="flex-end">
            <LabeledCheckbox
              checked={alsoCopy}
              label="Also Copy"
              labelPlacement="start"
              set={setAlsoCopy}
            />
            <LabeledCheckbox
              checked={alsoDelete}
              disabled={!alsoCopy}
              label="Also Delete"
              labelPlacement="start"
              set={setAlsoDelete}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={reporting || (alsoCopy && copyDisabled) || enforcing}
            endIcon={
              reporting || enforcing ? (
                <CircularProgress size="24px" />
              ) : (
                <Backup />
              )
            }
            onClick={async () => {
              setReporting(true);
              const promises = [reportSet(startggSet, set.state === 3)];
              if (alsoCopy) {
                promises.push(copyReplays());
              }
              await Promise.all(promises);
              if (alsoCopy && alsoDelete) {
                await deleteReplays();
              }
              setOpen(false);
              setReporting(false);
              setStartggSet({
                setId: set.id,
                winnerId: 0,
                isDQ: false,
                gameData: [],
              });
            }}
            variant="contained"
          >
            Report{alsoCopy && ', Copy'}
            {alsoCopy && alsoDelete && ', Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={enforcerErrorOpen}
        onClose={() => {
          setEnforcerErrorOpen(false);
          setEnforcerErrors([]);
        }}
      >
        <DialogTitle>SLP Enforcer!</DialogTitle>
        <DialogContent sx={{ width: '500px' }}>
          {enforcerErrors.map((enforcerResult) => (
            <Stack key={enforcerResult.fileName}>
              <Box typography="body2">{enforcerResult.fileName}</Box>
              {enforcerResult.playerFailures.map((enforcePlayerFailure) => (
                <Box
                  key={enforcePlayerFailure.port}
                  marginLeft="8px"
                  typography="caption"
                >
                  {enforcePlayerFailure.displayName}:{' '}
                  {enforcePlayerFailure.checkNames.join(', ')}
                </Box>
              ))}
            </Stack>
          ))}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEnforcerErrorOpen(false);
              setEnforcerErrors([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
