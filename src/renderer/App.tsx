import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { FormEvent, SyntheticEvent, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputBase,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close, Edit, FolderOpen, Key, Refresh } from '@mui/icons-material';
import styled from '@emotion/styled';
import { Replay, Set, Tournament } from '../common/types';
import ReplayList from './ReplayList';
import TournamentView from './TournamentView';
import './App.css';

const Bottom = styled.div`
  height: 108px;
`;

const BottomColumns = styled.div`
  align-items: center;
  box-sizing: border-box;
  display: flex;
  gap: 8px;
  height: 100%;
  padding: 8px;
`;

const TopColumns = styled.div`
  display: flex;
  flex-grow: 1;
  gap: 8px;
  max-height: calc(100% - 108px);
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
  const [errorToastError, setErrorToastError] = useState('');
  const [errorToastOpen, setErrorToastOpen] = useState(false);
  const handleErrorToastClose = (
    event: SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return;
    }

    setErrorToastError('');
    setErrorToastOpen(false);
  };
  const showErrorToast = (e: any) => {
    if (e instanceof Error) {
      setErrorToastError(e.message);
    } else {
      setErrorToastError('Unknown Error!');
    }
    setErrorToastOpen(true);
  };

  const [dir, setDir] = useState('');
  const [dirExists, setDirExists] = useState(true);
  const [replays, setReplays] = useState([] as Replay[]);
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
    setReplays(newReplays);
  };

  const [slug, setSlug] = useState('');
  const [slugDialogOpen, setSlugDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const [tournamentError, setTournamentError] = useState('');
  const [tournament, setTournament] = useState({
    slug: '',
    events: [],
  } as Tournament);
  const [selectedSet, setSelectedSet] = useState({} as Set);
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
      showErrorToast(e);
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
      showErrorToast(e);
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
      showErrorToast(e);
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

  const selectSet = (set: Set) => {
    setSelectedSet(set);
  };

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
      <TopColumns>
        <TopColumn flexGrow={2} minWidth="600px">
          <FolderBar>
            <InputBase
              disabled
              size="small"
              value={dir}
              style={{ flexGrow: 1 }}
            />
            <IconButton aria-label="refresh folder" onClick={refreshReplays}>
              <Refresh />
            </IconButton>
            <IconButton aria-label="choose folder" onClick={chooseDir}>
              <FolderOpen />
            </IconButton>
          </FolderBar>
          {dirExists ? (
            <ReplayList replays={replays} onClick={onReplayClick} />
          ) : (
            <div>Folder not found</div>
          )}
        </TopColumn>
        <TopColumn flexGrow={1} minWidth="300px">
          <TournamentBar>
            <InputBase
              disabled
              size="small"
              value={slug}
              style={{ flexGrow: 1 }}
            />
            <IconButton
              aria-label="set tournament slug"
              onClick={() => setSlugDialogOpen(true)}
            >
              <Edit />
            </IconButton>
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
                    placeholder="genesis-9"
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
            <IconButton
              aria-label="set startgg api key"
              onClick={openStartggKeyDialog}
            >
              <Key />
            </IconButton>
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
      <Bottom>
        <BottomColumns>
          <Stack flexGrow={2} minWidth="600px">
            a
          </Stack>
          <Stack flexGrow={1} minWidth="300px">
            {!!selectedSet.id && (
              <>
                <Typography
                  lineHeight="20px"
                  textAlign="center"
                  variant="caption"
                >
                  {selectedSet.fullRoundText} ({selectedSet.id})
                </Typography>
                <Stack direction="row" gap="8px">
                  <Stack gap="8px" width="50%">
                    <Chip
                      label={selectedSet.entrant1Names[0].slice(0, 15)}
                      variant="outlined"
                    />
                    {selectedSet.entrant1Names.length > 1 && (
                      <Chip
                        label={selectedSet.entrant1Names[1].slice(0, 15)}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                  <Stack gap="8px" width="50%">
                    <Chip
                      label={selectedSet.entrant2Names[0].slice(0, 15)}
                      variant="outlined"
                    />
                    {selectedSet.entrant2Names.length > 1 && (
                      <Chip
                        label={selectedSet.entrant2Names[1].slice(0, 15)}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Stack>
              </>
            )}
          </Stack>
        </BottomColumns>
      </Bottom>
      <Snackbar
        open={errorToastOpen}
        autoHideDuration={5000}
        onClose={handleErrorToastClose}
        message={errorToastError}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleErrorToastClose}
          >
            <Close fontSize="small" />
          </IconButton>
        }
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
