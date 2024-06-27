import { Box, Collapse, ListItemButton, Typography } from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { useState } from 'react';
import { Set, Sets } from '../common/types';
import SetViewInner from './SetView';

function SetView({
  set,
  selectSet,
}: {
  set: Set;
  selectSet: (set: Set) => void;
}) {
  return (
    <ListItemButton
      dense
      disableGutters
      onClick={() => {
        selectSet(set);
      }}
    >
      <SetViewInner
        entrant1Names={set.entrant1Participants.map(
          (participant) => participant.displayName,
        )}
        entrant1Score={set.entrant1Score}
        entrant1Win={set.entrant1Id === set.winnerId}
        entrant2Names={set.entrant2Participants.map(
          (participant) => participant.displayName,
        )}
        entrant2Score={set.entrant2Score}
        fullRoundText={set.fullRoundText}
        state={set.state}
        showScores={set.state === 3}
      />
    </ListItemButton>
  );
}

export default function ChallongeView({
  tournament,
  selectSet,
}: {
  tournament: Sets;
  selectSet: (set: Set) => void;
}) {
  const [completedOpen, setCompletedOpen] = useState(false);
  return (
    <Box>
      {tournament.pendingSets.map((set) => (
        <SetView key={set.id} set={set} selectSet={selectSet} />
      ))}
      {tournament.completedSets.length > 0 && (
        <>
          <ListItemButton
            dense
            onClick={() => setCompletedOpen(!completedOpen)}
          >
            <Typography
              alignItems="center"
              display="flex"
              justifyContent="right"
              variant="subtitle2"
              width="100%"
            >
              completed
              {completedOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </Typography>
          </ListItemButton>
          <Collapse in={completedOpen}>
            {tournament.completedSets.map((set) => (
              <SetView key={set.id} set={set} selectSet={selectSet} />
            ))}
          </Collapse>
        </>
      )}
    </Box>
  );
}
