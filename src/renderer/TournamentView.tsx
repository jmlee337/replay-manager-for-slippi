import styled from '@emotion/styled';
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
import { Event, Phase, PhaseGroup, Set, Tournament } from '../common/types';
import SetViewInner from './SetView';

const Block = styled.div`
  padding-left: 8px;
`;

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  return (
    <ListItemButton
      dense
      disableGutters
      onClick={() => selectSet(set, phaseGroupId, phaseId, eventId)}
    >
      <SetViewInner
        entrant1Names={set.entrant1Names}
        entrant1Score={set.entrant1Score}
        entrant1Win={set.entrant1Id === set.winnerId}
        entrant2Names={set.entrant2Names}
        entrant2Score={set.entrant2Score}
        fullRoundText={set.fullRoundText}
        state={set.state}
      />
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
        <Tooltip arrow title="Refresh phase group">
          <IconButton
            disabled={getting}
            onClick={(event) => {
              event.stopPropagation();
              get();
            }}
            size="small"
          >
            {getting ? <CircularProgress size="24px" /> : <Refresh />}
          </IconButton>
        </Tooltip>
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
        <Tooltip arrow title="Refresh phase">
          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              get();
            }}
            size="small"
          >
            {getting ? <CircularProgress size="24px" /> : <Refresh />}
          </IconButton>
        </Tooltip>
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
        <Tooltip arrow title="Refresh event">
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
