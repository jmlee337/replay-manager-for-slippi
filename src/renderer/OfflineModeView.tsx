import { Box, Collapse, ListItemButton, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import {
  KeyboardArrowDown,
  KeyboardArrowRight,
  KeyboardArrowUp,
} from '@mui/icons-material';
import {
  NameWithHighlight,
  RendererOfflineModeEvent,
  RendererOfflineModePhase,
  RendererOfflineModePool,
  RendererOfflineModeTournament,
  SelectedEvent,
  SelectedPhase,
  SelectedPhaseGroup,
  Set,
  State,
} from '../common/types';
import filterSets from './filterSets';
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
        station={set.station}
        wasReported={vlerkMode && set.wasReported}
        updatedAtMs={set.updatedAtMs}
      />
    </ListItemButton>
  );
}

function PoolView({
  pool,
  initiallyOpen,
  ancestorsOpen,
  searchSubstr,
  vlerkMode,
  selectSet,
}: {
  pool: RendererOfflineModePool;
  initiallyOpen: boolean;
  ancestorsOpen: boolean;
  searchSubstr: string;
  vlerkMode: boolean;
  selectSet: (set: Set) => Promise<void>;
}) {
  const [completedOpen, setCompletedOpen] = useState(vlerkMode);
  const [open, setOpen] = useState(initiallyOpen);

  const pendingSetsToShow = useMemo(
    () => filterSets(pool.sets.pendingSets, searchSubstr),
    [pool, searchSubstr],
  );
  const completedSetsToShow = useMemo(
    () => filterSets(pool.sets.completedSets, searchSubstr),
    [pool, searchSubstr],
  );

  return (
    (!searchSubstr ||
      pendingSetsToShow.length > 0 ||
      completedSetsToShow.length > 0) && (
      <>
        <ListItemButton
          dense
          disableGutters
          sx={{ typography: 'caption' }}
          onClick={() => {
            setOpen((oldOpen) => !oldOpen);
          }}
        >
          {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
          <Name>{pool.name}</Name>
          {'\u00A0'}({pool.id})
        </ListItemButton>
        <Collapse in={open && ancestorsOpen} unmountOnExit>
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
                  onClick={() =>
                    setCompletedOpen((oldCompletedOpen) => !oldCompletedOpen)
                  }
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
                <Collapse in={completedOpen && ancestorsOpen} unmountOnExit>
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
          </div>
        </Collapse>
      </>
    )
  );
}

function PhaseView({
  phase,
  initiallyOpen,
  ancestorsOpen,
  searchSubstr,
  vlerkMode,
  selectedPhaseGroupId,
  selectSet,
}: {
  phase: RendererOfflineModePhase;
  initiallyOpen: boolean;
  ancestorsOpen: boolean;
  searchSubstr: string;
  vlerkMode: boolean;
  selectedPhaseGroupId: number | undefined;
  selectSet: (set: Set, phaseGroup: SelectedPhaseGroup) => Promise<void>;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <>
      <ListItemButton
        dense
        disableGutters
        sx={{ typography: 'caption' }}
        onClick={() => {
          setOpen((oldOpen) => !oldOpen);
        }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <Name>{phase.name}</Name>
        {'\u00A0'}({phase.id})
      </ListItemButton>
      <Collapse in={open}>
        <Block>
          {phase.pools.map((pool) => (
            <PoolView
              key={pool.id}
              pool={pool}
              initiallyOpen={
                phase.pools.length === 1 || pool.id === selectedPhaseGroupId
              }
              ancestorsOpen={ancestorsOpen && open}
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              selectSet={(set: Set) =>
                selectSet(set, {
                  id: pool.id,
                  name: pool.name,
                  bracketType: pool.bracketType,
                  hasSiblings: phase.pools.length > 1,
                  waveId: pool.waveId,
                  winnersTargetPhaseId: pool.winnersTargetPhaseId,
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
  selectedPhaseGroupId,
  selectSet,
}: {
  event: RendererOfflineModeEvent;
  initiallyOpen: boolean;
  searchSubstr: string;
  vlerkMode: boolean;
  selectedPhaseId: number | undefined;
  selectedPhaseGroupId: number | undefined;
  selectSet: (
    set: Set,
    phaseGroup: SelectedPhaseGroup,
    phase: SelectedPhase,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <>
      <ListItemButton
        dense
        disableGutters
        onClick={() => {
          setOpen((oldOpen) => !oldOpen);
        }}
        sx={{ typography: 'caption' }}
      >
        {open ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
        <Name>{event.name}</Name>
        {'\u00A0'}({event.id})
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
              ancestorsOpen={open}
              searchSubstr={searchSubstr}
              vlerkMode={vlerkMode}
              selectedPhaseGroupId={selectedPhaseGroupId}
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

export default function OfflineModeView({
  searchSubstr,
  offlineModeTournament,
  vlerkMode,
  selectedEventId,
  selectedPhaseId,
  selectedPhaseGroupId,
  selectSet,
}: {
  searchSubstr: string;
  offlineModeTournament: RendererOfflineModeTournament;
  vlerkMode: boolean;
  selectedEventId: number | undefined;
  selectedPhaseId: number | undefined;
  selectedPhaseGroupId: number | undefined;
  selectSet: (
    set: Set,
    phaseGroup: SelectedPhaseGroup,
    phase: SelectedPhase,
    event: SelectedEvent,
  ) => Promise<void>;
}) {
  return (
    <Box bgcolor="white">
      {offlineModeTournament.events.map((event) => (
        <EventView
          key={event.id}
          event={event}
          initiallyOpen={
            offlineModeTournament.events.length === 1 ||
            event.id === selectedEventId
          }
          searchSubstr={searchSubstr}
          vlerkMode={vlerkMode}
          selectedPhaseId={selectedPhaseId}
          selectedPhaseGroupId={selectedPhaseGroupId}
          selectSet={(
            set: Set,
            phaseGroup: SelectedPhaseGroup,
            phase: SelectedPhase,
          ) =>
            selectSet(set, phaseGroup, phase, {
              id: event.id,
              name: event.name,
              slug: event.slug,
              hasSiblings: offlineModeTournament.events.length > 1,
            })
          }
        />
      ))}
    </Box>
  );
}
