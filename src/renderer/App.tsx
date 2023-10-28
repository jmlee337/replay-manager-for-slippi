import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Backdrop,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputBase,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DeleteForever,
  DeleteForeverOutlined,
  Edit,
  FolderOpen,
  Refresh,
} from '@mui/icons-material';
import styled from '@emotion/styled';
import {
  Event,
  Phase,
  PhaseGroup,
  PlayerOverrides,
  Replay,
  Set,
  StartggSet,
  Tournament,
} from '../common/types';
import { DraggableChip, DroppableChip } from './DragAndDrop';
import ReplayList from './ReplayList';
import TournamentView from './TournamentView';
import './App.css';
import CopyControls from './CopyControls';
import SetControls from './SetControls';
import ErrorDialog from './ErrorDialog';
import Settings from './Settings';

const Bottom = styled(Paper)`
  height: 147px;
`;

const BottomColumns = styled(Stack)`
  box-sizing: border-box;
  height: 100%;
  padding: 8px;
`;

const TopColumns = styled(Stack)`
  flex-grow: 1;
  max-height: calc(100% - 147px);
  padding: 0 8px;
`;

const TopColumn = styled(Stack)`
  flex-shrink: 1;
  overflow-y: scroll;
  padding: 8px 0;
`;

const Form = styled.form`
  align-items: center;
  display: flex;
  margin-top: 8px;
`;

const TournamentBar = styled.div`
  display: flex;
`;

