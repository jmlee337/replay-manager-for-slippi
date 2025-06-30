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
  PlayArrow,
  Refresh,
} from '@mui/icons-material';
import { useState } from 'react';
import {
  Event,
  NameWithHighlight,
  Phase,
  PhaseGroup,
  SelectedEvent,
  SelectedPhase,
  SelectedPhaseGroup,
  Set,
  State,
  Tournament,
} from '../common/types';
import SetViewInner from './SetView';
import filterSets from './filterSets';
import TiebreakerDialog from './TiebreakerDialog';

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
  entrant1Names,
  entrant2Names,
  vlerkMode,
  selectSet,
}: {
  set: Set;
  entrant1Names: NameWithHighlight[];
  entrant2Names: NameWithHighlight[];
  vlerkMode: boolean;
  selectSet: () => Promise<void>;
}) {
  return (
    <ListItemButton
      dense
      disableGutters
      onClick={() => {
        selectSet();
      }}
    >
      <SetViewInner
        entrant1Names={entrant1Names}
        entrant1Score={set.entrant1Score}
        entrant1Win={set.entrant1Id === set.winnerId}
        entrant2Names={entrant2Names}
        entrant2Score={set.entrant2Score}
        fullRoundText={set.fullRoundText}
        showScores={set.state === State.COMPLETED}
        state={set.state}
        stream={set.stream}
        wasReported={vlerkMode && set.wasReported}
      />
    </ListItemButton>
  );
}

function PhaseGroupView({
  phaseGroup,
  initiallyOpen,
  isOnline,
  eventId,
  phaseId,
  tournamentSlug,
  searchSubstr,
  vlerkMode,
  getPhaseGroup,
  selectSet,
}: {
  phaseGroup: PhaseGroup;
  initiallyOpen: boolean;
  isOnline: boolean;
  eventId: number;
  phaseId: number;
  tournamentSlug: string;
  searchSubstr: string;
  vlerkMode: boolean;
  getPhaseGroup: (id: number) => Promise<void>;
  selectSet: (set: Set) => Promise<void>;
}) {
  const [getting, setGetting] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(vlerkMode);
  const [open, setOpen] = useState(initiallyOpen);

  const get = async () => {
    setGetting(true);
    await getPhaseGroup(phaseGroup.id);
    setGetting(false);
  };

  const pendingSetsToShow = filterSets(
    phaseGroup.sets.pendingSets,
    searchSubstr,
  );
  const completedSetsToShow = filterSets(
    phaseGroup.sets.completedSets,
    searchSubstr,
  );

  return (
    (!searchSubstr ||
      pendingSetsToShow.length > 0 ||
      completedSetsToShow.length > 0) && (
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
          <Tooltip arrow title="Refresh pool">
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
          {phaseGroup.state === State.PENDING && (
            <Box>
              {isOnline && (
                <Tooltip arrow title="Start pool on website">
                  <IconButton
                    onClick={(ev) => {
                      ev.stopPropagation();
                      window.open(
                        `//www.start.gg/admin/tournament/${tournamentSlug}/brackets/${eventId}/${phaseId}/${phaseGroup.id}`,
                      );
                    }}
                    size="small"
                  >
                    <PlayArrow />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </ListItemButton>
        <Collapse in={open}>
          <div style={{ marginLeft: '-16px' }}>
            {pendingSetsToShow.map((setWithNames) => (
              <SetView
                key={setWithNames.set.id}
                set={setWithNames.set}
                entrant1Names={setWithNames.entrant1Names}
                entrant2Names={setWithNames.entrant2Names}
                vlerkMode={vlerkMode}
                selectSet={() => selectSet(setWithNames.set)}
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
                      set={setWithNames.set}
                      entrant1Names={setWithNames.entrant1Names}
                      entrant2Names={setWithNames.entrant2Names}
                      vlerkMode={vlerkMode}
                      selectSet={() => selectSet(setWithNames.set)}
                    />
                  ))}
                </Collapse>
              </>
            )}
            {(phaseGroup.bracketType === 3 || phaseGroup.bracketType === 4) &&
              phaseGroup.sets.completedSets.length > 0 &&
              phaseGroup.sets.pendingSets.length === 0 && (
                <TiebreakerDialog
                  entrants={phaseGroup.entrants}
                  selectSet={(set: Set) => selectSet(set)}
                />
              )}
          </div>
        </Collapse>
      </>
    )
  );
}

function PhaseView({
  phase,
  initiallyOpen,
  isOnline,
  eventId,
  tournamentSlug,
  searchSubstr,
  vlerkMode,
  selectedPhaseGroupId,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  phase: Phase;
  initiallyOpen: boolean;
  isOnline: boolean;
  eventId: number;
  tournamentSlug: string;
  searchSubstr: string;
  vlerkMode: boolean;
  selectedPhaseGroupId: number | undefined;
  getPhase: (id: number) => Promise<void>;
  getPhaseGroup: (id: number) => Promise<void>;
  selectSet: (set: Set, phaseGroup: SelectedPhaseGroup) => Promise<void>;
}) {
  const [getting, setGetting] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);

  const get = async () => {
    setGetting(true);
    await getPhase(phase.id);
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
              initiallyOpen={
                phase.phaseGroups.length === 1 ||
                phaseGroup.id === selectedPhaseGroupId
              }
              isOnline={isOnline}
              eventId={eventId}
              phaseId={phase.id}
              tournamentSlug={tournamentSlug}
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              getPhaseGroup={getPhaseGroup}
              selectSet={(set: Set) =>
                selectSet(set, {
                  id: phaseGroup.id,
                  name: phaseGroup.name,
                  bracketType: phaseGroup.bracketType,
                  hasSiblings: phase.phaseGroups.length > 1,
                  waveId: phaseGroup.waveId,
                })
              }
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
  tournamentSlug,
  searchSubstr,
  vlerkMode,
  selectedPhaseId,
  selectedPhaseGroupId,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  event: Event;
  initiallyOpen: boolean;
  tournamentSlug: string;
  searchSubstr: string;
  vlerkMode: boolean;
  selectedPhaseId: number | undefined;
  selectedPhaseGroupId: number | undefined;
  getEvent: (id: number) => Promise<void>;
  getPhase: (id: number) => Promise<void>;
  getPhaseGroup: (id: number) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroup: SelectedPhaseGroup,
    phase: SelectedPhase,
  ) => Promise<void>;
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
        <Box>
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
        </Box>
      </ListItemButton>
      <Collapse in={open}>
        <Block>
          {event.phases.map((phase) => (
            <PhaseView
              key={phase.id}
              phase={phase}
              initiallyOpen={
                event.phases.length === 1 || phase.id === selectedPhaseId
              }
              isOnline={event.isOnline}
              eventId={event.id}
              tournamentSlug={tournamentSlug}
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              selectedPhaseGroupId={selectedPhaseGroupId}
              getPhase={getPhase}
              getPhaseGroup={getPhaseGroup}
              selectSet={(set: Set, phaseGroup: SelectedPhaseGroup) =>
                selectSet(set, phaseGroup, {
                  id: phase.id,
                  name: phase.name,
                  hasSiblings: event.phases.length > 1,
                })
              }
            />
          ))}
        </Block>
      </Collapse>
    </>
  );
}

