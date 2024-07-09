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
import {
  Event,
  Phase,
  PhaseGroup,
  Set,
  State,
  Tournament,
} from '../common/types';
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
  eventName,
  eventSlug,
  phaseId,
  phaseName,
  phaseGroupId,
  phaseGroupName,
  selectSet,
}: {
  set: Set;
  eventId: number;
  eventName: string;
  eventSlug: string;
  phaseId: number;
  phaseName: string;
  phaseGroupId: number;
  phaseGroupName: string;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseGroupName: string,
    phaseId: number,
    phaseName: string,
    eventId: number,
    eventName: string,
    eventSlug: string,
  ) => void;
}) {
  return (
    <ListItemButton
      dense
      disableGutters
      onClick={() =>
        selectSet(
          set,
          phaseGroupId,
          phaseGroupName,
          phaseId,
          phaseName,
          eventId,
          eventName,
          eventSlug,
        )
      }
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
        showScores={set.state === State.COMPLETED}
      />
    </ListItemButton>
  );
}

function PhaseGroupView({
  phaseGroup,
  initiallyOpen,
  completedInitiallyOpen,
  eventId,
  eventName,
  eventSlug,
  phaseId,
  phaseName,
  getPhaseGroup,
  selectSet,
}: {
  phaseGroup: PhaseGroup;
  initiallyOpen: boolean;
  completedInitiallyOpen: boolean;
  eventId: number;
  eventName: string;
  eventSlug: string;
  phaseId: number;
  phaseName: string;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseGroupName: string,
    phaseId: number,
    phaseName: string,
    eventId: number,
    eventName: string,
    eventSlug: string,
  ) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(completedInitiallyOpen);
  const [open, setOpen] = useState(initiallyOpen);

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
              eventName={eventName}
              eventSlug={eventSlug}
              phaseId={phaseId}
              phaseName={phaseName}
              phaseGroupId={phaseGroup.id}
              phaseGroupName={phaseGroup.name}
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
                    eventName={eventName}
                    eventSlug={eventSlug}
                    phaseId={phaseId}
                    phaseName={phaseName}
                    phaseGroupId={phaseGroup.id}
                    phaseGroupName={phaseGroup.name}
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
  initiallyOpen,
  eventId,
  eventName,
  eventSlug,
  vlerkMode,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  phase: Phase;
  initiallyOpen: boolean;
  eventId: number;
  eventName: string;
  eventSlug: string;
  vlerkMode: boolean;
  getPhase: (id: number, eventId: number) => Promise<void>;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroupId: number,
    phaseGroupName: string,
    phaseId: number,
    phaseName: string,
    eventId: number,
    eventName: string,
    eventSlug: string,
  ) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);

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
              initiallyOpen={phase.phaseGroups.length === 1}
              completedInitiallyOpen={vlerkMode}
              eventId={eventId}
              eventName={eventName}
              eventSlug={eventSlug}
              phaseId={phase.id}
              phaseName={phase.name}
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
  initiallyOpen,
  vlerkMode,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  event: Event;
  initiallyOpen: boolean;
  vlerkMode: boolean;
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
    phaseGroupName: string,
    phaseId: number,
    phaseName: string,
    eventId: number,
    eventName: string,
    eventSlug: string,
  ) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);

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
              initiallyOpen={event.phases.length === 1}
              eventId={event.id}
              eventName={event.name}
              eventSlug={event.slug}
              vlerkMode={vlerkMode}
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

export default function StartggView({
  tournament,
  vlerkMode,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  tournament: Tournament;
  vlerkMode: boolean;
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
    phaseGroupName: string,
    phaseId: number,
    phaseName: string,
    eventId: number,
    eventName: string,
    eventSlug: string,
  ) => void;
}) {
  return (
    <Box>
      {tournament.events.map((event) => (
        <EventView
          key={event.id}
          event={event}
          initiallyOpen={tournament.events.length === 1}
          vlerkMode={vlerkMode}
          getEvent={getEvent}
          getPhase={getPhase}
          getPhaseGroup={getPhaseGroup}
          selectSet={selectSet}
        />
      ))}
    </Box>
  );
}
