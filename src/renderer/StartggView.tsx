import styled from '@emotion/styled';
import {
  Box,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  selectSet: () => void;
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
  isStartable,
  elevateStartButton,
  eventId,
  phaseId,
  tournamentSlug,
  searchSubstr,
  vlerkMode,
  getPhaseGroup,
  selectSet,
  showError,
}: {
  phaseGroup: PhaseGroup;
  initiallyOpen: boolean;
  isStartable: boolean;
  elevateStartButton: boolean;
  eventId: number;
  phaseId: number;
  tournamentSlug: string;
  searchSubstr: string;
  vlerkMode: boolean;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (set: Set) => void;
  showError: (error: string) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(vlerkMode);
  const [open, setOpen] = useState(initiallyOpen);

  const get = async () => {
    setGetting(true);
    await getPhaseGroup(phaseGroup.id, phaseId, eventId);
    setGetting(false);
  };
  const start = async () => {
    setStarting(true);
    try {
      await window.electron.startPhaseGroup(phaseGroup.id, phaseId, eventId);
    } catch (e: any) {
      if (e instanceof Error) {
        showError(e.message);
      }
    } finally {
      setStarting(false);
    }
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
            <Box
              bgcolor={elevateStartButton ? 'white' : undefined}
              sx={{
                zIndex: (theme) =>
                  elevateStartButton ? theme.zIndex.drawer + 2 : undefined,
              }}
            >
              {isStartable ? (
                <Tooltip arrow title="Start pool (lock seeds)">
                  <IconButton
                    onClick={(ev) => {
                      ev.stopPropagation();
                      start();
                    }}
                    size="small"
                  >
                    {starting ? (
                      <CircularProgress size="24px" />
                    ) : (
                      <PlayArrow />
                    )}
                  </IconButton>
                </Tooltip>
              ) : (
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
          <Block>
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
                  selectSet={(set: Set) => {
                    selectSet(set);
                  }}
                />
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
  isStartable,
  elevateStartButton,
  eventId,
  tournamentSlug,
  searchSubstr,
  vlerkMode,
  getPhase,
  getPhaseGroup,
  selectSet,
  showError,
}: {
  phase: Phase;
  initiallyOpen: boolean;
  isStartable: boolean;
  elevateStartButton: boolean;
  eventId: number;
  tournamentSlug: string;
  searchSubstr: string;
  vlerkMode: boolean;
  getPhase: (id: number, eventId: number) => Promise<void>;
  getPhaseGroup: (
    id: number,
    phaseId: number,
    eventId: number,
  ) => Promise<void>;
  selectSet: (set: Set, phaseGroupId: number, phaseGroupName: string) => void;
  showError: (error: string) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);

  const get = async () => {
    setGetting(true);
    await getPhase(phase.id, eventId);
    setGetting(false);
  };
  const start = async () => {
    setStarting(true);
    try {
      await window.electron.startPhase(phase.id, eventId);
    } catch (e: any) {
      if (e instanceof Error) {
        showError(e.message);
      }
    } finally {
      setStarting(false);
    }
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
        {open ? (
          <KeyboardArrowDown />
        ) : (
          <Box
            bgcolor={elevateStartButton && !isStartable ? 'white' : undefined}
            sx={{
              zIndex: (theme) =>
                elevateStartButton && !isStartable
                  ? theme.zIndex.drawer + 2
                  : undefined,
            }}
          >
            <KeyboardArrowRight />
          </Box>
        )}
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
        {isStartable && phase.state === State.PENDING && (
          <Box
            bgcolor={elevateStartButton ? 'white' : undefined}
            sx={{
              zIndex: (theme) =>
                elevateStartButton ? theme.zIndex.drawer + 2 : undefined,
            }}
          >
            <Tooltip arrow title="Start phase (lock seeds and pools)">
              <IconButton
                onClick={(ev) => {
                  ev.stopPropagation();
                  start();
                }}
                size="small"
              >
                {starting ? <CircularProgress size="24px" /> : <PlayArrow />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </ListItemButton>
      <Collapse in={open}>
        <Block>
          {phase.phaseGroups.map((phaseGroup) => (
            <PhaseGroupView
              key={phaseGroup.id}
              phaseGroup={phaseGroup}
              initiallyOpen={phase.phaseGroups.length === 1}
              isStartable={isStartable}
              elevateStartButton={elevateStartButton}
              eventId={eventId}
              phaseId={phase.id}
              tournamentSlug={tournamentSlug}
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              getPhaseGroup={getPhaseGroup}
              selectSet={(set: Set) =>
                selectSet(set, phaseGroup.id, phaseGroup.name)
              }
              showError={showError}
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
  elevateStartButton,
  tournamentSlug,
  searchSubstr,
  vlerkMode,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
  showError,
}: {
  event: Event;
  initiallyOpen: boolean;
  elevateStartButton: boolean;
  tournamentSlug: string;
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
  ) => void;
  showError: (error: string) => void;
}) {
  const [getting, setGetting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);

  const get = async () => {
    setGetting(true);
    await getEvent(event.id);
    setGetting(false);
  };
  const start = async () => {
    setStarting(true);
    try {
      await window.electron.startEvent(event.id);
    } catch (e: any) {
      if (e instanceof Error) {
        showError(e.message);
      }
    } finally {
      setStarting(false);
    }
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
        {open ? (
          <KeyboardArrowDown />
        ) : (
          <Box
            bgcolor={elevateStartButton && event.isOnline ? 'white' : undefined}
            sx={{
              zIndex: (theme) =>
                elevateStartButton && event.isOnline
                  ? theme.zIndex.drawer + 2
                  : undefined,
            }}
          >
            <KeyboardArrowRight />
          </Box>
        )}
        <Name>{event.name}</Name>
        {'\u00A0'}({event.id})
        <Box
          bgcolor={elevateStartButton && event.isOnline ? 'white' : undefined}
          sx={{
            zIndex: (theme) =>
              elevateStartButton && event.isOnline
                ? theme.zIndex.drawer + 2
                : undefined,
          }}
        >
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
        {!event.isOnline && event.state === State.PENDING && (
          <Box
            bgcolor={elevateStartButton ? 'white' : undefined}
            sx={{
              zIndex: (theme) =>
                elevateStartButton ? theme.zIndex.drawer + 2 : undefined,
            }}
          >
            <Tooltip arrow title="Start event (lock seeds, phases, and pools)">
              <IconButton
                onClick={(ev) => {
                  ev.stopPropagation();
                  start();
                }}
                size="small"
              >
                {starting ? <CircularProgress size="24px" /> : <PlayArrow />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </ListItemButton>
      <Collapse in={open}>
        <Block>
          {event.phases.map((phase) => (
            <PhaseView
              key={phase.id}
              phase={phase}
              initiallyOpen={event.phases.length === 1}
              isStartable={!event.isOnline}
              elevateStartButton={elevateStartButton}
              eventId={event.id}
              tournamentSlug={tournamentSlug}
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              getPhase={getPhase}
              getPhaseGroup={getPhaseGroup}
              selectSet={(
                set: Set,
                phaseGroupId: number,
                phaseGroupName: string,
              ) =>
                selectSet(
                  set,
                  phaseGroupId,
                  phaseGroupName,
                  phase.id,
                  phase.name,
                )
              }
              showError={showError}
            />
          ))}
        </Block>
      </Collapse>
    </>
  );
}

export default function StartggView({
  elevateStartButton,
  searchSubstr,
  tournament,
  vlerkMode,
  getEvent,
  getPhase,
  getPhaseGroup,
  selectSet,
}: {
  elevateStartButton: boolean;
  searchSubstr: string;
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
  const [error, setError] = useState('');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const showError = (newError: string) => {
    setError(newError);
    setErrorDialogOpen(true);
  };
  return (
    <>
      <Box bgcolor="white">
        {tournament.events.map((event) => (
          <EventView
            key={event.id}
            event={event}
            initiallyOpen={tournament.events.length === 1}
            elevateStartButton={elevateStartButton}
            tournamentSlug={tournament.slug}
            searchSubstr={searchSubstr}
            vlerkMode={vlerkMode}
            getEvent={getEvent}
            getPhase={getPhase}
            getPhaseGroup={getPhaseGroup}
            selectSet={(
              set: Set,
              phaseGroupId: number,
              phaseGroupName: string,
              phaseId: number,
              phaseName: string,
            ) =>
              selectSet(
                set,
                phaseGroupId,
                phaseGroupName,
                phaseId,
                phaseName,
                event.id,
                event.name,
                event.slug,
              )
            }
            showError={showError}
          />
        ))}
      </Box>
      <Dialog
        open={errorDialogOpen}
        onClose={() => {
          setErrorDialogOpen(false);
        }}
      >
        <DialogTitle>Error! (You may want to copy this message)</DialogTitle>
        <DialogContent>
          <DialogContentText>{error}</DialogContentText>
        </DialogContent>
      </Dialog>
    </>
  );
}
