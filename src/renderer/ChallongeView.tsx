import {
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowRight,
  KeyboardArrowUp,
  Refresh,
} from '@mui/icons-material';
import { useState } from 'react';
import { ChallongeTournament, Set } from '../common/types';
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
  getChallongeTournament,
  selectSet,
}: {
  tournament: ChallongeTournament;
  getChallongeTournament: () => Promise<void>;
  selectSet: (set: Set) => void;
}) {
  const [open, setOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [getting, setGetting] = useState(false);
  const get = async () => {
    setGetting(true);
    await getChallongeTournament();
    setGetting(false);
  };
  return (
    <Box>
      <ListItemButton
        dense
        disableGutters
        onClick={() => {
          setOpen(!open);
        }}
        sx={{ typography: 'caption' }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <div
          style={{
            overflowX: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tournament.name}
        </div>
        <Tooltip arrow title="Refresh tournament">
          <IconButton
            onClick={(ev) => {
              ev.stopPropagation();
              get();
            }}
            size="small"
          >
            {getting ? <CircularProgress size="24px" /> : <Refresh />}
          </IconButton>
        </Tooltip>
      </ListItemButton>
      <Collapse in={open}>
        <div style={{ paddingLeft: '8px' }}>
          {tournament.sets.pendingSets.map((set) => (
            <SetView key={set.id} set={set} selectSet={selectSet} />
          ))}
          {tournament.sets.completedSets.length > 0 && (
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
                {tournament.sets.completedSets.map((set) => (
                  <SetView key={set.id} set={set} selectSet={selectSet} />
                ))}
              </Collapse>
            </>
          )}
        </div>
      </Collapse>
    </Box>
  );
}
