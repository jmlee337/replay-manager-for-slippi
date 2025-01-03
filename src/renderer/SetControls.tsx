import { Backup, VideogameAssetOff } from '@mui/icons-material';
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
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import { MouseEventHandler, useState } from 'react';
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

function setAndReplaysValid(selectedReplays: Replay[], set: Set, mode: Mode) {
  if (selectedReplays.length === 0) {
    return { valid: false, reason: 'No replays selected' };
  }
  if (mode === Mode.CHALLONGE && set.state === State.COMPLETED) {
    return { valid: false, reason: 'Set already completed' };
  }

  let reason = '';
  const valid = selectedReplays.every((replay, i) => {
    if (set.id === 0) {
      if (!reason) {
        reason = 'No set selected';
      }
      return false;
    }
    if (Number.isInteger(set.id) && (set.id as number) < 0) {
      if (!reason) {
        reason = 'Tiebreaker sets cannot be reported';
      }
      return false;
    }

    const validPlayers = replay.players.filter(isValid);
    if (
      validPlayers.length !==
      set.entrant1Participants.length + set.entrant2Participants.length
    ) {
      if (!reason) {
        reason = `Game ${i + 1} has wrong number of players`;
      }
      return false;
    }
    if (!(validPlayers.find((player) => player.isWinner) || replay.timeout)) {
      if (!reason) {
        reason = `Game ${i + 1} does not have a winner`;
      }
      return false;
    }
    if (!validPlayers.every((player) => player.playerOverrides.entrantId)) {
      if (!reason) {
        reason = `Game ${i + 1} does not have all players assigned`;
      }
      return false;
    }
    return true;
  });

  return { valid, reason };
}

function getScoresAndWinnerId(selectedReplays: Replay[]) {
  let gameCount = 0;
  const gameWins = new Map<number, number>();
  let leaderId = 0;
  let leaderWins = 0;
  selectedReplays.forEach((replay) => {
    const gameWinnerId = replay.players
      .filter(isValid)
      .find((player) => player.isWinner)?.playerOverrides.entrantId;
    if (!gameWinnerId) {
      return;
    }

    const n = (gameWins.get(gameWinnerId) || 0) + 1;
    if (n > leaderWins) {
      leaderWins = n;
      leaderId = gameWinnerId;
    }
    gameCount += 1;
    gameWins.set(gameWinnerId, n);
  });

  return {
    scores: gameWins,
    winnerId: leaderWins / gameCount > 0.5 ? leaderId : 0,
  };
}

function ReportButton({
  disabled,
  elevate,
  onClick,
}: {
  disabled?: boolean;
  elevate: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <Button
      disabled={disabled}
      endIcon={<Backup />}
      onClick={onClick}
      size="small"
      variant="contained"
      sx={{
        zIndex: (theme) => (elevate ? theme.zIndex.drawer + 2 : undefined),
      }}
    >
      Report
    </Button>
  );
}
ReportButton.defaultProps = {
  disabled: false,
  onClick: undefined,
};

