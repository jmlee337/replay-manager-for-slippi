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
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { Tv } from '@mui/icons-material';
import { Mode, Set, Stream } from '../common/types';

export default function AssignStream({
  mode,
  selectedSet,
}: {
  mode: Mode;
  selectedSet: Set;
}) {
  const [chooseOpen, setChooseOpen] = useState(false);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [gettingStreams, setGettingStreams] = useState(false);

  const [errorOpen, setErrorOpen] = useState(false);
  const [error, setError] = useState('');

  const [assigning, setAssigning] = useState(false);
  const assign = async (streamId: number) => {
    setAssigning(true);
    try {
      if (mode === Mode.STARTGG) {
        await window.electron.assignStream(selectedSet.id, streamId);
      }
      setChooseOpen(false);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <Tooltip title="Assign set to stream">
        <div>
          <IconButton
            color="primary"
            disabled={
              !(
                typeof selectedSet.id === 'string' ||
                (Number.isInteger(selectedSet.id) && selectedSet.id > 0)
              ) || assigning
            }
            size="small"
            onClick={async () => {
              setChooseOpen(true);
              setGettingStreams(true);
              setStreams(await window.electron.getStreams());
              setGettingStreams(false);
            }}
          >
            {assigning ? <CircularProgress size="24px" /> : <Tv />}
          </IconButton>
        </div>
      </Tooltip>
      <Dialog open={chooseOpen} onClose={() => setChooseOpen(false)}>
        <DialogTitle>Assign Set to Stream</DialogTitle>
        <DialogContent>
          {gettingStreams ? (
            <CircularProgress size="24px" />
          ) : (
            <List>
              {selectedSet.stream && (
                <ListItemButton disableGutters onClick={() => assign(0)}>
                  <ListItemText>
                    Remove from {selectedSet.stream.path}
                  </ListItemText>
                </ListItemButton>
              )}
              {streams
                .filter((stream) => stream.id !== selectedSet.stream?.id)
                .map((stream) => (
                  <ListItemButton
                    key={stream.id}
                    disableGutters
                    onClick={() => assign(stream.id)}
                  >
                    <ListItemText>{stream.path}</ListItemText>
                  </ListItemButton>
                ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={errorOpen}
        onClose={() => {
          setErrorOpen(false);
          setError('');
        }}
      >
        <DialogTitle>Assign Set to Stream error!</DialogTitle>
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
