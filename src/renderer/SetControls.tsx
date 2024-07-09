import { Backup } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import styled from '@emotion/styled';
import {
  ChallongeMatchItem,
  EnforceResult,
  Mode,
  Player,
  Replay,
  ReportSettings,
  Set,
  StartggGame,
  StartggGameSelection,
  StartggSet,
  State,
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
const getCharacterIcon = (characterId?: number) => {
  try {
    return characterIcons(`./${characterId}/0/stock.png`);
  } catch (e: any) {
    return characterIcons('./31/0/stock.png');
  }
};

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

function setAndReplaysValid(selectedReplays: Replay[], set: Set, mode: Mode) {
  if (selectedReplays.length === 0) {
    return false;
  }
  if (mode === Mode.CHALLONGE && set.state === State.COMPLETED) {
    return false;
  }

  return selectedReplays.every((replay) => {
    const validPlayers = replay.players.filter(isValid);
    const numPlayers =
      set.entrant1Participants.length + set.entrant2Participants.length;
    return (
      set.id &&
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
  reportChallongeSet,
  reportStartggSet,
  setReportSettings,
  mode,
  copyDisabled,
  dqId,
  reportSettings,
  selectedReplays,
  set,
  useEnforcer,
  vlerkMode,
}: {
  copyReplays: (set?: Set) => Promise<void>;
  deleteReplays: () => Promise<void>;
  reportChallongeSet: (
    matchId: number,
    items: ChallongeMatchItem[],
  ) => Promise<Set>;
  reportStartggSet: (
    set: StartggSet,
    update: boolean,
  ) => Promise<Set | undefined>;
  setReportSettings: (newReportSettings: ReportSettings) => Promise<void>;
  mode: Mode;
  copyDisabled: boolean;
  dqId: number;
  reportSettings: ReportSettings;
  selectedReplays: Replay[];
  set: Set;
  useEnforcer: boolean;
  vlerkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportErrorOpen, setReportErrorOpen] = useState(false);
  const [startggSet, setStartggSet] = useState<StartggSet>({
    setId: set.id,
    winnerId: 0,
    isDQ: false,
    gameData: [],
  });
  const [challongeMatchItems, setChallongeMatchItems] = useState<
    ChallongeMatchItem[]
  >([
    {
      participant_id: '',
      score_set: '',
      rank: 0,
      advancing: false,
    },
    {
      participant_id: '',
      score_set: '',
      rank: 0,
      advancing: false,
    },
  ]);

  const [enforcing, setEnforcing] = useState(false);
  const [enforcerErrors, setEnforcerErrors] = useState<EnforceResult[]>([]);
  const [enforcerErrorOpen, setEnforcerErrorOpen] = useState(false);

  const isDq = dqId === set.entrant1Id || dqId === set.entrant2Id;
  const validSelections = setAndReplaysValid(selectedReplays, set, mode);
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

  const getStartggSet = (): StartggSet => {
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

  const getChallongeMatchItems = (): ChallongeMatchItem[] => [
    {
      participant_id: set.entrant1Id.toString(10),
      score_set: entrant1Score.toString(10),
      rank: winnerId === set.entrant1Id ? 1 : 2,
      advancing: winnerId === set.entrant1Id,
    },
    {
      participant_id: set.entrant2Id.toString(10),
      score_set: entrant2Score.toString(10),
      rank: winnerId === set.entrant2Id ? 1 : 2,
      advancing: winnerId === set.entrant2Id,
    },
  ];

  const reportCopyDelete = `Report${reportSettings.alsoCopy ? ', Copy' : ''}${
    reportSettings.alsoCopy && reportSettings.alsoDelete ? ', Delete' : ''
  }`;
  return (
    <>
      <Button
        disabled={!(validSelections && (winnerId || isDq))}
        endIcon={<Backup />}
        onClick={() => {
          setStartggSet(getStartggSet());
          setChallongeMatchItems(getChallongeMatchItems());
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
        <DialogTitle>
          Report set on {mode === Mode.STARTGG && 'start.gg'}
          {mode === Mode.CHALLONGE && 'Challonge'}
        </DialogTitle>
        <DialogContent sx={{ width: '500px' }}>
          <SetView
            entrant1Names={set.entrant1Participants.map((participant) => ({
              name: participant.displayName,
            }))}
            entrant1Score={entrant1Score.toString()}
            entrant1Win={set.entrant1Id === winnerId}
            entrant2Names={set.entrant2Participants.map((participant) => ({
              name: participant.displayName,
            }))}
            entrant2Score={entrant2Score.toString()}
            fullRoundText={set.fullRoundText}
            state={set.state}
            showScores
            wasReported={vlerkMode && set.wasReported}
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
                    {set.entrant1Participants.length === 1 && (
                      <Avatar
                        alt={characterNames.get(
                          startggCharacterIds.get(
                            gameData.selections[0].characterId,
                          )!,
                        )}
                        src={getCharacterIcon(
                          startggCharacterIds.get(
                            gameData.selections[0].characterId,
                          ),
                        )}
                        sx={{ height: 24, width: 24 }}
                        variant="square"
                      />
                    )}
                    <EntrantText flexGrow={1} textAlign="right">
                      <Name>{set.entrant1Participants[0].displayName}</Name>
                      {set.entrant1Participants.length > 1 && (
                        <Name>{set.entrant1Participants[1].displayName}</Name>
                      )}
                    </EntrantText>
                  </EntrantSection>
                  <EntrantSection borderLeft={1} direction="row">
                    <EntrantScore>
                      {set.entrant2Id === gameData.winnerId ? 'W' : 'L'}
                    </EntrantScore>
                    {set.entrant2Participants.length === 1 && (
                      <Avatar
                        alt={characterNames.get(
                          startggCharacterIds.get(
                            gameData.selections[1].characterId,
                          )!,
                        )}
                        src={getCharacterIcon(
                          startggCharacterIds.get(
                            gameData.selections[1].characterId,
                          ),
                        )}
                        sx={{ height: 24, width: 24 }}
                        variant="square"
                      />
                    )}
                    <EntrantText flexGrow={1}>
                      <Name>{set.entrant2Participants[0].displayName}</Name>
                      {set.entrant2Participants.length > 1 && (
                        <Name>{set.entrant2Participants[1].displayName}</Name>
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
              checked={reportSettings.alsoCopy}
              label="Also Copy"
              labelPlacement="start"
              set={(checked: boolean) => {
                const newReportSettings = { ...reportSettings };
                newReportSettings.alsoCopy = checked;
                setReportSettings(newReportSettings);
              }}
            />
            <LabeledCheckbox
              checked={reportSettings.alsoDelete}
              disabled={!reportSettings.alsoCopy}
              label="Also Delete"
              labelPlacement="start"
              set={(checked: boolean) => {
                const newReportSettings = { ...reportSettings };
                newReportSettings.alsoDelete = checked;
                setReportSettings(newReportSettings);
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={
              reporting ||
              (reportSettings.alsoCopy && copyDisabled) ||
              enforcing
            }
            endIcon={
              reporting || enforcing ? (
                <CircularProgress size="24px" />
              ) : (
                <Backup />
              )
            }
            onClick={async () => {
              setReporting(true);
              try {
                let updatedSet: Set | undefined;
                if (mode === Mode.STARTGG) {
                  updatedSet = await reportStartggSet(
                    startggSet,
                    set.state === State.COMPLETED,
                  );
                } else if (mode === Mode.CHALLONGE) {
                  updatedSet = await reportChallongeSet(
                    set.id,
                    challongeMatchItems,
                  );
                }
                if (reportSettings.alsoCopy) {
                  await copyReplays(updatedSet);
                }
                if (reportSettings.alsoCopy && reportSettings.alsoDelete) {
                  await deleteReplays();
                }
                setOpen(false);
                setStartggSet({
                  setId: set.id,
                  winnerId: 0,
                  isDQ: false,
                  gameData: [],
                });
              } catch (e: any) {
                const message = e instanceof Error ? e.message : e;
                setReportError(message);
                setReportErrorOpen(true);
              } finally {
                setReporting(false);
              }
            }}
            variant="contained"
          >
            {reportCopyDelete}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={reportErrorOpen}
        onClose={() => {
          setReportErrorOpen(false);
          setReportError('');
        }}
      >
        <DialogTitle>{reportCopyDelete} error!</DialogTitle>
        <DialogContent>
          <DialogContentText>{reportError}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setReportErrorOpen(false);
              setReportError('');
            }}
          >
            Close
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
