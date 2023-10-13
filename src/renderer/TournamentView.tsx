import styled from '@emotion/styled';
import {
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowRight,
  KeyboardArrowUp,
  Refresh,
} from '@mui/icons-material';
import { useState } from 'react';
import { Event, Phase, PhaseGroup, Set, Tournament } from '../common/types';

const Block = styled.div`
  padding-left: 8px;
`;

const EntrantNames = styled(Stack)`
  width: 40%;
`;

const EntrantScore = styled(Box)`
  box-sizing: border-box;
  overflow-x: hidden;
  padding: 0 4px;
  text-overflow: ellipsis;
  width: 10%;
`;

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SetInnerRow = styled(Stack)`
  align-items: center;
  flex-direction: row;
  justify-content: center;
`;

function SetView({
  set,
  eventId,
  phaseId,
  phaseGroupId,
  selectSet,
}: {
  set: Set;
  eventId: number;
  phaseId: number;
  phaseGroupId: number;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
  ) => void;
}) {
  let leftScore = '\u00A0';
  let rightScore = '\u00A0';
  if (set.state === 3) {
    if (set.entrant1Score || set.entrant1Score) {
      leftScore = set.entrant1Score || '0';
      rightScore = set.entrant2Score || '0';
    } else if (set.winnerId === set.entrant1Id) {
      leftScore = 'W';
      rightScore = 'L';
    } else {
      leftScore = 'L';
      rightScore = 'W';
    }
  }
  return (
    <ListItemButton
      dense
      disableGutters
      onClick={() => selectSet(set, phaseGroupId, phaseId, eventId)}
    >
      <Stack width="100%">
        <SetInnerRow sx={{ typography: 'caption' }}>
          {set.fullRoundText}
        </SetInnerRow>
        <SetInnerRow sx={{ typography: 'body2' }}>
          <EntrantNames textAlign="right">
            <Name>{set.entrant1Names[0]}</Name>
            {set.entrant1Names.length > 1 && (
              <Name>{set.entrant1Names[1]}</Name>
            )}
          </EntrantNames>
          <EntrantScore borderRight={1} textAlign="right">
            {leftScore}
          </EntrantScore>
          <EntrantScore borderLeft={1}>{rightScore}</EntrantScore>
          <EntrantNames>
            <Name>{set.entrant2Names[0]}</Name>
            {set.entrant2Names.length > 1 && (
              <Name>{set.entrant2Names[1]}</Name>
            )}
          </EntrantNames>
        </SetInnerRow>
      </Stack>
    </ListItemButton>
  );
}

function PhaseGroupView({
  phaseGroup,
  eventId,
  phaseId,
  getPhaseGroup,
  selectSet,
}: {
  phaseGroup: PhaseGroup;
  eventId: number;
  phaseId: number;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
  ) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const get = async () => {
    setGetting(true);
    await getPhaseGroup(phaseGroup.id, phaseId, eventId);
    setGetting(false);
  };

  return (
    <>
      <ListItemButton
        dense
        disableGutters
        onClick={() => {
          if (
            !open &&
            phaseGroup.sets.pendingSets.length === 0 &&
            phaseGroup.sets.completedSets.length === 0
          ) {
            get();
          }
          setOpen(!open);
        }}
        sx={{ typography: 'caption' }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <Name>{phaseGroup.name}</Name>
        {'\u00A0'}({phaseGroup.id})
        <IconButton
          aria-label="restore phase"
          disabled={getting}
          onClick={(event) => {
            event.stopPropagation();
            get();
          }}
          size="small"
        >
          {getting ? <CircularProgress size="24px" /> : <Refresh />}
        </IconButton>
      </ListItemButton>
      <Collapse in={open}>
        <Block>
          {phaseGroup.sets.pendingSets.map((set) => (
            <SetView
              key={set.id}
              set={set}
              eventId={eventId}
              phaseId={phaseId}
              phaseGroupId={phaseGroup.id}
              selectSet={selectSet}
            />
          ))}
          {phaseGroup.sets.completedSets.length > 0 && (
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
                {phaseGroup.sets.completedSets.map((set) => (
                  <SetView
                    key={set.id}
                    set={set}
                    eventId={eventId}
                    phaseId={phaseId}
                    phaseGroupId={phaseGroup.id}
                    selectSet={selectSet}
                  />
                ))}
              </Collapse>
            </>
          )}
        </Block>
      </Collapse>
    </>
  );
}

function PhaseView({
  phase,
  eventId,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  phase: Phase;
  eventId: number;
  getPhase: (id: number, eventId: number) => Promise<void>;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
  ) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [open, setOpen] = useState(false);

  const get = async () => {
    setGetting(true);
    await getPhase(phase.id, eventId);
    setGetting(false);
  };
  return (
    <>
      <ListItemButton
        dense
        disableGutters
        onClick={() => {
          if (!open && phase.phaseGroups.length === 0) {
            get();
          }
          setOpen(!open);
        }}
        sx={{ typography: 'caption' }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <Name>{phase.name}</Name>
        {'\u00A0'}({phase.id})
        <IconButton
          aria-label="restore phase"
          onClick={(event) => {
            event.stopPropagation();
            get();
          }}
          size="small"
        >
          {getting ? <CircularProgress size="24px" /> : <Refresh />}
        </IconButton>
      </ListItemButton>
      <Collapse in={open}>
        <Block>
          {phase.phaseGroups.map((phaseGroup) => (
            <PhaseGroupView
              key={phaseGroup.id}
              phaseGroup={phaseGroup}
              eventId={eventId}
              phaseId={phase.id}
              getPhaseGroup={getPhaseGroup}
              selectSet={selectSet}
            />
          ))}
        </Block>
      </Collapse>
    </>
  );
}

function EventView({
  event,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  event: Event;
  getEvent: (id: number) => Promise<void>;
  getPhase: (id: number, eventId: number) => Promise<void>;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
  ) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [open, setOpen] = useState(false);

  const get = async () => {
    setGetting(true);
    await getEvent(event.id);
    setGetting(false);
  };
  return (
    <>
      <ListItemButton
        dense
        disableGutters
        onClick={() => {
          if (!open && event.phases.length === 0) {
            get();
          }
          setOpen(!open);
        }}
        sx={{ typography: 'caption' }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <Name>{event.name}</Name>
        {'\u00A0'}({event.id})
        <IconButton
          aria-label="restore event"
          onClick={(ev) => {
            ev.stopPropagation();
            get();
          }}
          size="small"
        >
          {getting ? <CircularProgress size="24px" /> : <Refresh />}
        </IconButton>
      </ListItemButton>
      <Collapse in={open}>
        <Block>
          {event.phases.map((phase) => (
            <PhaseView
              key={phase.id}
              phase={phase}
              eventId={event.id}
              getPhase={getPhase}
              getPhaseGroup={getPhaseGroup}
              selectSet={selectSet}
            />
          ))}
        </Block>
      </Collapse>
    </>
  );
}

export default function TournamentView({
  tournament,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  tournament: Tournament;
  getEvent: (id: number) => Promise<void>;
  getPhase: (id: number, eventId: number) => Promise<void>;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
  ) => void;
}) {
  return (
    <Box>
      {tournament.events.map((event) => (
        <EventView
          key={event.id}
          event={event}
          getEvent={getEvent}
          getPhase={getPhase}
          getPhaseGroup={getPhaseGroup}
          selectSet={selectSet}
        />
      ))}
    </Box>
  );
}
