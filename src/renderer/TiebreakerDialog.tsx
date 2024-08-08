import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Entrant, Set, State } from '../common/types';

export default function TiebreakerDialog({
  entrants,
  getEntrants,
  selectSet,
}: {
  entrants: Entrant[];
  getEntrants: () => Promise<void>;
  selectSet: (set: Set) => void;
}) {
  const [open, setOpen] = useState(false);
  const [gettingEntrants, setGettingEntrants] = useState(false);
  const [selectedEntrant, setSelectedEntrant] = useState<Entrant>({
    id: 0,
    participants: [],
  });
  return (
    <>
      <ListItemButton
        dense
        onClick={async () => {
          setOpen(true);
          if (entrants.length === 0) {
            setGettingEntrants(true);
            await getEntrants();
            setGettingEntrants(false);
          }
        }}
      >
        <Typography
          alignItems="center"
          display="flex"
          justifyContent="right"
          variant="subtitle2"
          width="100%"
        >
          tiebreaker...
        </Typography>
      </ListItemButton>
      <Dialog
        open={open}
        onClose={() => {
          setSelectedEntrant({ id: 0, participants: [] });
          setOpen(false);
        }}
      >
        <DialogTitle>Generate Tiebreaker Set...</DialogTitle>
        <DialogContent>
          {gettingEntrants ? (
            <CircularProgress size="24px" />
          ) : (
            entrants.map((entrant) => (
              <ListItemButton
                dense
                key={entrant.id}
                style={{
                  backgroundColor:
                    selectedEntrant.id === entrant.id ? '#5BCEFA' : undefined,
                }}
                onClick={() => {
                  if (selectedEntrant.id) {
                    if (selectedEntrant.id === entrant.id) {
                      setSelectedEntrant({ id: 0, participants: [] });
                    } else {
                      selectSet({
                        id: -1,
                        state: State.PENDING,
                        round: 0,
                        fullRoundText: 'Tie-Breaker',
                        entrant1Id: selectedEntrant.id,
                        entrant1Participants: selectedEntrant.participants,
                        entrant2Id: entrant.id,
                        entrant2Participants: entrant.participants,
                        wasReported: false,
                        entrant1Score: null,
                        entrant2Score: null,
                        ordinal: null,
                        stream: null,
                        winnerId: null,
                      });
                      setSelectedEntrant({ id: 0, participants: [] });
                      setOpen(false);
                    }
                  } else {
                    setSelectedEntrant({
                      id: entrant.id,
                      participants: entrant.participants,
                    });
                  }
                }}
              >
                <ListItemText>
                  <span>{entrant.participants[0].displayName}</span>
                  {entrant.participants.length > 1 && (
                    <span>{entrant.participants[1].displayName}</span>
                  )}
                </ListItemText>
              </ListItemButton>
            ))
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
