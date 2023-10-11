import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
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
import { Edit, FolderOpen, Key, Refresh } from '@mui/icons-material';
import styled from '@emotion/styled';
import { Replay, Set, StartggSet, Tournament } from '../common/types';
import { DraggableChip, DroppableChip } from './DragAndDrop';
import ReplayList from './ReplayList';
import TournamentView from './TournamentView';
import './App.css';
import CopyControls from './CopyControls';
import SetControls from './SetControls';
import ErrorDialog from './ErrorDialog';

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

const FolderBar = styled.div`
  display: flex;
  padding-left: 58px;
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

  const [p1Active, setP1Active] = useState(false);
  const [p2Active, setP2Active] = useState(false);
  const [p3Active, setP3Active] = useState(false);
  const [p4Active, setP4Active] = useState(false);
  const [displayName1, setDisplayName1] = useState('');
  const [displayName2, setDisplayName2] = useState('');
  const [displayName3, setDisplayName3] = useState('');
  const [displayName4, setDisplayName4] = useState('');
  const [entrantId1, setEntrantId1] = useState(0);
  const [entrantId2, setEntrantId2] = useState(0);
  const [entrantId3, setEntrantId3] = useState(0);
  const [entrantId4, setEntrantId4] = useState(0);

  // Replay list
  const [dir, setDir] = useState('');
  const [dirExists, setDirExists] = useState(true);
  const [replays, setReplays] = useState([] as Replay[]);
  const selectedReplays = replays.filter((replay) => replay.selected);
  const chooseDir = async () => {
    const openDialogRes = await window.electron.chooseDir();
    if (!openDialogRes.canceled) {
      const newDir = openDialogRes.filePaths[0];
      const newReplays = await window.electron.getReplaysInDir(newDir);
      setDir(newDir);
      setDirExists(true);
      setReplays(newReplays);
    }
  };
  const refreshReplays = async () => {
    try {
      setReplays(await window.electron.getReplaysInDir(dir));
    } catch (e: any) {
      setDirExists(false);
      setReplays([]);
    }
  };
  const onReplayClick = (index: number) => {
    const newReplays = Array.from(replays);
    newReplays[index].selected = !newReplays[index].selected;
    const newSelectedReplays = newReplays.filter((replay) => replay.selected);
    let newActive = [false, false, false, false];
    if (newSelectedReplays.length > 0) {
      newActive = newSelectedReplays
        .map((replay) =>
          replay.players.map((player) => player.playerType === 0),
        )
        .reduce(
          (accArr, curArr) => [
            accArr[0] && curArr[0],
            accArr[1] && curArr[1],
            accArr[2] && curArr[2],
            accArr[3] && curArr[3],
          ],
          [true, true, true, true],
        );
    }
    if (p1Active && !newActive[0]) {
      setDisplayName1('');
      setEntrantId1(0);
    }
    setP1Active(newActive[0]);

    if (p2Active && !newActive[1]) {
      setDisplayName2('');
      setEntrantId2(0);
    }
    setP2Active(newActive[1]);

    if (p3Active && !newActive[2]) {
      setDisplayName3('');
      setEntrantId3(0);
    }
    setP3Active(newActive[2]);

    if (p4Active && !newActive[3]) {
      setDisplayName4('');
      setEntrantId4(0);
    }
    setP4Active(newActive[3]);

    setReplays(newReplays);
  };

  // Tournament view
  const [slug, setSlug] = useState('');
  const [slugDialogOpen, setSlugDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const [tournamentError, setTournamentError] = useState('');
  const [tournament, setTournament] = useState({
    slug: '',
    events: [],
  } as Tournament);
  const getTournament = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      slug: { value: string };
    };
    const newSlug = target.slug.value;
    event.preventDefault();
    event.stopPropagation();
    if (newSlug) {
      try {
        setGettingTournament(true);
        setTournamentError('');
        setTournament({
          slug: newSlug,
          events: await window.electron.getTournament(newSlug),
        });
        setSlug(newSlug);
        setSlugDialogOpen(false);
      } catch (e: any) {
        setTournamentError(e.message);
      } finally {
        setGettingTournament(false);
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

  const [selectedSet, setSelectedSet] = useState({} as Set);
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
    setDisplayName1('');
    setDisplayName2('');
    setDisplayName3('');
    setDisplayName4('');
    setEntrantId1(0);
    setEntrantId2(0);
    setEntrantId3(0);
    setEntrantId4(0);

    setSelectedSetChain({ eventId, phaseId, phaseGroupId });
    setSelectedSet(set);
  };

  const reportSet = async (set: StartggSet) => {
    try {
      await window.electron.reportSet(set);
      await getPhaseGroup(
        selectedSetChain.phaseGroupId,
        selectedSetChain.phaseId,
        selectedSetChain.eventId,
      );
    } catch (e: any) {
      showErrorDialog(e.toString());
    }
  };

  // start.gg key
  const [startggKey, setStartggKey] = useState('');
  const [startggKeyDialogOpen, setStartggKeyDialogOpen] = useState(false);
  const openStartggKeyDialog = async () => {
    setStartggKey(await window.electron.getStartggKey());
    setStartggKeyDialogOpen(true);
  };
  const setNewStartggKey = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      key: { value: string };
    };
    const newKey = target.key.value;
    event.preventDefault();
    event.stopPropagation();
    if (newKey) {
      await window.electron.setStartggKey(newKey);
      setStartggKeyDialogOpen(false);
    }
  };

  return (
    <>
      <TopColumns
        direction="row"
        divider={<Divider flexItem orientation="vertical" />}
        spacing="8px"
      >
        <TopColumn flexGrow={1} minWidth="600px">
          <FolderBar>
            <InputBase
              disabled
              size="small"
              value={dir || 'Set replays folder...'}
              style={{ flexGrow: 1 }}
            />
            <Tooltip arrow title="Refresh replays">
              <IconButton aria-label="Refresh replays" onClick={refreshReplays}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip arrow title="Set replays folder">
              <IconButton aria-label="Set replay folder" onClick={chooseDir}>
                <FolderOpen />
              </IconButton>
            </Tooltip>
          </FolderBar>
          {dirExists ? (
            <ReplayList replays={replays} onClick={onReplayClick} />
          ) : (
            <div>Folder not found</div>
          )}
          <CopyControls
            displayNames={[
              displayName1,
              displayName2,
              displayName3,
              displayName4,
            ]}
            selectedReplays={selectedReplays}
          />
        </TopColumn>
        <TopColumn width="300px">
          <TournamentBar>
            <InputBase
              disabled
              size="small"
              value={slug || 'Set tournament slug...'}
              style={{ flexGrow: 1 }}
            />
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
                <Form onSubmit={getTournament}>
                  <TextField
                    autoFocus
                    label="Tournament Slug"
                    name="slug"
                    placeholder="super-smash-con-2023"
                    size="small"
                    variant="outlined"
                  />
                  <Button disabled={gettingTournament} type="submit">
                    {gettingTournament ? 'Getting...' : 'Get!'}
                  </Button>
                </Form>
                <DialogContentText color="red" variant="caption">
                  {tournamentError}
                </DialogContentText>
              </DialogContent>
            </Dialog>
            <Tooltip arrow title="Set start.gg API key">
              <IconButton
                aria-label="Set start.gg API key"
                onClick={openStartggKeyDialog}
              >
                <Key />
              </IconButton>
            </Tooltip>
            <Dialog
              open={startggKeyDialogOpen}
              onClose={() => setStartggKeyDialogOpen(false)}
            >
              <DialogTitle>Set start.gg API key</DialogTitle>
              <DialogContent>
                <Form onSubmit={setNewStartggKey}>
                  <TextField
                    autoFocus
                    defaultValue={startggKey}
                    fullWidth
                    label="API key"
                    name="key"
                    size="small"
                    type="password"
                    variant="standard"
                  />
                  <Button type="submit">Set!</Button>
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
              <DroppableChip
                active={p1Active}
                displayName={displayName1}
                port={1}
                onDrop={(displayName: string, entrantId: number) => {
                  setDisplayName1(displayName);
                  setEntrantId1(entrantId);
                }}
              />
              <DroppableChip
                active={p2Active}
                displayName={displayName2}
                port={2}
                onDrop={(displayName: string, entrantId: number) => {
                  setDisplayName2(displayName);
                  setEntrantId2(entrantId);
                }}
              />
              <DroppableChip
                active={p3Active}
                displayName={displayName3}
                port={3}
                onDrop={(displayName: string, entrantId: number) => {
                  setDisplayName3(displayName);
                  setEntrantId3(entrantId);
                }}
              />
              <DroppableChip
                active={p4Active}
                displayName={displayName4}
                port={4}
                onDrop={(displayName: string, entrantId: number) => {
                  setDisplayName4(displayName);
                  setEntrantId4(entrantId);
                }}
              />
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
                <Typography variant="body2">3. Drag players here</Typography>
              </Stack>
              <Stack>
                <Typography variant="body2">
                  2. Select replays and set
                </Typography>
                <Typography variant="body2">
                  4. Copy replays / save or report set
                </Typography>
              </Stack>
            </Stack>
          </Stack>
          <Stack width="300px">
            {!!selectedSet.id && (
              <>
                <Typography
                  lineHeight="20px"
                  textAlign="center"
                  variant="caption"
                >
                  {selectedSet.fullRoundText} ({selectedSet.id})
                </Typography>
                <Tooltip arrow title="Drag players!">
                  <Stack direction="row" gap="8px">
                    <Stack gap="8px" width="50%">
                      <DraggableChip
                        displayName={selectedSet.entrant1Names[0].slice(0, 15)}
                        entrantId={selectedSet.entrant1Id}
                      />
                      {selectedSet.entrant1Names.length > 1 && (
                        <DraggableChip
                          displayName={selectedSet.entrant1Names[1].slice(
                            0,
                            15,
                          )}
                          entrantId={selectedSet.entrant1Id}
                        />
                      )}
                    </Stack>
                    <Stack gap="8px" width="50%">
                      <DraggableChip
                        displayName={selectedSet.entrant2Names[0].slice(0, 15)}
                        entrantId={selectedSet.entrant2Id}
                      />
                      {selectedSet.entrant2Names.length > 1 && (
                        <DraggableChip
                          displayName={selectedSet.entrant2Names[1].slice(
                            0,
                            15,
                          )}
                          entrantId={selectedSet.entrant2Id}
                        />
                      )}
                    </Stack>
                  </Stack>
                </Tooltip>
                <SetControls
                  entrantIds={[entrantId1, entrantId2, entrantId3, entrantId4]}
                  reportSet={reportSet}
                  selectedReplays={selectedReplays}
                  set={selectedSet}
                />
              </>
            )}
          </Stack>
        </BottomColumns>
      </Bottom>
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
