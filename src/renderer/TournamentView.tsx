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
import { ExpandLess, ExpandMore, Refresh, Restore } from '@mui/icons-material';
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

const ViewRow = styled(Stack)`
  align-items: center;
  flex-direction: row;
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
  const [open, setOpen] = useState(false);
  const onClick = async () => {
    setGetting(true);
    await getPhaseGroup(phaseGroup.id, phaseId, eventId);
    setGetting(false);
  };

  return (
    <>
      <ViewRow sx={{ typography: 'caption' }}>
        <Name>{phaseGroup.name}</Name>
        {'\u00A0'}({phaseGroup.id})
        <IconButton
          aria-label="restore phase"
          disabled={getting}
          onClick={onClick}
          size="small"
        >
          {getting ? <CircularProgress size="24px" /> : <Refresh />}
        </IconButton>
      </ViewRow>
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
            <ListItemButton dense onClick={() => setOpen(!open)}>
              <Typography
                alignItems="center"
                display="flex"
                justifyContent="right"
                variant="subtitle2"
                width="100%"
              >
                completed
                {open ? <ExpandLess /> : <ExpandMore />}
              </Typography>
            </ListItemButton>
            <Collapse in={open}>
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
  return (
    <>
      <ViewRow sx={{ typography: 'caption' }}>
        <Name>{phase.name}</Name>
        {'\u00A0'}({phase.id})
        <IconButton
          aria-label="restore phase"
          onClick={() => getPhase(phase.id, eventId)}
          size="small"
        >
          <Restore />
        </IconButton>
      </ViewRow>
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
  return (
    <>
      <ViewRow sx={{ typography: 'caption' }}>
        <Name>{event.name}</Name>
        {'\u00A0'}({event.id})
        <IconButton
          aria-label="restore event"
          onClick={() => getEvent(event.id)}
          size="small"
        >
          <Restore />
        </IconButton>
      </ViewRow>
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
    <>
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
    </>
  );
}
