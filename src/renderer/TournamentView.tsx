import styled from '@emotion/styled';
import {
  Collapse,
  IconButton,
  ListItemButton,
  Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore, Refresh, Restore } from '@mui/icons-material';
import { useState } from 'react';
import { Event, Phase, PhaseGroup, Set, Tournament } from '../common/types';

const Block = styled.div`
  padding-left: 8px;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const EntrantLeftNames = styled.div`
  display: flex;
  flex-direction: column;
  text-align: right;
  width: 40%;
`;

const EntrantLeftScore = styled.div`
  border-right: black 1px solid;
  box-sizing: border-box;
  overflow-x: hidden;
  padding: 0 4px;
  text-align: right;
  text-overflow: ellipsis;
  width: 10%;
`;

const EntrantRightNames = styled.div`
  display: flex;
  flex-direction: column;
  width: 40%;
`;

const EntrantRightScore = styled.div`
  border-left: black 1px solid;
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

const typographyStyle = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'center',
};

function SetView({
  set,
  selectSet,
}: {
  set: Set;
  selectSet: (set: Set) => void;
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
    <ListItemButton dense disableGutters onClick={() => selectSet(set)}>
      <Column>
        <Typography style={typographyStyle} variant="caption">
          {set.fullRoundText}
        </Typography>
        <Typography style={typographyStyle} variant="body2">
          <EntrantLeftNames>
            {set.entrant1Names.map((name) => (
              <Name>{name}</Name>
            ))}
          </EntrantLeftNames>
          <EntrantLeftScore>{leftScore}</EntrantLeftScore>
          <EntrantRightScore>{rightScore}</EntrantRightScore>
          <EntrantRightNames>
            {set.entrant2Names.map((name) => (
              <Name>{name}</Name>
            ))}
          </EntrantRightNames>
        </Typography>
      </Column>
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
  selectSet: (set: Set) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Typography variant="caption">
        {phaseGroup.name} ({phaseGroup.id}){' '}
        <IconButton
          aria-label="restore phase"
          onClick={() => getPhaseGroup(phaseGroup.id, phaseId, eventId)}
          size="small"
        >
          <Refresh />
        </IconButton>
      </Typography>
      <Block>
        {phaseGroup.sets.pendingSets.map((set) => (
          <SetView key={set.id} set={set} selectSet={selectSet} />
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
                <SetView key={set.id} set={set} selectSet={selectSet} />
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
  selectSet: (set: Set) => void;
}) {
  return (
    <>
      <Typography variant="caption">
        {phase.name} ({phase.id}){' '}
        <IconButton
          aria-label="restore phase"
          onClick={() => getPhase(phase.id, eventId)}
          size="small"
        >
          <Restore />
        </IconButton>
      </Typography>
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
  selectSet: (set: Set) => void;
}) {
  return (
    <>
      <Typography variant="caption">
        {event.name} ({event.id}){' '}
        <IconButton
          aria-label="restore event"
          onClick={() => getEvent(event.id)}
          size="small"
        >
          <Restore />
        </IconButton>
      </Typography>
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
  selectSet: (set: Set) => void;
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
