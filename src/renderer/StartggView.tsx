import styled from '@emotion/styled';
import {
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  ListItemButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Clear,
  KeyboardArrowDown,
  KeyboardArrowRight,
  KeyboardArrowUp,
  Refresh,
} from '@mui/icons-material';
import { useRef, useState } from 'react';
import { GlobalHotKeys } from 'react-hotkeys';
import {
  Event,
  NameWithHighlight,
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

type SetWithNames = {
  set: Set;
  entrant1Names: NameWithHighlight[];
  entrant2Names: NameWithHighlight[];
};

function SetView({
  set,
  entrant1Names,
  entrant2Names,
  eventId,
  eventName,
  eventSlug,
  phaseId,
  phaseName,
  phaseGroupId,
  phaseGroupName,
  vlerkMode,
  selectSet,
}: {
  set: Set;
  entrant1Names: NameWithHighlight[];
  entrant2Names: NameWithHighlight[];
  eventId: number;
  eventName: string;
  eventSlug: string;
  phaseId: number;
  phaseName: string;
  phaseGroupId: number;
  phaseGroupName: string;
  vlerkMode: boolean;
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
        entrant1Names={entrant1Names}
        entrant1Score={set.entrant1Score}
        entrant1Win={set.entrant1Id === set.winnerId}
        entrant2Names={entrant2Names}
        entrant2Score={set.entrant2Score}
        fullRoundText={set.fullRoundText}
        state={set.state}
        showScores={set.state === State.COMPLETED}
        wasReported={vlerkMode && set.wasReported}
      />
    </ListItemButton>
  );
}

function PhaseGroupView({
  phaseGroup,
  initiallyOpen,
  eventId,
  eventName,
  eventSlug,
  phaseId,
  phaseName,
  searchSubstr,
  vlerkMode,
  getPhaseGroup,
  selectSet,
}: {
  phaseGroup: PhaseGroup;
  initiallyOpen: boolean;
  eventId: number;
  eventName: string;
  eventSlug: string;
  phaseId: number;
  phaseName: string;
  searchSubstr: string;
  vlerkMode: boolean;
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
  const [completedOpen, setCompletedOpen] = useState(vlerkMode);
  const [open, setOpen] = useState(initiallyOpen);

  const get = async () => {
    setGetting(true);
    await getPhaseGroup(phaseGroup.id, phaseId, eventId);
    setGetting(false);
  };

  const filterSets = (sets: Set[], substr: string): SetWithNames[] => {
    const setsToShow: SetWithNames[] = [];
    sets.forEach((set) => {
      if (!substr) {
        setsToShow.push({
          set,
          entrant1Names: set.entrant1Participants.map((participant) => ({
            name: participant.displayName,
          })),
          entrant2Names: set.entrant2Participants.map((participant) => ({
            name: participant.displayName,
          })),
        });
      } else {
        const entrant1Names: NameWithHighlight[] = [];
        const entrant2Names: NameWithHighlight[] = [];
        const includeStr = substr.toLowerCase();
        let toShow = false;
        set.entrant1Participants.forEach((participant) => {
          const start = participant.displayName
            .toLowerCase()
            .indexOf(includeStr);
          if (start < 0) {
            entrant1Names.push({ name: participant.displayName });
          } else {
            toShow = true;
            entrant1Names.push({
              highlight: { start, end: start + includeStr.length },
              name: participant.displayName,
            });
          }
        });
        set.entrant2Participants.forEach((participant) => {
          const start = participant.displayName
            .toLowerCase()
            .indexOf(includeStr);
          if (start < 0) {
            entrant2Names.push({ name: participant.displayName });
          } else {
            toShow = true;
            entrant2Names.push({
              highlight: { start, end: start + includeStr.length },
              name: participant.displayName,
            });
          }
        });
        if (toShow) {
          setsToShow.push({ set, entrant1Names, entrant2Names });
        }
      }
    });
    return setsToShow;
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
            {pendingSetsToShow.map((setWithNames) => (
              <SetView
                key={setWithNames.set.id}
                set={setWithNames.set}
                entrant1Names={setWithNames.entrant1Names}
                entrant2Names={setWithNames.entrant2Names}
                eventId={eventId}
                eventName={eventName}
                eventSlug={eventSlug}
                phaseId={phaseId}
                phaseName={phaseName}
                phaseGroupId={phaseGroup.id}
                phaseGroupName={phaseGroup.name}
                vlerkMode={vlerkMode}
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
                      set={setWithNames.set}
                      entrant1Names={setWithNames.entrant1Names}
                      entrant2Names={setWithNames.entrant2Names}
                      eventId={eventId}
                      eventName={eventName}
                      eventSlug={eventSlug}
                      phaseId={phaseId}
                      phaseName={phaseName}
                      phaseGroupId={phaseGroup.id}
                      phaseGroupName={phaseGroup.name}
                      vlerkMode={vlerkMode}
                      selectSet={selectSet}
                    />
                  ))}
                </Collapse>
              </>
            )}
          </Block>
        </Collapse>
      </>
    )
  );
}

function PhaseView({
  phase,
  initiallyOpen,
  eventId,
  eventName,
  eventSlug,
  searchSubstr,
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
  searchSubstr: string;
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
              eventId={eventId}
              eventName={eventName}
              eventSlug={eventSlug}
              phaseId={phase.id}
              phaseName={phase.name}
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
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
  searchSubstr,
  vlerkMode,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  event: Event;
  initiallyOpen: boolean;
  searchSubstr: string;
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
              searchSubstr={searchSubstr}
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchSubstr, setSearchSubstr] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const clearSearch = () => {
    setSearchSubstr('');
    setShowSearch(false);
  };

  return (
    <Box>
      {(showSearch || vlerkMode) && (
        <Box style={{ padding: '8px 0' }}>
          <TextField
            autoFocus
            fullWidth
            label="Search"
            onChange={(event) => {
              setSearchSubstr(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                clearSearch();
              }
            }}
            inputRef={searchInputRef}
            size="small"
            value={searchSubstr}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Clear search">
                    <IconButton
                      onClick={() => {
                        clearSearch();
                      }}
                    >
                      <Clear />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}
      {tournament.events.map((event) => (
        <EventView
          key={event.id}
          event={event}
          initiallyOpen={tournament.events.length === 1}
          searchSubstr={searchSubstr}
          vlerkMode={vlerkMode}
          getEvent={getEvent}
          getPhase={getPhase}
          getPhaseGroup={getPhaseGroup}
          selectSet={selectSet}
        />
      ))}
      <GlobalHotKeys
        keyMap={{
          ESC: 'escape',
          FIND: window.electron.isMac ? 'command+f' : 'ctrl+f',
        }}
        handlers={{
          ESC: () => {
            clearSearch();
          },
          FIND: () => {
            setShowSearch(true);
            searchInputRef.current?.focus();
          },
        }}
      />
    </Box>
  );
}
