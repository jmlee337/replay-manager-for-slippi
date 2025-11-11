import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import { HourglassTop, SaveAs } from '@mui/icons-material';
import styled from '@emotion/styled';
import { MatchResult, SlotState } from '@parry-gg/client';
import {
  ChallongeMatchItem,
  Id,
  Mode,
  Set,
  StartggGame,
  StartggSet,
  State,
} from '../common/types';
import { assertInteger, assertString } from '../common/asserts';

function createStartggGameData(
  entrant1Score: number,
  entrant2Score: number,
  entrant1Id: Id,
  entrant2Id: Id,
): StartggGame[] {
  const gameData: StartggGame[] = [];
  if (entrant1Score > entrant2Score) {
    for (let n = 1; n <= entrant1Score + entrant2Score; n += 1) {
      gameData.push({
        gameNum: n,
        winnerId: assertInteger(n <= entrant1Score ? entrant1Id : entrant2Id),
        entrant1Score: 0,
        entrant2Score: 0,
        selections: [],
      });
    }
  } else if (entrant1Score < entrant2Score) {
    for (let n = 1; n <= entrant1Score + entrant2Score; n += 1) {
      gameData.push({
        gameNum: n,
        winnerId: assertInteger(n <= entrant2Score ? entrant2Id : entrant1Id),
        entrant1Score: 0,
        entrant2Score: 0,
        selections: [],
      });
    }
  }
  return gameData;
}

const EntrantNames = styled(Stack)`
  flex-grow: 1;
  min-width: 0;
`;
const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const ThinButton = styled(Button)`
  min-width: 54px;
`;

