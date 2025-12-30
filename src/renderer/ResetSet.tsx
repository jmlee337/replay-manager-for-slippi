import { RestartAlt } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useState } from 'react';
import { Mode, Set, State } from '../common/types';
import SetView from './SetView';
import { assertInteger } from '../common/asserts';

export default function ResetSet({
  mode,
  selectedSet,
}: {
  mode: Mode;
  selectedSet: Set;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);

  return (
    <>
      <Tooltip arrow title="Reset set">
        <div>
          <IconButton
            color="primary"
            disabled={
              !Number.isInteger(selectedSet.id) ||
              (selectedSet.id as number) <= 0 ||
              selectedSet.state === State.PENDING ||
              resetting ||
              (mode !== Mode.STARTGG && mode !== Mode.OFFLINE_MODE)
            }
            size="small"
            onClick={() => setConfirmOpen(true)}
          >
            {resetting ? <CircularProgress size="24px" /> : <RestartAlt />}
          </IconButton>
        </div>
      </Tooltip>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Reset Set?</DialogTitle>
        <DialogContent style={{ width: '300px' }}>
          <SetView
            entrant1Names={selectedSet.entrant1Participants.map(
              (participant) => ({ name: participant.displayName }),
            )}
            entrant1Score={selectedSet.entrant1Score}
            entrant1Win={selectedSet.winnerId === selectedSet.entrant1Id}
            entrant2Names={selectedSet.entrant2Participants.map(
              (participant) => ({ name: participant.displayName }),
            )}
            entrant2Score={selectedSet.entrant2Score}
            fullRoundText={selectedSet.fullRoundText}
            showScores={selectedSet.state === State.COMPLETED}
            state={selectedSet.state}
            stream={selectedSet.stream}
            station={selectedSet.station}
            wasReported={false}
            updatedAtMs={selectedSet.updatedAtMs}
          />
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            disabled={
              !Number.isInteger(selectedSet.id) ||
              (selectedSet.id as number) <= 0 ||
              selectedSet.state === State.PENDING ||
              resetting
            }
            endIcon={
              resetting ? <CircularProgress size="24px" /> : <RestartAlt />
            }
            onClick={async () => {
              setResetting(true);
              try {
                if (mode === Mode.STARTGG) {
                  await window.electron.resetSet(assertInteger(selectedSet.id));
                } else if (mode === Mode.OFFLINE_MODE) {
                  await window.electron.resetOfflineModeSet(
                    assertInteger(selectedSet.id),
                  );
                }
                setConfirmOpen(false);
              } catch (e: any) {
                setError(e.toString());
                setErrorOpen(true);
              } finally {
                setResetting(false);
              }
            }}
            variant="contained"
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={errorOpen}
        onClose={() => {
          setErrorOpen(false);
          setError('');
        }}
      >
        <DialogTitle>Reset error!</DialogTitle>
        <DialogContent>
          <DialogContentText>{error}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setErrorOpen(false);
              setError('');
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
