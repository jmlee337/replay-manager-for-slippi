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
import { Mode, Set, State, Station, Stream } from '../common/types';
import SetView from './SetView';

export default function AssignStream({
  mode,
  selectedSet,
}: {
  mode: Mode;
  selectedSet: Set;
}) {
  const [chooseOpen, setChooseOpen] = useState(false);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [gettingStreamsAndStations, setGettingStreamsAndStations] =
    useState(false);

  const [errorOpen, setErrorOpen] = useState(false);
  const [error, setError] = useState('');

  const [assigning, setAssigning] = useState(false);
  const assignStream = async (streamId: number) => {
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
  const assignStation = async (stationId: number) => {
    setAssigning(true);
    try {
      if (mode === Mode.STARTGG) {
        await window.electron.assignStation(selectedSet.id, stationId);
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
      <Tooltip title="Assign set to stream or station">
        <div>
          <IconButton
            color="primary"
            disabled={
              !(
                typeof selectedSet.id === 'string' ||
                (Number.isInteger(selectedSet.id) && selectedSet.id > 0)
              ) || mode !== Mode.STARTGG
            }
            size="small"
            onClick={async () => {
              setChooseOpen(true);
              setGettingStreamsAndStations(true);
              const streamsAndStations =
                await window.electron.getStreamsAndStations();
              setStreams(streamsAndStations.streams);
              setStations(streamsAndStations.stations);
              setGettingStreamsAndStations(false);
            }}
          >
            <Tv />
          </IconButton>
        </div>
      </Tooltip>
      <Dialog open={chooseOpen} onClose={() => setChooseOpen(false)}>
        <DialogTitle>Assign Set to Stream or Station</DialogTitle>
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
          />
          {gettingStreamsAndStations ? (
            <CircularProgress size="24px" />
          ) : (
            <>
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
                        Remove from {selectedSet.stream.path}
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
                          <ListItemText>{stream.path}</ListItemText>
                        </ListItemButton>
                      ))}
                  </List>
                </>
              )}
              {stations.length > 0 && (
                <>
                  {selectedSet.station && (
                    <ListItemText
                      style={{ padding: '12px 0', margin: '8px 0 0' }}
                    >
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
                      .filter(
                        (station) => station.id !== selectedSet.station?.id,
                      )
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
