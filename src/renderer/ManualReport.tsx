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
import { Backup, HourglassTop, SaveAs } from '@mui/icons-material';
import styled from '@emotion/styled';
import { Set, StartggSet } from '../common/types';

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
  reportSet,
  selectedSet,
}: {
  reportSet: (set: StartggSet, update: boolean) => Promise<Set | undefined>;
  selectedSet: Set;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [entrant1Dq, setEntrant1Dq] = useState(false);
  const [entrant2Dq, setEntrant2Dq] = useState(false);
  const [entrant1Win, setEntrant1Win] = useState(false);
  const [entrant2Win, setEntrant2Win] = useState(false);
  const resetForm = () => {
    setEntrant1Dq(false);
    setEntrant2Dq(false);
    setEntrant1Win(false);
    setEntrant2Win(false);
  };

  const [reportError, setReportError] = useState('');
  const [reportErrorOpen, setReportErrorOpen] = useState(false);

  let winnerId = 0;
  if (entrant1Win || entrant2Dq) {
    winnerId = selectedSet.entrant1Id;
  } else if (entrant2Win || entrant1Dq) {
    winnerId = selectedSet.entrant2Id;
  }
  const startggSet: StartggSet = {
    setId: selectedSet.id,
    winnerId,
    isDQ: entrant1Dq || entrant2Dq,
    gameData: [],
  };

  return (
    <>
      <Tooltip title="Report Manually">
        <div>
          <IconButton
            color="primary"
            disabled={!selectedSet.id || selectedSet.state === 3}
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
        <DialogContent sx={{ width: '300px' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            typography="caption"
          >
            {selectedSet.fullRoundText}
            {selectedSet.state === 2 && (
              <>
                &nbsp;
                <Tooltip title="Started">
                  <HourglassTop fontSize="small" />
                </Tooltip>
              </>
            )}
            {selectedSet.state === 3 && (
              <>
                &nbsp;
                <Tooltip title="Finished">
                  <Backup fontSize="small" />
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
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={reporting}
            endIcon={reporting ? <CircularProgress size="24px" /> : <SaveAs />}
            onClick={async () => {
              setReporting(true);
              try {
                await reportSet(startggSet, selectedSet.state === 3);
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