function Hello() {
  const [error, setError] = useState('');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const showErrorDialog = (message: string) => {
    setError(message);
    setErrorDialogOpen(true);
  };

  const [batchActives, setBatchActives] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [overrides, setOverrides] = useState<PlayerOverrides[]>([
    { displayName: '', entrantId: 0 },
    { displayName: '', entrantId: 0 },
    { displayName: '', entrantId: 0 },
    { displayName: '', entrantId: 0 },
  ]);
  const resetOverrides = () => {
    setOverrides([
      { displayName: '', entrantId: 0 },
      { displayName: '', entrantId: 0 },
      { displayName: '', entrantId: 0 },
      { displayName: '', entrantId: 0 },
    ]);
  };

  // Replay list
  const [allReplaysSelected, setAllReplaysSelected] = useState(true);
  const [dir, setDir] = useState('');
  const [dirDeleteDialogOpen, setDirDeleteDialogOpen] = useState(false);
  const [dirDeleting, setDirDeleting] = useState(false);
  const [dirExists, setDirExists] = useState(true);
  const [replays, setReplays] = useState<Replay[]>([]);
  const selectedReplays = replays.filter((replay) => replay.selected);
  const applyAllReplaysSelected = (allReplays: Replay[], selected: boolean) =>
    allReplays.forEach((replay) => {
      replay.selected = selected;
    });
  const getNewBatchActives = (newReplays: Replay[]) =>
    newReplays.length > 0
      ? newReplays
          .map((replay) =>
            replay.players.map(
              (player) => player.playerType === 0 || player.playerType === 1,
            ),
          )
          .reduce(
            (accArr, curArr) => [
              accArr[0] && curArr[0],
              accArr[1] && curArr[1],
              accArr[2] && curArr[2],
              accArr[3] && curArr[3],
            ],
            [true, true, true, true],
          )
      : [false, false, false, false];
  const chooseDir = async () => {
    const openDialogRes = await window.electron.chooseDir();
    if (!openDialogRes.canceled) {
      const newDir = openDialogRes.filePaths[0];
      const newReplays = await window.electron.getReplaysInDir(newDir);
      applyAllReplaysSelected(newReplays, allReplaysSelected);
      setBatchActives(getNewBatchActives(newReplays));
      setDir(newDir);
      setDirExists(true);
      resetOverrides();
      setReplays(newReplays);
    }
  };
  const refreshReplays = async () => {
    let newReplays: Replay[] = [];
    try {
      newReplays = await window.electron.getReplaysInDir(dir);
      setDirExists(true);
    } catch (e: any) {
      setDirExists(false);
    }
    applyAllReplaysSelected(newReplays, allReplaysSelected);
    setBatchActives(getNewBatchActives(newReplays));
    resetOverrides();
    setReplays(newReplays);
  };
  const deleteDir = async () => {
    await window.electron.deleteDir(dir);
    await refreshReplays();
  };
  const onPlayerOverride = () => {
    setReplays(Array.from(replays));
  };
  const onReplayClick = (index: number) => {
    const newReplays = Array.from(replays);
    newReplays[index].selected = !newReplays[index].selected;
    const newBatchActives = getNewBatchActives(
      newReplays.filter((replay) => replay.selected),
    );

    const newOverrides = Array.from(overrides);
    for (let i = 0; i < 4; i += 1) {
      if (batchActives[i] && !newBatchActives[i]) {
        newOverrides[i] = { displayName: '', entrantId: 0 };
      }
    }

    if (newReplays[index].selected) {
      newReplays[index].players.forEach((player, i) => {
        player.playerOverrides = { ...newOverrides[i] };
      });
    } else {
      newReplays[index].players.forEach((player) => {
        player.overrideWin = false;
        player.playerOverrides = { displayName: '', entrantId: 0 };
      });
    }

    setBatchActives(newBatchActives);
    setOverrides(newOverrides);
    setReplays(newReplays);
  };

  // Tournament view
  const [slug, setSlug] = useState('');
  const [slugDialogOpen, setSlugDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const [tournament, setTournament] = useState<Tournament>({
    slug: '',
    events: [],
  });
  const getTournament = async (getSlug: string) => {
    if (!getSlug) {
      return false;
    }

    let events;
    setGettingTournament(true);
    try {
      events = await window.electron.getTournament(getSlug);
    } catch (e: any) {
      showErrorDialog(e.toString());
      setGettingTournament(false);
      return false;
    }

    if (tournament.slug === getSlug && tournament.events.length > 0) {
      const eventsMap = new Map<number, Event>();
      tournament.events.forEach((event) => {
        eventsMap.set(event.id, event);
      });
      events = events.map((event) => eventsMap.get(event.id) || event);
    }
    tournament.events = events;
    tournament.slug = getSlug;
    setTournament(tournament);
    setGettingTournament(false);
    return true;
  };
  const getTournamentOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      slug: { value: string };
    };
    const newSlug = target.slug.value;
    event.preventDefault();
    event.stopPropagation();
    if (newSlug) {
      setSlugDialogOpen(false);
      if (await getTournament(newSlug)) {
        setSlug(newSlug);
      }
    }
  };
  const getEvent = async (id: number) => {
    let phases;
    try {
      phases = await window.electron.getEvent(id);
    } catch (e: any) {
      showErrorDialog(e.toString());
      return;
    }

    const editEvent = tournament.events.find((event) => event.id === id);
    if (editEvent) {
      if (editEvent.phases.length > 0) {
        const phasesMap = new Map<number, Phase>();
        editEvent.phases.forEach((phase) => {
          phasesMap.set(phase.id, phase);
        });
        phases = phases.map((phase) => phasesMap.get(phase.id) || phase);
      }
      editEvent.phases = phases;
      setTournament({ ...tournament });
    }
  };

  const getPhase = async (id: number, eventId: number) => {
    let phaseGroups;
    try {
      phaseGroups = await window.electron.getPhase(id);
    } catch (e: any) {
      showErrorDialog(e.toString());
      return;
    }

    const editEvent = tournament.events.find((event) => event.id === eventId);
    if (!editEvent) {
      return;
    }

    const editPhase = editEvent.phases.find((phase) => phase.id === id);
    if (editPhase) {
      if (editPhase.phaseGroups.length > 0) {
        const phaseGroupsMap = new Map<number, PhaseGroup>();
        editPhase.phaseGroups.forEach((phaseGroup) => {
          phaseGroupsMap.set(phaseGroup.id, phaseGroup);
        });
        phaseGroups = phaseGroups.map(
          (phaseGroup) => phaseGroupsMap.get(phaseGroup.id) || phaseGroup,
        );
      }
      editPhase.phaseGroups = phaseGroups;
      setTournament({ ...tournament });
    }
  };

  const getPhaseGroup = async (
    id: number,
    phaseId: number,
    eventId: number,
  ) => {
    let sets;
    try {
      sets = await window.electron.getPhaseGroup(id);
    } catch (e: any) {
      showErrorDialog(e.toString());
      return;
    }

    const editEvent = tournament.events.find((event) => event.id === eventId);
    if (!editEvent) {
      return;
    }

    const editPhase = editEvent.phases.find((phase) => phase.id === phaseId);
    if (!editPhase) {
      return;
    }

    const editPhaseGroup = editPhase.phaseGroups.find(
      (phaseGroup) => phaseGroup.id === id,
    );
    if (editPhaseGroup) {
      editPhaseGroup.sets = sets;
      setTournament({ ...tournament });
    }
  };

  // for click-assigning set participants
  const [selectedChipData, setSelectedChipData] = useState({
    displayName: '',
    entrantId: 0,
  });
  const resetSelectedChipData = () => {
    setSelectedChipData({
      displayName: '',
      entrantId: 0,
    });
  };

  // batch chips
  const onClickOrDrop = (
    displayName: string,
    entrantId: number,
    index: number,
  ) => {
    const newOverrides = Array.from(overrides);
    newOverrides[index] = { displayName, entrantId };
    newOverrides.forEach((override, i) => {
      if (
        i !== index &&
        override.displayName === displayName &&
        override.entrantId === entrantId
      ) {
        override.displayName = '';
        override.entrantId = 0;
      }
    });

    selectedReplays.forEach((replay) => {
      replay.players[index].playerOverrides = { ...newOverrides[index] };
      replay.players.forEach((otherPlayer) => {
        if (
          otherPlayer.port === replay.players[index].port ||
          (otherPlayer.playerType !== 0 && otherPlayer.playerType !== 1)
        ) {
          return;
        }
        if (
          otherPlayer.playerOverrides.displayName === displayName &&
          otherPlayer.playerOverrides.entrantId
        ) {
          otherPlayer.playerOverrides.displayName = '';
          otherPlayer.playerOverrides.entrantId = 0;
        }
      });
    });
    setOverrides(newOverrides);
    resetSelectedChipData();
  };
  const batchChip = (index: number) => (
    <DroppableChip
      active={batchActives[index]}
      label={overrides[index].displayName || `P${index + 1}`}
      outlined={batchActives[index]}
      selectedChipData={selectedChipData}
      style={{ width: '25%' }}
      onClickOrDrop={(displayName: string, entrantId: number) =>
        onClickOrDrop(displayName, entrantId, index)
      }
    />
  );

  // set controls
  const [selectedSet, setSelectedSet] = useState<Set>({
    id: 0,
    state: 0,
    fullRoundText: '',
    winnerId: null,
    entrant1Id: 0,
    entrant1Names: [''],
    entrant1Score: null,
    entrant2Id: 0,
    entrant2Names: [''],
    entrant2Score: null,
  });
  const [selectedSetChain, setSelectedSetChain] = useState({
    eventId: 0,
    phaseId: 0,
    phaseGroupId: 0,
  });
  const selectSet = (
    set: Set,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
  ) => {
    const newOverrides = [
      { displayName: '', entrantId: 0 },
      { displayName: '', entrantId: 0 },
      { displayName: '', entrantId: 0 },
      { displayName: '', entrantId: 0 },
    ];
    selectedReplays.forEach((replay) => {
      replay.players.forEach((player, i) => {
        player.playerOverrides = { ...newOverrides[i] };
      });
    });
    const newReplays = Array.from(replays);

    setOverrides(newOverrides);
    setReplays(newReplays);
    setSelectedSetChain({ eventId, phaseId, phaseGroupId });
    setSelectedSet(set);
  };
  const reportSet = async (set: StartggSet) => {
    try {
      await window.electron.reportSet(set);
      await new Promise((resolve) => {
        // it seems that start.gg needs a moment to settle
        // before the set will be reflected as completed.
        setTimeout(resolve, 1000);
      });
      await getPhaseGroup(
        selectedSetChain.phaseGroupId,
        selectedSetChain.phaseId,
        selectedSetChain.eventId,
      );
      const updatedSelectedSet = { ...selectedSet };
      updatedSelectedSet.state = 3;
      setSelectedSet(updatedSelectedSet);
    } catch (e: any) {
      showErrorDialog(e.toString());
    }
  };

  // settings
  const [gotStartggApiKey, setGotStartggApiKey] = useState(false);
  const [startggApiKey, setStartggApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const startggKeyPromise = window.electron.getStartggKey();
      setAppVersion(await appVersionPromise);
      setStartggApiKey(await startggKeyPromise);
      setGotStartggApiKey(true);
    };
    inner();
  }, []);

  return (
    <>
      <TopColumns
        direction="row"
        divider={<Divider flexItem orientation="vertical" />}
        spacing="8px"
      >
        <TopColumn flexGrow={1} minWidth="600px">
          <Stack alignItems="center" direction="row" paddingLeft="16px">
            <Tooltip
              arrow
              title={
                allReplaysSelected
                  ? 'Deselect all replays'
                  : 'Select all replays'
              }
            >
              <Checkbox
                checked={allReplaysSelected}
                onClick={() => {
                  const newAllReplaysSelected = !allReplaysSelected;
                  setAllReplaysSelected(newAllReplaysSelected);
                  applyAllReplaysSelected(replays, newAllReplaysSelected);
                  setReplays(Array.from(replays));
                }}
              />
            </Tooltip>
            <InputBase
              disabled
              size="small"
              value={dir || 'Set replays folder...'}
              style={{ flexGrow: 1 }}
            />
            {dir && dirExists && (
              <>
                <Tooltip arrow title="Delete replays folder">
                  <IconButton onClick={() => setDirDeleteDialogOpen(true)}>
                    <DeleteForeverOutlined />
                  </IconButton>
                </Tooltip>
                <Dialog
                  open={dirDeleteDialogOpen}
                  onClose={() => {
                    setDirDeleteDialogOpen(false);
                  }}
                >
                  <DialogTitle>Delete Replays Folder?</DialogTitle>
                  <DialogContent>
                    <Alert severity="warning">
                      {replays.length} replays will be deleted!
                    </Alert>
                  </DialogContent>
                  <DialogActions>
                    <Button
                      endIcon={
                        dirDeleting ? (
                          <CircularProgress size="24px" />
                        ) : (
                          <DeleteForever />
                        )
                      }
                      onClick={async () => {
                        setDirDeleting(true);
                        await deleteDir();
                        setDirDeleteDialogOpen(false);
                        setDirDeleting(false);
                      }}
                      variant="contained"
                    >
                      Delete
                    </Button>
                  </DialogActions>
                </Dialog>
              </>
            )}
            <Tooltip arrow title="Refresh replays">
              <IconButton onClick={refreshReplays}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip arrow title="Set replays folder">
              <IconButton onClick={chooseDir}>
                <FolderOpen />
              </IconButton>
            </Tooltip>
          </Stack>
          {dirExists ? (
            <ReplayList
              replays={replays}
              selectedChipData={selectedChipData}
              onClick={onReplayClick}
              onOverride={onPlayerOverride}
              resetSelectedChipData={resetSelectedChipData}
            />
          ) : (
            <Alert severity="error" sx={{ mb: '8px', pl: '24px' }}>
              Folder not found
            </Alert>
          )}
          <CopyControls selectedReplays={selectedReplays} />
        </TopColumn>
        <TopColumn width="300px">
          <TournamentBar>
            <InputBase
              disabled
              size="small"
              value={slug || 'Set tournament slug...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip arrow title="Refresh tournament">
              <IconButton
                aria-label="Refresh tournament"
                onClick={() => getTournament(slug)}
              >
                {gettingTournament ? (
                  <CircularProgress size="24px" />
                ) : (
                  <Refresh />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip arrow title="Set tournament slug">
              <IconButton
                aria-label="Set tournament slug"
                onClick={() => setSlugDialogOpen(true)}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Dialog
              open={slugDialogOpen}
              onClose={() => setSlugDialogOpen(false)}
            >
              <DialogTitle>Set Tournament Slug</DialogTitle>
              <DialogContent>
                <Form onSubmit={getTournamentOnSubmit}>
                  <TextField
                    autoFocus
                    label="Tournament Slug"
                    name="slug"
                    placeholder="super-smash-con-2023"
                    size="small"
                    variant="outlined"
                  />
                  <Button type="submit">Get!</Button>
                </Form>
              </DialogContent>
            </Dialog>
          </TournamentBar>
          <TournamentView
            tournament={tournament}
            getEvent={getEvent}
            getPhase={getPhase}
            getPhaseGroup={getPhaseGroup}
            selectSet={selectSet}
          />
        </TopColumn>
      </TopColumns>
      <Bottom elevation={3}>
        <BottomColumns
          direction="row"
          divider={<Divider flexItem orientation="vertical" />}
          spacing="8px"
        >
          <Stack
            boxSizing="border-box"
            flexGrow={1}
            minWidth="600px"
            padding="20px 16px 0 58px"
          >
            <Stack direction="row">
              {batchChip(0)}
              {batchChip(1)}
              {batchChip(2)}
              {batchChip(3)}
            </Stack>
            <Stack
              alignItems="center"
              direction="row"
              flexGrow={1}
              justifyContent="right"
              marginTop="8px"
              spacing="1em"
            >
              <Stack>
                <Typography variant="body2">
                  1. Set replay folder and tournament slug
                </Typography>
                <Typography variant="body2">
                  3. Drag and drop (or select and assign) players
                </Typography>
              </Stack>
              <Stack>
                <Typography variant="body2">
                  2. Select replays and set
                </Typography>
                <Typography variant="body2">
                  4. Copy replays / Report set
                </Typography>
              </Stack>
            </Stack>
          </Stack>
          <Stack justifyContent="space-between" width="300px">
            <Stack>
              {!!selectedSet.id && (
                <>
                  <Typography
                    lineHeight="20px"
                    textAlign="center"
                    variant="caption"
                  >
                    {selectedSet.fullRoundText} ({selectedSet.id})
                  </Typography>
                  <Tooltip arrow title="Drag or select players!">
                    <Stack direction="row" gap="8px">
                      <Stack gap="8px" width="50%">
                        <DraggableChip
                          displayName={selectedSet.entrant1Names[0].slice(
                            0,
                            15,
                          )}
                          entrantId={selectedSet.entrant1Id}
                          selectedChipData={selectedChipData}
                          setSelectedChipData={setSelectedChipData}
                        />
                        {selectedSet.entrant1Names.length > 1 && (
                          <DraggableChip
                            displayName={selectedSet.entrant1Names[1].slice(
                              0,
                              15,
                            )}
                            entrantId={selectedSet.entrant1Id}
                            selectedChipData={selectedChipData}
                            setSelectedChipData={setSelectedChipData}
                          />
                        )}
                      </Stack>
                      <Stack gap="8px" width="50%">
                        <DraggableChip
                          displayName={selectedSet.entrant2Names[0].slice(
                            0,
                            15,
                          )}
                          entrantId={selectedSet.entrant2Id}
                          selectedChipData={selectedChipData}
                          setSelectedChipData={setSelectedChipData}
                        />
                        {selectedSet.entrant2Names.length > 1 && (
                          <DraggableChip
                            displayName={selectedSet.entrant2Names[1].slice(
                              0,
                              15,
                            )}
                            entrantId={selectedSet.entrant2Id}
                            selectedChipData={selectedChipData}
                            setSelectedChipData={setSelectedChipData}
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Tooltip>
                </>
              )}
            </Stack>
            <Stack direction="row" paddingTop="8px" spacing="8px">
              <Stack direction="row" justifyContent="center" width="50%">
                <SetControls
                  reportSet={reportSet}
                  selectedReplays={selectedReplays}
                  set={selectedSet}
                />
              </Stack>
              <Stack direction="row" justifyContent="center" width="50%">
                <Settings
                  appVersion={appVersion}
                  gotStartggApiKey={gotStartggApiKey}
                  startggApiKey={startggApiKey}
                  setStartggApiKey={setStartggApiKey}
                />
              </Stack>
            </Stack>
          </Stack>
        </BottomColumns>
      </Bottom>
      <Backdrop
        onClick={resetSelectedChipData}
        open={!!(selectedChipData.displayName && selectedChipData.entrantId)}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      />
      <ErrorDialog
        message={error}
        onClose={() => {
          setError('');
          setErrorDialogOpen(false);
        }}
        open={errorDialogOpen}
      />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
