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
  Stack,
  Tooltip,
} from '@mui/material';
import { Refresh, Tv } from '@mui/icons-material';
import { Mode, Set, State, Station, Stream } from '../common/types';
import SetView from './SetView';
import { assertInteger } from '../common/asserts';

function getCombinedStreamName(stream: Stream) {
  let prefix = '';
  if (stream.domain === 'twitch') {
    prefix = 'ttv/';
  } else if (stream.domain === 'youtube') {
    prefix = 'yt/';
  }
  return prefix + stream.path;
}

export default function AssignStream({
  mode,
  selectedSet,
  streams,
  stations,
  refreshStartggTournament,
}: {
  mode: Mode;
  selectedSet: Set;
  streams: Stream[];
  stations: Station[];
  refreshStartggTournament: () => Promise<void>;
}) {
  const [chooseOpen, setChooseOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [error, setError] = useState('');

  const [assigning, setAssigning] = useState(false);
  const assignStream = async (streamId: number) => {
    setAssigning(true);
    try {
      if (mode === Mode.STARTGG) {
        await window.electron.assignStream(selectedSet, streamId);
      } else if (mode === Mode.OFFLINE_MODE) {
        await window.electron.assignOfflineModeSetStream(
          assertInteger(selectedSet.id),
          streamId,
        );
      }
      setChooseOpen(false);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    } finally {
      setAssigning(false);
    }
  };
  const assignStation = async (stationId: number) => {
    setAssigning(true);
    try {
      if (mode === Mode.STARTGG) {
        await window.electron.assignStation(selectedSet, stationId);
      } else if (mode === Mode.OFFLINE_MODE) {
        await window.electron.assignOfflineModeSetStation(
          assertInteger(selectedSet.id),
          stationId,
        );
      }
      setChooseOpen(false);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    } finally {
      setAssigning(false);
    }
  };

  const [refreshingStartggTournament, setRefreshingStartggTournament] =
    useState(false);

  return (
    <>
      <Tooltip arrow title="Assign set to stream or station">
        <div>
          <IconButton
            color="primary"
            disabled={
              !(
                typeof selectedSet.id === 'string' ||
                (Number.isInteger(selectedSet.id) && selectedSet.id > 0)
              ) ||
              (mode !== Mode.STARTGG && mode !== Mode.OFFLINE_MODE)
            }
            size="small"
            onClick={async () => {
              setChooseOpen(true);
            }}
          >
            <Tv />
          </IconButton>
        </div>
      </Tooltip>
      <Dialog open={chooseOpen} onClose={() => setChooseOpen(false)}>
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="24px"
        >
          <DialogTitle>Assign Set to Stream or Station</DialogTitle>
          {mode === Mode.STARTGG && (
            <Tooltip title="Refresh">
              <IconButton
                disabled={refreshingStartggTournament}
                onClick={async () => {
                  try {
                    setRefreshingStartggTournament(true);
                    await refreshStartggTournament();
                  } finally {
                    setRefreshingStartggTournament(false);
                  }
                }}
              >
                {refreshingStartggTournament ? (
                  <CircularProgress size="24px" />
                ) : (
                  <Refresh />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <DialogContent style={{ maxWidth: '500px' }}>
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
          {streams.length > 0 && (
            <>
              {selectedSet.stream && (
                <ListItemButton
                  disabled={assigning}
                  disableGutters
                  style={{ marginTop: '8px' }}
                  onClick={() => assignStream(0)}
                >
                  <ListItemText>
                    Remove from {getCombinedStreamName(selectedSet.stream)}
                  </ListItemText>
                </ListItemButton>
              )}
              <List disablePadding>
                {streams
                  .filter((stream) => stream.id !== selectedSet.stream?.id)
                  .map((stream) => (
                    <ListItemButton
                      disabled={assigning}
                      key={stream.id}
                      disableGutters
                      onClick={() => assignStream(stream.id)}
                    >
                      <ListItemText>
                        {getCombinedStreamName(stream)}
                      </ListItemText>
                    </ListItemButton>
                  ))}
              </List>
            </>
          )}
          {stations.length > 0 && (
            <>
              {selectedSet.station && (
                <ListItemText style={{ padding: '12px 0', margin: '8px 0 0' }}>
                  Assigned to station {selectedSet.station.number}
                </ListItemText>
              )}
              <List
                disablePadding
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                }}
              >
                {stations
                  .filter((station) => station.id !== selectedSet.station?.id)
                  .map((station) => (
                    <ListItemButton
                      disabled={assigning}
                      key={station.id}
                      style={{ flexGrow: 0 }}
                      onClick={() => assignStation(station.id)}
                    >
                      <ListItemText>{station.number}</ListItemText>
                    </ListItemButton>
                  ))}
              </List>
            </>
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