export default function SetControls({
  copyReplays,
  deleteReplays,
  reportChallongeSet,
  reportStartggSet,
  setReportSettings,
  resetGuide,
  mode,
  copyDisabled,
  dqId,
  hasRemainingReplays,
  reportSettings,
  selectedReplays,
  set,
  useEnforcer,
  vlerkMode,
  elevate,
}: {
  copyReplays: (set?: Set, violatorDisplayNames?: string[]) => Promise<void>;
  deleteReplays: () => Promise<void>;
  reportChallongeSet: (
    matchId: number,
    items: ChallongeMatchItem[],
  ) => Promise<Set>;
  reportStartggSet: (set: StartggSet, update: boolean) => Promise<Set>;
  setReportSettings: (newReportSettings: ReportSettings) => Promise<void>;
  resetGuide: () => void;
  mode: Mode;
  copyDisabled: boolean;
  dqId: number;
  hasRemainingReplays: boolean;
  reportSettings: ReportSettings;
  selectedReplays: Replay[];
  set: Set;
  useEnforcer: boolean;
  vlerkMode: boolean;
  elevate: boolean;
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
  if (validSelections.valid) {
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

    const gameData: StartggGame[] = [];
    selectedReplays.forEach((replay, i) => {
      const gameWinnerId = replay.players.find((player) => player.isWinner)
        ?.playerOverrides.entrantId;
      if (!gameWinnerId) {
        return;
      }

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
      gameData.push({
        gameNum: i + 1,
        stageId: stageStartggIds.get(replay.stageId),
        selections,
        winnerId: gameWinnerId,
      });
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

  const gfDeleteOverride =
    set.fullRoundText === 'Grand Final' && hasRemainingReplays;
  let reportCopyDelete = '';
  if (enforcing) {
    reportCopyDelete = 'Checking with SLP Enforcer';
  } else if (reportSettings.alsoCopy && copyDisabled) {
    reportCopyDelete = 'Copy folder not set';
  } else {
    reportCopyDelete = 'Report';
    if (reportSettings.alsoCopy) {
      reportCopyDelete += ', Copy';
    }
    if (reportSettings.alsoDelete) {
      reportCopyDelete += ', Delete';
    }
  }
  return (
    <>
      {validSelections.valid && (winnerId || isDq) ? (
        <ReportButton
          elevate={elevate}
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
                .catch(() => {
                  setEnforcing(false);
                });
            }
            setOpen(true);
          }}
        />
      ) : (
        <Tooltip
          arrow
          title={!validSelections.valid ? validSelections.reason : 'No winner'}
        >
          <div>
            <ReportButton disabled elevate={elevate} />
          </div>
        </Tooltip>
      )}
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
          setEnforcerErrors([]);
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
              label="Copy replays after reporting"
              labelPlacement="start"
              set={(checked: boolean) => {
                const newReportSettings = { ...reportSettings };
                newReportSettings.alsoCopy = checked;
                setReportSettings(newReportSettings);
              }}
            />
            <LabeledCheckbox
              checked={reportSettings.alsoDelete}
              disabled={!reportSettings.alsoCopy || gfDeleteOverride}
              label={
                gfDeleteOverride
                  ? 'Delete disabled, possible Grand Finals Reset replays detected'
                  : '...then delete originals and eject'
              }
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
          {enforcerErrors.length > 0 && (
            <Tooltip
              placement="top"
              title="Controller Ruleset Violation Detected"
            >
              <IconButton
                onClick={() => {
                  setEnforcerErrorOpen(true);
                }}
              >
                <VideogameAssetOff />
              </IconButton>
            </Tooltip>
          )}
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
                    set.id as number,
                    challongeMatchItems,
                  );
                }
                if (reportSettings.alsoCopy) {
                  const entrantIdToDisplayName = new Map<number, string>();
                  enforcerErrors.forEach(({ playerFailures }) => {
                    playerFailures.forEach((playerFailure) => {
                      if (
                        playerFailure.displayName &&
                        playerFailure.entrantId
                      ) {
                        entrantIdToDisplayName.set(
                          playerFailure.entrantId,
                          playerFailure.displayName,
                        );
                      }
                    });
                  });
                  await copyReplays(
                    updatedSet,
                    Array.from(entrantIdToDisplayName.values()),
                  );
                }
                if (
                  reportSettings.alsoCopy &&
                  reportSettings.alsoDelete &&
                  !gfDeleteOverride
                ) {
                  await deleteReplays();
                }
                setOpen(false);
                setStartggSet({
                  setId: set.id,
                  winnerId: 0,
                  isDQ: false,
                  gameData: [],
                });
                setEnforcerErrors([]);
                resetGuide();
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
        }}
      >
        <DialogTitle>Controller Ruleset Violation Detected</DialogTitle>
        <DialogContent sx={{ width: '500px' }}>
          <Stack spacing="8px">
            {enforcerErrors.map((enforcerResult) => (
              <Box key={enforcerResult.fileName}>
                <Box typography="caption">
                  ({enforcerResult.gameNum}){' '}
                  {stageNames.get(enforcerResult.stageId)}
                </Box>
                {enforcerResult.playerFailures.map((enforcePlayerFailure) => (
                  <Box key={enforcePlayerFailure.port} typography="body2">
                    {enforcePlayerFailure.displayName}:{' '}
                    {enforcePlayerFailure.checkNames.join(', ')}
                  </Box>
                ))}
              </Box>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
