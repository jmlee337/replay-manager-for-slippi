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
import {
  ChallongeMatchItem,
  Mode,
  Set,
  StartggSet,
  State,
} from '../common/types';

const EntrantNames = styled(Stack)`
  flex-grow: 1;
  min-width: 0;
`;
const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default function ManualReport({
  mode,
  reportChallongeSet,
  reportStartggSet,
  selectedSet,
}: {
  mode: Mode;
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

  const resetForm = () => {
    setEntrant1Dq(false);
    setEntrant2Dq(false);
    setEntrant1Win(false);
    setEntrant2Win(false);
    setEntrant1Score(0);
    setEntrant2Score(0);
  };

  const [reportError, setReportError] = useState('');
  const [reportErrorOpen, setReportErrorOpen] = useState(false);

  let winnerId = 0;
  if (mode === Mode.STARTGG) {
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
  const startggSet: StartggSet = {
    setId: selectedSet.id,
    winnerId,
    isDQ: entrant1Dq || entrant2Dq,
    gameData: [],
  };
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

  return (
    <>
      <Tooltip title="Report Manually">
        <div>
          <IconButton
            color="primary"
            disabled={
              (Number.isInteger(selectedSet.id) &&
                (selectedSet.id as number) <= 0) ||
              selectedSet.state === State.COMPLETED
            }
            size="small"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <SaveAs />
          </IconButton>
        </div>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Report set manually</DialogTitle>
        <DialogContent
          sx={{ width: mode === Mode.STARTGG ? '300px' : '500px' }}
        >
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
                <Tooltip title="Started">
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
                {mode === Mode.STARTGG && (
                  <>
                    <Button
                      color="secondary"
                      variant={entrant1Dq ? 'contained' : 'outlined'}
                      onClick={() => {
                        resetForm();
                        setEntrant1Dq(true);
                      }}
                    >
                      DQ
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant1Win ? 'contained' : 'outlined'}
                      onClick={() => {
                        resetForm();
                        setEntrant1Win(true);
                      }}
                    >
                      W
                    </Button>
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
                {mode === Mode.STARTGG && (
                  <>
                    <Button
                      color="secondary"
                      variant={entrant2Dq ? 'contained' : 'outlined'}
                      onClick={() => {
                        resetForm();
                        setEntrant2Dq(true);
                      }}
                    >
                      DQ
                    </Button>
                    <Button
                      color="secondary"
                      variant={entrant2Win ? 'contained' : 'outlined'}
                      onClick={() => {
                        resetForm();
                        setEntrant2Win(true);
                      }}
                    >
                      W
                    </Button>
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
                  await reportStartggSet(
                    startggSet,
                    selectedSet.entrant1Id,
                    selectedSet.entrant2Id,
                    selectedSet.state === State.COMPLETED,
                  );
                } else if (mode === Mode.CHALLONGE) {
                  await reportChallongeSet(
                    selectedSet.id as number,
                    challongeMatchItems,
                  );
                }
                resetForm();
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
