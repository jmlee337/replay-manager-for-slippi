import {
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
  selectSet,
}: {
  entrants: Entrant[];
  selectSet: (set: Set) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
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
          {entrants.map((entrant) => (
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
                      round: Number.MAX_SAFE_INTEGER,
                      fullRoundText: 'Tie-Breaker',
                      entrant1Id: selectedEntrant.id,
                      entrant1Participants: selectedEntrant.participants,
                      entrant2Id: entrant.id,
                      entrant2Participants: entrant.participants,
                      wasReported: false,
                      entrant1Score: null,
                      entrant2Score: null,
                      gameScores: [],
                      ordinal: null,
                      stream: null,
                      station: null,
                      winnerId: null,
                      updatedAtMs: 0,
                      completedAtMs: 0,
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
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