export default function StartggView({
  searchSubstr,
  tournament,
  vlerkMode,
  selectedEventId,
  selectedPhaseId,
  selectedPhaseGroupId,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  searchSubstr: string;
  tournament: Tournament;
  vlerkMode: boolean;
  selectedEventId: number | undefined;
  selectedPhaseId: number | undefined;
  selectedPhaseGroupId: number | undefined;
  getEvent: (id: number) => Promise<void>;
  getPhase: (id: number) => Promise<void>;
  getPhaseGroup: (id: number) => Promise<void>;
  selectSet: (
    set: Set,
    phaseGroup: SelectedPhaseGroup,
    phase: SelectedPhase,
    event: SelectedEvent,
  ) => Promise<void>;
}) {
  return (
    <Box bgcolor="white">
      {tournament.events.map((event) => (
        <EventView
          key={event.id}
          event={event}
          initiallyOpen={
            tournament.events.length === 1 || event.id === selectedEventId
          }
          tournamentSlug={tournament.slug}
          searchSubstr={searchSubstr}
          vlerkMode={vlerkMode}
          selectedPhaseId={selectedPhaseId}
          selectedPhaseGroupId={selectedPhaseGroupId}
          getEvent={getEvent}
          getPhase={getPhase}
          getPhaseGroup={getPhaseGroup}
          selectSet={(
            set: Set,
            phaseGroup: SelectedPhaseGroup,
            phase: SelectedPhase,
          ) =>
            selectSet(set, phaseGroup, phase, {
              id: event.id,
              name: event.name,
              slug: event.slug,
              hasSiblings: tournament.events.length > 1,
            })
          }
        />
      ))}
    </Box>
  );
}
