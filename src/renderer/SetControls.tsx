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
  Typography,
} from '@mui/material';
import { MouseEventHandler, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  ChallongeMatchItem,
  EnforceState,
  EnforceStatus,
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
import LabeledCheckbox from './LabeledCheckbox';
import getCharacterIcon from './getCharacterIcon';

const bgColor = 'rgba(34, 178, 76, 0.2)';

function getCharacterIconInner(
  characterId: number | undefined,
  costumeIndex?: number,
) {
  if (characterId === undefined) {
    return getCharacterIcon(31, 0);
  }
  if (costumeIndex === undefined) {
    return getCharacterIcon(characterId, 0);
  }
  return getCharacterIcon(characterId, costumeIndex);
}

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

function getDisplayNameFromPlayer(player?: Player) {
  return player?.playerOverrides.displayName || player?.displayName;
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
  isCopying,
  copyDisabled,
  isDeleting,
  dqId,
  hasRemainingReplays,
  reportSettings,
  selectedReplays,
  set,
  elevate,
  enforcerVersion,
  showEnforcerPopup,
  smuggleCostumeIndex,
  wouldDeleteCopyDir,
}: {
  copyReplays: (
    set?: Set,
    violators?: {
      checkNames: Map<string, boolean>;
      displayName: string;
      entrantId: number;
    }[],
  ) => Promise<void>;
  deleteReplays: () => Promise<void>;
  reportChallongeSet: (
    matchId: number,
    items: ChallongeMatchItem[],
  ) => Promise<Set>;
  reportStartggSet: (
    set: StartggSet,
    entrant1Id: number,
    entrant2Id: number,
    update: boolean,
  ) => Promise<Set>;
  setReportSettings: (newReportSettings: ReportSettings) => Promise<void>;
  resetGuide: () => void;
  mode: Mode;
  isCopying: boolean;
  copyDisabled: boolean;
  isDeleting: boolean;
  dqId: number;
  hasRemainingReplays: boolean;
  reportSettings: ReportSettings;
  selectedReplays: Replay[];
  set: Set;
  elevate: boolean;
  enforcerVersion: string;
  showEnforcerPopup: boolean;
  smuggleCostumeIndex: boolean;
  wouldDeleteCopyDir: boolean;
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

  const [enforcerErrorOpen, setEnforcerErrorOpen] = useState(false);
  const [enforceState, setEnforceState] = useState<EnforceState>({
    status: EnforceStatus.DONE,
    fileNameToPlayerFailures: new Map(),
  });
  useEffect(() => {
    window.electron.onEnforceState((event, newEnforceState) => {
      setEnforceState(newEnforceState);
    });
  }, []);
  const selectedReplaysWithEnforceErrors = selectedReplays.filter((replay) =>
    enforceState.fileNameToPlayerFailures.has(replay.fileName),
  );

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

  const entrant1SetScore = scores.get(set.entrant1Id) || 0;
  const entrant2SetScore = scores.get(set.entrant2Id) || 0;

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

      const originalEntrant1Score = set.gameScores[i]?.entrant1Score ?? 0;
      const originalEntrant2Score = set.gameScores[i]?.entrant2Score ?? 0;
      let entrant1CostumeOffset = Math.floor(originalEntrant1Score / 100) * 100;
      let entrant2CostumeOffset = Math.floor(originalEntrant2Score / 100) * 100;
      let entrant1Stocks = originalEntrant1Score % 100;
      let entrant2Stocks = originalEntrant2Score % 100;
      const selections: StartggGameSelection[] = [];
      const validPlayers = replay.players.filter(
        (player) =>
          isValid(player) && isValidCharacter(player.externalCharacterId),
      );
      if (validPlayers.length === 2) {
        validPlayers.forEach((player) => {
          const { entrantId } = player.playerOverrides;
          selections.push({
            characterId: characterStartggIds.get(player.externalCharacterId)!,
            entrantId,
          });
          if (entrantId === set.entrant1Id) {
            if (smuggleCostumeIndex) {
              entrant1CostumeOffset = (player.costumeIndex + 1) * 100;
            }
            if (player.stocksRemaining >= 0) {
              entrant1Stocks = player.stocksRemaining;
            }
          } else {
            if (smuggleCostumeIndex) {
              entrant2CostumeOffset = (player.costumeIndex + 1) * 100;
            }
            if (player.stocksRemaining >= 0) {
              entrant2Stocks = player.stocksRemaining;
            }
          }
        });
        if (selections[1].entrantId === set.entrant1Id) {
          [selections[0], selections[1]] = [selections[1], selections[0]];
        }
      }
      gameData.push({
        entrant1Score: entrant1CostumeOffset + entrant1Stocks,
        entrant2Score: entrant2CostumeOffset + entrant2Stocks,
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
      score_set: entrant1SetScore.toString(10),
      rank: winnerId === set.entrant1Id ? 1 : 2,
      advancing: winnerId === set.entrant1Id,
    },
    {
      participant_id: set.entrant2Id.toString(10),
      score_set: entrant2SetScore.toString(10),
      rank: winnerId === set.entrant2Id ? 1 : 2,
      advancing: winnerId === set.entrant2Id,
    },
  ];

  let deleteOverrideReason = '';
  if (set.fullRoundText === 'Grand Final' && hasRemainingReplays) {
    deleteOverrideReason = 'possible Grand Finals Reset replays detected';
  } else if (wouldDeleteCopyDir) {
    deleteOverrideReason = 'would delete replays in copy folder';
  }

  let reportCopyDeleteIntent = 'Report';
  if (reportSettings.alsoCopy) {
    reportCopyDeleteIntent += ', Copy';
  }
  if (reportSettings.alsoDelete) {
    reportCopyDeleteIntent += ', Delete';
  }

  let reportCopyDeleteButton = reportCopyDeleteIntent;
  if (enforceState.status === EnforceStatus.PENDING) {
    reportCopyDeleteButton = 'Checking with SLP Enforcer';
  } else if (reportSettings.alsoCopy && copyDisabled) {
    reportCopyDeleteButton = 'Copy destination not set';
  } else if (reportSettings.alsoCopy && isCopying) {
    reportCopyDeleteButton = 'Copying';
  } else if (reportSettings.alsoDelete && isDeleting) {
    reportCopyDeleteButton = 'Deleting';
  } else if (reporting) {
    reportCopyDeleteButton = 'Reporting';
  }
  return (
    <>
      {validSelections.valid && (winnerId || isDq) ? (
        <ReportButton
          elevate={elevate}
          onClick={() => {
            setStartggSet(getStartggSet());
            setChallongeMatchItems(getChallongeMatchItems());
            if (
              selectedReplaysWithEnforceErrors.length > 0 &&
              showEnforcerPopup
            ) {
              setEnforcerErrorOpen(true);
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
        }}
      >
        <DialogTitle typography="body1">
          Report set on {mode === Mode.STARTGG && 'start.gg'}
          {mode === Mode.CHALLONGE && 'Challonge'}
        </DialogTitle>
        <DialogContent sx={{ width: '500px' }}>
          <Stack>
            <Box sx={{ typography: 'caption' }} textAlign="center">
              {set.fullRoundText}
            </Box>
            <Stack
              alignItems="center"
              direction="row"
              sx={{ typography: 'h5' }}
            >
              <EntrantSection
                borderRight={1}
                direction="row-reverse"
                style={{
                  backgroundColor:
                    set.entrant1Id === startggSet.winnerId
                      ? bgColor
                      : undefined,
                }}
              >
                <Box marginRight="8px" width="24px" textAlign="right">
                  {entrant1SetScore}
                </Box>
                <Stack textAlign="right">
                  <Name>{set.entrant1Participants[0].displayName}</Name>
                  {set.entrant1Participants.length > 1 && (
                    <Name>{set.entrant1Participants[1].displayName}</Name>
                  )}
                </Stack>
              </EntrantSection>
              <EntrantSection
                borderLeft={1}
                direction="row"
                style={{
                  backgroundColor:
                    set.entrant2Id === startggSet.winnerId
                      ? bgColor
                      : undefined,
                }}
              >
                <Box marginLeft="8px" width="24px">
                  {entrant2SetScore}
                </Box>
                <Stack>
                  <Name>{set.entrant2Participants[0].displayName}</Name>
                  {set.entrant2Participants.length > 1 && (
                    <Name>{set.entrant2Participants[1].displayName}</Name>
                  )}
                </Stack>
              </EntrantSection>
            </Stack>
          </Stack>
          <Divider sx={{ marginTop: '16px' }} />
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
                    <Stack
                      alignItems="center"
                      direction="row-reverse"
                      paddingTop="4px"
                      paddingBottom="4px"
                      paddingLeft={
                        set.entrant1Participants.length === 1
                          ? '4px'
                          : undefined
                      }
                      style={{
                        backgroundColor:
                          set.entrant1Id === gameData.winnerId
                            ? bgColor
                            : undefined,
                      }}
                    >
                      <EntrantScore textAlign="right">
                        {set.entrant1Id === gameData.winnerId && 'W'}
                      </EntrantScore>
                      {set.entrant1Participants.length === 1 && (
                        <Avatar
                          alt={characterNames.get(
                            startggCharacterIds.get(
                              gameData.selections[0].characterId,
                            )!,
                          )}
                          src={getCharacterIconInner(
                            startggCharacterIds.get(
                              gameData.selections[0].characterId,
                            ),
                            gameData.entrant1Score >= 100
                              ? Math.floor(gameData.entrant1Score / 100) - 1
                              : undefined,
                          )}
                          sx={{ height: 24, width: 24 }}
                          variant="square"
                        />
                      )}
                    </Stack>
                    {set.entrant1Participants.length === 1 &&
                      set.entrant1Id === gameData.winnerId &&
                      gameData.entrant1Score % 100 && (
                        <Tooltip
                          placement="left"
                          title={`${gameData.entrant1Score % 100} stock`}
                        >
                          <Stack
                            alignItems="end"
                            direction="row"
                            gap="1px"
                            marginRight="8px"
                            height="100%"
                          >
                            {[
                              ...Array(gameData.entrant1Score % 100).keys(),
                            ].map(() => (
                              <Avatar
                                src={getCharacterIconInner(
                                  startggCharacterIds.get(
                                    gameData.selections[0].characterId,
                                  ),
                                  gameData.entrant1Score >= 100
                                    ? Math.floor(gameData.entrant1Score / 100) -
                                        1
                                    : undefined,
                                )}
                                sx={{ height: 12, width: 12 }}
                                variant="square"
                              />
                            ))}
                          </Stack>
                        </Tooltip>
                      )}
                  </EntrantSection>
                  <EntrantSection borderLeft={1} direction="row">
                    <Stack
                      alignItems="center"
                      direction="row"
                      paddingTop="4px"
                      paddingBottom="4px"
                      paddingRight={
                        set.entrant2Participants.length === 1
                          ? '4px'
                          : undefined
                      }
                      style={{
                        backgroundColor:
                          set.entrant2Id === gameData.winnerId
                            ? bgColor
                            : undefined,
                      }}
                    >
                      <EntrantScore>
                        {set.entrant2Id === gameData.winnerId && 'W'}
                      </EntrantScore>
                      {set.entrant2Participants.length === 1 && (
                        <Avatar
                          alt={characterNames.get(
                            startggCharacterIds.get(
                              gameData.selections[1].characterId,
                            )!,
                          )}
                          src={getCharacterIconInner(
                            startggCharacterIds.get(
                              gameData.selections[1].characterId,
                            ),
                            gameData.entrant2Score >= 100
                              ? Math.floor(gameData.entrant2Score / 100) - 1
                              : undefined,
                          )}
                          sx={{ height: 24, width: 24 }}
                          variant="square"
                        />
                      )}
                    </Stack>
                    {set.entrant2Participants.length === 1 &&
                      set.entrant2Id === gameData.winnerId &&
                      gameData.entrant2Score % 100 && (
                        <Tooltip
                          placement="right"
                          title={`${gameData.entrant2Score % 100} stock`}
                        >
                          <Stack
                            alignItems="end"
                            direction="row"
                            gap="1px"
                            marginLeft="8px"
                            height="100%"
                          >
                            {[
                              ...Array(gameData.entrant2Score % 100).keys(),
                            ].map(() => (
                              <Avatar
                                src={getCharacterIconInner(
                                  startggCharacterIds.get(
                                    gameData.selections[1].characterId,
                                  ),
                                  gameData.entrant2Score >= 100
                                    ? Math.floor(gameData.entrant2Score / 100) -
                                        1
                                    : undefined,
                                )}
                                sx={{ height: 12, width: 12 }}
                                variant="square"
                              />
                            ))}
                          </Stack>
                        </Tooltip>
                      )}
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
              disabled={
                !reportSettings.alsoCopy || deleteOverrideReason.length > 0
              }
              label={
                deleteOverrideReason.length > 0
                  ? `Delete disabled, ${deleteOverrideReason}`
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
          {selectedReplaysWithEnforceErrors.length > 0 && (
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
              (reportSettings.alsoCopy && isCopying) ||
              (reportSettings.alsoCopy && copyDisabled) ||
              enforceState.status === EnforceStatus.PENDING
            }
            endIcon={
              reporting || enforceState.status === EnforceStatus.PENDING ? (
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
                    set.entrant1Id,
                    set.entrant2Id,
                    set.state === State.COMPLETED,
                  );
                } else if (mode === Mode.CHALLONGE) {
                  updatedSet = await reportChallongeSet(
                    set.id as number,
                    challongeMatchItems,
                  );
                }
                if (reportSettings.alsoCopy) {
                  const entrantIdToDisplayNameAndCheckNames = new Map<
                    number,
                    { checkNames: Map<string, boolean>; displayName: string }
                  >();
                  selectedReplaysWithEnforceErrors.forEach((replay) => {
                    enforceState.fileNameToPlayerFailures
                      .get(replay.fileName)!
                      .forEach((playerFailure) => {
                        const failurePlayer = replay.players.find(
                          (player) => player.port === playerFailure.port,
                        )!;
                        const displayName =
                          failurePlayer.playerOverrides.displayName ||
                          failurePlayer.displayName;
                        const { entrantId } = failurePlayer.playerOverrides;
                        if (entrantId) {
                          if (
                            entrantIdToDisplayNameAndCheckNames.has(entrantId)
                          ) {
                            const { checkNames } =
                              entrantIdToDisplayNameAndCheckNames.get(
                                entrantId,
                              )!;
                            playerFailure.checkNames.forEach((checkName) => {
                              checkNames.set(checkName, true);
                            });
                          } else {
                            entrantIdToDisplayNameAndCheckNames.set(entrantId, {
                              checkNames: new Map(
                                playerFailure.checkNames.map((checkName) => [
                                  checkName,
                                  true,
                                ]),
                              ),
                              displayName,
                            });
                          }
                        }
                      });
                  });
                  await copyReplays(
                    updatedSet,
                    Array.from(entrantIdToDisplayNameAndCheckNames).map(
                      ([entrantId, { checkNames, displayName }]) => ({
                        checkNames,
                        displayName,
                        entrantId,
                      }),
                    ),
                  );
                }
                if (
                  reportSettings.alsoCopy &&
                  reportSettings.alsoDelete &&
                  deleteOverrideReason.length === 0
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
            {reportCopyDeleteButton}
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
        <DialogTitle>{reportCopyDeleteIntent} error!</DialogTitle>
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
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="24px"
        >
          <DialogTitle>Controller Ruleset Violation Detected</DialogTitle>
          <Typography variant="caption">
            SLP Enforcer version {enforcerVersion}
          </Typography>
        </Stack>
        <DialogContent sx={{ width: '500px' }}>
          <Stack spacing="8px">
            {selectedReplaysWithEnforceErrors.map((selectedReplay) => (
              <Box key={selectedReplay.fileName}>
                <Box typography="caption">
                  {stageNames.get(selectedReplay.stageId)}
                </Box>
                {enforceState.fileNameToPlayerFailures
                  .get(selectedReplay.fileName)!
                  .map((enforcePlayerFailure) => (
                    <Box key={enforcePlayerFailure.port} typography="body2">
                      {getDisplayNameFromPlayer(
                        selectedReplay.players.find(
                          (player) => player.port === enforcePlayerFailure.port,
                        ),
                      )}
                      : {enforcePlayerFailure.checkNames.join(', ')}
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
