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
import { ChallongeTournament, Set, SetWithNames, State } from '../common/types';
import SetViewInner from './SetView';
import filterSets from './filterSets';
import TiebreakerDialog from './TiebreakerDialog';

function SetView({
  setWithNames,
  selectSet,
}: {
  setWithNames: SetWithNames;
  selectSet: (set: Set) => void;
}) {
  return (
    <ListItemButton
      dense
      disableGutters
      onClick={() => {
        selectSet(setWithNames.set);
      }}
    >
      <SetViewInner
        entrant1Names={setWithNames.entrant1Names}
        entrant1Score={setWithNames.set.entrant1Score}
        entrant1Win={setWithNames.set.entrant1Id === setWithNames.set.winnerId}
        entrant2Names={setWithNames.entrant2Names}
        entrant2Score={setWithNames.set.entrant2Score}
        fullRoundText={setWithNames.set.fullRoundText}
        state={setWithNames.set.state}
        showScores={setWithNames.set.state === State.COMPLETED}
        wasReported={false}
      />
    </ListItemButton>
  );
}

export default function ChallongeView({
  searchSubstr,
  tournament,
  getChallongeTournament,
  selectSet,
}: {
  searchSubstr: string;
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
  const pendingSetsToShow = filterSets(
    tournament.sets.pendingSets,
    searchSubstr,
  );
  const completedSetsToShow = filterSets(
    tournament.sets.completedSets,
    searchSubstr,
  );
  return (
    (!searchSubstr ||
      pendingSetsToShow.length > 0 ||
      completedSetsToShow.length > 0) && (
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
            {pendingSetsToShow.map((setWithNames) => (
              <SetView
                key={setWithNames.set.id}
                setWithNames={setWithNames}
                selectSet={selectSet}
              />
            ))}
            {completedSetsToShow.length > 0 && (
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
                    {completedOpen ? (
                      <KeyboardArrowUp />
                    ) : (
                      <KeyboardArrowDown />
                    )}
                  </Typography>
                </ListItemButton>
                <Collapse in={completedOpen}>
                  {completedSetsToShow.map((setWithNames) => (
                    <SetView
                      key={setWithNames.set.id}
                      setWithNames={setWithNames}
                      selectSet={selectSet}
                    />
                  ))}
                </Collapse>
              </>
            )}
            {(tournament.tournamentType === 'swiss' ||
              tournament.tournamentType === 'round robin') &&
              tournament.sets.pendingSets.length === 0 && (
                <TiebreakerDialog
                  entrants={tournament.entrants}
                  getEntrants={() => Promise.resolve()}
                  selectSet={selectSet}
                />
              )}
          </div>
        </Collapse>
      </Box>
    )
  );
}
