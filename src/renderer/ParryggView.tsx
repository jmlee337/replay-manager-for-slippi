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
import { Phase, Tournament, Event } from '@parry-gg/client';
import {
  State,
  ParryggBracket,
  Set,
  SetWithNames,
  SelectedPhaseGroup,
  SelectedPhase,
  SelectedEvent,
} from '../common/types';
import SetViewInner from './SetView';
import filterSets from './filterSets';

const Block = styled.div`
  padding-left: 8px;
`;

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

function SetView({
  setWithNames,
  vlerkMode,
  selectSet,
}: {
  setWithNames: SetWithNames;
  vlerkMode: boolean;
  selectSet: () => Promise<void>;
}) {
  const {
    set: {
      entrant1Id,
      entrant1Score,
      entrant2Score,
      winnerId,
      fullRoundText,
      state,
      stream,
      station,
      updatedAtMs,
    },
    entrant1Names,
    entrant2Names,
  } = setWithNames;
  const isCompleted = state === State.COMPLETED;

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
        entrant1Score={entrant1Score}
        entrant1Win={entrant1Id === winnerId}
        entrant2Names={entrant2Names}
        entrant2Score={entrant2Score}
        fullRoundText={fullRoundText}
        showScores={isCompleted}
        state={state}
        stream={stream}
        station={station}
        wasReported={vlerkMode && isCompleted}
        updatedAtMs={updatedAtMs}
      />
    </ListItemButton>
  );
}

function BracketView({
  bracket,
  initiallyOpen,
  searchSubstr,
  vlerkMode,
  getBracket,
  selectSet,
}: {
  bracket: ParryggBracket;
  initiallyOpen: boolean;
  searchSubstr: string;
  vlerkMode: boolean;
  getBracket: (id: string) => Promise<void>;
  selectSet: (set: Set) => Promise<void>;
}) {
  const [getting, setGetting] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(vlerkMode);
  const [open, setOpen] = useState(initiallyOpen);

  const get = async () => {
    setGetting(true);
    await getBracket(bracket.id);
    setGetting(false);
  };

  const pendingSetsToShow = filterSets(
    bracket.sets?.pendingSets ?? [],
    searchSubstr,
  );
  const completedSetsToShow = filterSets(
    bracket.sets?.completedSets ?? [],
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
            if (!open && bracket.matchesList.length === 0) {
              get();
            }
            setOpen(!open);
          }}
          sx={{ typography: 'caption' }}
        >
          {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
          <Name>Bracket ({bracket.slug})</Name>
          <Tooltip arrow title="Refresh bracket">
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
          <div style={{ marginLeft: '-16px' }}>
            {pendingSetsToShow.map((setWithNames) => {
              const { set } = setWithNames;
              return (
                <SetView
                  key={set.id}
                  setWithNames={setWithNames}
                  vlerkMode={vlerkMode}
                  selectSet={() => selectSet(set)}
                />
              );
            })}
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
                  {completedSetsToShow.map((setWithNames) => {
                    const { set } = setWithNames;
                    return (
                      <SetView
                        key={set.id}
                        setWithNames={setWithNames}
                        vlerkMode={vlerkMode}
                        selectSet={() => selectSet(set)}
                      />
                    );
                  })}
                </Collapse>
              </>
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
  searchSubstr,
  vlerkMode,
  selectedBracketId,
  getPhase,
  getBracket,
  selectSet,
}: {
  phase: Phase.AsObject;
  initiallyOpen: boolean;
  searchSubstr: string;
  vlerkMode: boolean;
  selectedBracketId: string | undefined;
  getPhase: (id: string) => Promise<void>;
  getBracket: (id: string) => Promise<void>;
  selectSet: (set: Set, bracket: SelectedPhaseGroup) => Promise<void>;
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
          if (!open && phase.bracketsList.length === 0) {
            get();
          }
          setOpen(!open);
        }}
        sx={{ typography: 'caption' }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <Name>Phase ({phase.slug})</Name>
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
          {phase.bracketsList.map((bracket) => (
            <BracketView
              key={bracket.id}
              bracket={bracket}
              initiallyOpen={
                phase.bracketsList.length === 1 ||
                bracket.id === selectedBracketId
              }
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              getBracket={getBracket}
              selectSet={(set: Set) =>
                selectSet(set, {
                  id: bracket.id,
                  name: bracket.slug,
                  hasSiblings: phase.bracketsList.length > 1,
                  bracketType: bracket.type,
                  waveId: null,
                  winnersTargetPhaseId: null,
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
  searchSubstr,
  vlerkMode,
  selectedPhaseId,
  selectedBracketId,
  getEvent,
  getPhase,
  getBracket,
  selectSet,
}: {
  event: Event.AsObject;
  initiallyOpen: boolean;
  searchSubstr: string;
  vlerkMode: boolean;
  selectedPhaseId: string | undefined;
  selectedBracketId: string | undefined;
  getEvent: (id: string) => Promise<void>;
  getPhase: (id: string) => Promise<void>;
  getBracket: (id: string) => Promise<void>;
  selectSet: (
    set: Set,
    bracket: SelectedPhaseGroup,
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
          if (!open && event.phasesList.length === 0) {
            get();
          }
          setOpen(!open);
        }}
        sx={{ typography: 'caption' }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <Name>{event.name}</Name>
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
          {event.phasesList.map((phase) => (
            <PhaseView
              key={phase.id}
              phase={phase}
              initiallyOpen={
                event.phasesList.length === 1 || phase.id === selectedPhaseId
              }
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              selectedBracketId={selectedBracketId}
              getPhase={getPhase}
              getBracket={getBracket}
              selectSet={(set: Set, bracket: SelectedPhaseGroup) =>
                selectSet(set, bracket, {
                  id: phase.id,
                  name: phase.slug,
                  hasSiblings: event.phasesList.length > 1,
                })
              }
            />
          ))}
        </Block>
      </Collapse>
    </>
  );
}

export default function ParryggView({
  searchSubstr,
  tournament,
  vlerkMode,
  selectedEventId,
  selectedPhaseId,
  selectedBracketId,
  getEvent,
  getPhase,
  getBracket,
  selectSet,
}: {
  searchSubstr: string;
  tournament: Tournament.AsObject | undefined;
  vlerkMode: boolean;
  selectedEventId: string | undefined;
  selectedPhaseId: string | undefined;
  selectedBracketId: string | undefined;
  getEvent: (id: string) => Promise<void>;
  getPhase: (id: string) => Promise<void>;
  getBracket: (id: string) => Promise<void>;
  selectSet: (
    set: Set,
    bracket: SelectedPhaseGroup,
    phase: SelectedPhase,
    event: SelectedEvent,
  ) => Promise<void>;
}) {
  const events = tournament?.eventsList || [];
  return (
    <Box bgcolor="white">
      {events.map((event) => (
        <EventView
          key={event.id}
          event={event}
          initiallyOpen={events.length === 1 || event.id === selectedEventId}
          searchSubstr={searchSubstr}
          vlerkMode={vlerkMode}
          selectedPhaseId={selectedPhaseId}
          selectedBracketId={selectedBracketId}
          getEvent={getEvent}
          getPhase={getPhase}
          getBracket={getBracket}
          selectSet={(
            set: Set,
            bracket: SelectedPhaseGroup,
            phase: SelectedPhase,
          ) =>
            selectSet(set, bracket, phase, {
              id: event.id,
              name: event.name,
              slug: event.slug,
              hasSiblings: events.length > 1,
            })
          }
        />
      ))}
    </Box>
  );
}