export default function ManualReport({
  mode,
  reportChallongeSet,
  reportStartggSet,
  reportParryggSet,
  selectedSet,
}: {
  mode: Mode;
  reportChallongeSet: (
    matchId: string,
    items: ChallongeMatchItem[],
  ) => Promise<Set>;
  reportStartggSet: (
    set: StartggSet,
    originalSet: Set,
  ) => Promise<Set | undefined>;
  reportParryggSet: (
    result: MatchResult.AsObject,
    originalSet: Set,
  ) => Promise<Set | undefined>;
  selectedSet: Set;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  // startgg
  const [entrant1Dq, setEntrant1Dq] = useState(false);
  const [entrant2Dq, setEntrant2Dq] = useState(false);
  const [entrant1Win, setEntrant1Win] = useState(false);
  const [entrant2Win, setEntrant2Win] = useState(false);

  // challonge
  const [entrant1Score, setEntrant1Score] = useState(0);
  const [entrant2Score, setEntrant2Score] = useState(0);

  const resetFormToZero = () => {
    setEntrant1Dq(false);
    setEntrant2Dq(false);
    setEntrant1Win(false);
    setEntrant2Win(false);
    setEntrant1Score(0);
    setEntrant2Score(0);
  };

  const resetFormToSelectedSet = () => {
    setEntrant1Dq(
      selectedSet.state === State.COMPLETED && selectedSet.entrant1Score === -1,
    );
    setEntrant2Dq(
      selectedSet.state === State.COMPLETED && selectedSet.entrant2Score === -1,
    );
    setEntrant1Win(
      selectedSet.state === State.COMPLETED &&
        selectedSet.winnerId === selectedSet.entrant1Id,
    );
    setEntrant2Win(
      selectedSet.state === State.COMPLETED &&
        selectedSet.winnerId === selectedSet.entrant2Id,
    );
    setEntrant1Score(
      selectedSet.entrant1Score === null
        ? 0
        : Math.max(selectedSet.entrant1Score, 0),
    );
    setEntrant2Score(
      selectedSet.entrant2Score === null
        ? 0
        : Math.max(selectedSet.entrant2Score, 0),
    );
  };

  const [reportError, setReportError] = useState('');
  const [reportErrorOpen, setReportErrorOpen] = useState(false);

  let winnerId: Id = 0;
  if (mode === Mode.STARTGG || mode === Mode.PARRYGG) {
    if (entrant1Win || entrant2Dq) {
      winnerId = selectedSet.entrant1Id;
    } else if (entrant2Win || entrant1Dq) {
      winnerId = selectedSet.entrant2Id;
    }
  } else if (mode === Mode.CHALLONGE) {
    if (entrant1Score > entrant2Score) {
      winnerId = selectedSet.entrant1Id;
    } else if (entrant1Score < entrant2Score) {
      winnerId = selectedSet.entrant2Id;
    }
  }
  const gameData =
    mode === Mode.STARTGG
      ? createStartggGameData(
          entrant1Score,
          entrant2Score,
          selectedSet.entrant1Id,
          selectedSet.entrant2Id,
        )
      : [];
  const getStartggSet = () => ({
    setId: selectedSet.id,
    winnerId: assertInteger(winnerId),
    isDQ: entrant1Dq || entrant2Dq,
    gameData,
  });
  const challongeMatchItems: ChallongeMatchItem[] = [
    {
      participant_id: selectedSet.entrant1Id.toString(10),
      score_set: entrant1Score.toString(10),
      rank: winnerId === selectedSet.entrant1Id ? 1 : 2,
      advancing: winnerId === selectedSet.entrant1Id,
    },
    {
      participant_id: selectedSet.entrant2Id.toString(10),
      score_set: entrant2Score.toString(10),
      rank: winnerId === selectedSet.entrant2Id ? 1 : 2,
      advancing: winnerId === selectedSet.entrant2Id,
    },
  ];

  const parryggSetResult: MatchResult.AsObject = {
    slotsList: [
      {
        slot: 0,
        score: entrant1Dq ? 0 : entrant1Score,
        state: entrant1Dq
          ? SlotState.SLOT_STATE_DQ
          : SlotState.SLOT_STATE_NUMERIC,
      },
      {
        slot: 1,
        score: entrant2Dq ? 0 : entrant2Score,
        state: entrant2Dq
          ? SlotState.SLOT_STATE_DQ
          : SlotState.SLOT_STATE_NUMERIC,
      },
    ],
  };

  return (
    <>
      <Tooltip arrow title="Report Manually">
        <div>
          <IconButton
            color="primary"
            disabled={
              !(
                typeof selectedSet.id === 'string' ||
                (Number.isInteger(selectedSet.id) && selectedSet.id > 0)
              )
            }
            size="small"
            onClick={() => {
              resetFormToSelectedSet();
              setOpen(true);
            }}
          >
            <SaveAs />
          </IconButton>
        </div>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Report set manually</DialogTitle>
        <DialogContent sx={{ width: '500px' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            typography="caption"
          >
            {selectedSet.fullRoundText}
            {selectedSet.state === State.STARTED && (
              <>
                &nbsp;
                <Tooltip arrow placement="top" title="Started">
                  <HourglassTop fontSize="small" />
                </Tooltip>
              </>
            )}
          </Stack>
          <Stack
            alignItems="end"
            marginTop="4px"
            spacing="8px"
            sx={{ typography: 'body2' }}
          >
            <Stack
              alignItems="center"
              direction="row"
              justifyContent="space-between"
              width="100%"
            >
              <EntrantNames>
                <Name>{selectedSet.entrant1Participants[0].displayName}</Name>
                {selectedSet.entrant1Participants.length > 1 && (
                  <Name>{selectedSet.entrant1Participants[1].displayName}</Name>
                )}
              </EntrantNames>
              <Stack direction="row" spacing="8px">
                {(mode === Mode.STARTGG || mode === Mode.PARRYGG) && (
                  <>
                    <ThinButton
                      color="secondary"
                      variant={entrant1Dq ? 'contained' : 'outlined'}
                      onClick={() => {
                        resetFormToZero();
                        setEntrant1Dq(true);
                        setEntrant2Win(true);
                      }}
                    >
                      DQ
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant1Score === 0 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Score(0);
                        if (entrant2Score > 0) {
                          setEntrant1Win(false);
                          setEntrant2Win(true);
                        } else if (entrant2Score === 0) {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      0
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant1Score === 1 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Dq(false);
                        setEntrant2Dq(false);
                        setEntrant1Score(1);
                        if (entrant2Score < 1) {
                          setEntrant1Win(true);
                          setEntrant2Win(false);
                        } else if (entrant2Score > 1) {
                          setEntrant1Win(false);
                          setEntrant2Win(true);
                        } else {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      1
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant1Score === 2 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Dq(false);
                        setEntrant2Dq(false);
                        setEntrant1Score(2);
                        if (entrant2Score < 2) {
                          setEntrant1Win(true);
                          setEntrant2Win(false);
                        } else if (entrant2Score > 2) {
                          setEntrant1Win(false);
                          setEntrant2Win(true);
                        } else {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      2
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant1Score === 3 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Dq(false);
                        setEntrant2Dq(false);
                        setEntrant1Score(3);
                        if (entrant2Score < 3) {
                          setEntrant1Win(true);
                          setEntrant2Win(false);
                        } else if (entrant2Score === 3) {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      3
                    </ThinButton>
                    {mode === Mode.STARTGG && (
                      <ThinButton
                        color="secondary"
                        variant={entrant1Win ? 'contained' : 'outlined'}
                        onClick={() => {
                          resetFormToZero();
                          setEntrant1Win(true);
                          setEntrant2Dq(false);
                        }}
                      >
                        W
                      </ThinButton>
                    )}
                  </>
                )}
                {mode === Mode.CHALLONGE && (
                  <>
                    <Button
                      color="secondary"
                      variant={entrant1Score === -1 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Score(-1);
                      }}
                    >
                      -1
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant1Score === 0 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Score(0);
                      }}
                    >
                      0
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant1Score === 1 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Score(1);
                      }}
                    >
                      1
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant1Score === 2 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Score(2);
                      }}
                    >
                      2
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant1Score === 3 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Score(3);
                      }}
                    >
                      3
                    </Button>
                  </>
                )}
              </Stack>
            </Stack>
            <Stack
              alignItems="center"
              direction="row"
              justifyContent="space-between"
              width="100%"
            >
              <EntrantNames>
                <Name>{selectedSet.entrant2Participants[0].displayName}</Name>
                {selectedSet.entrant2Participants.length > 1 && (
                  <Name>{selectedSet.entrant2Participants[1].displayName}</Name>
                )}
              </EntrantNames>
              <Stack direction="row" spacing="8px">
                {(mode === Mode.STARTGG || mode === Mode.PARRYGG) && (
                  <>
                    <ThinButton
                      color="secondary"
                      variant={entrant2Dq ? 'contained' : 'outlined'}
                      onClick={() => {
                        resetFormToZero();
                        setEntrant2Dq(true);
                        setEntrant1Win(true);
                      }}
                    >
                      DQ
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant2Score === 0 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant2Score(0);
                        if (entrant1Score > 0) {
                          setEntrant1Win(true);
                          setEntrant2Win(false);
                        } else if (entrant1Score === 0) {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      0
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant2Score === 1 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Dq(false);
                        setEntrant2Dq(false);
                        setEntrant2Score(1);
                        if (entrant1Score < 1) {
                          setEntrant1Win(false);
                          setEntrant2Win(true);
                        } else if (entrant1Score > 1) {
                          setEntrant1Win(true);
                          setEntrant2Win(false);
                        } else {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      1
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant2Score === 2 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Dq(false);
                        setEntrant2Dq(false);
                        setEntrant2Score(2);
                        if (entrant1Score < 2) {
                          setEntrant1Win(false);
                          setEntrant2Win(true);
                        } else if (entrant1Score > 2) {
                          setEntrant1Win(true);
                          setEntrant2Win(false);
                        } else {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      2
                    </ThinButton>
                    <ThinButton
                      color="secondary"
                      variant={entrant2Score === 3 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant1Dq(false);
                        setEntrant2Dq(false);
                        setEntrant2Score(3);
                        if (entrant1Score < 3) {
                          setEntrant1Win(false);
                          setEntrant2Win(true);
                        } else if (entrant1Score === 3) {
                          setEntrant1Win(false);
                          setEntrant2Win(false);
                        }
                      }}
                    >
                      3
                    </ThinButton>
                    {mode === Mode.STARTGG && (
                      <ThinButton
                        color="secondary"
                        variant={entrant2Win ? 'contained' : 'outlined'}
                        onClick={() => {
                          resetFormToZero();
                          setEntrant1Dq(false);
                          setEntrant2Win(true);
                        }}
                      >
                        W
                      </ThinButton>
                    )}
                  </>
                )}
                {mode === Mode.CHALLONGE && (
                  <>
                    <Button
                      color="secondary"
                      variant={entrant2Score === -1 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant2Score(-1);
                      }}
                    >
                      -1
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant2Score === 0 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant2Score(0);
                      }}
                    >
                      0
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant2Score === 1 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant2Score(1);
                      }}
                    >
                      1
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant2Score === 2 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant2Score(2);
                      }}
                    >
                      2
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant2Score === 3 ? 'contained' : 'outlined'}
                      onClick={() => {
                        setEntrant2Score(3);
                      }}
                    >
                      3
                    </Button>
                  </>
                )}
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={reporting || !winnerId}
            endIcon={reporting ? <CircularProgress size="24px" /> : <SaveAs />}
            onClick={async () => {
              setReporting(true);
              try {
                if (mode === Mode.STARTGG) {
                  await reportStartggSet(getStartggSet(), selectedSet);
                } else if (mode === Mode.CHALLONGE) {
                  await reportChallongeSet(
                    assertString(selectedSet.id),
                    challongeMatchItems,
                  );
                } else if (mode === Mode.PARRYGG) {
                  await reportParryggSet(parryggSetResult, selectedSet);
                }
                resetFormToZero();
                setOpen(false);
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
            Report Manually
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
        <DialogTitle>Report error!</DialogTitle>
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
    </>
  );
}
