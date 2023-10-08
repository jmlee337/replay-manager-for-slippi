import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputBase,
  TextField,
} from '@mui/material';
import { Edit, FolderOpen, Key, Refresh } from '@mui/icons-material';
import styled from '@emotion/styled';
import { Replay } from '../common/types';
import ReplayList from './ReplayList';

const AppWindow = styled.div`
  display: flex;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
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

function Hello() {
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
  const [tournament, setTournament] = useState({});
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
        setTournament(await window.electron.getTournament(newSlug));
        setSlug(newSlug);
        setSlugDialogOpen(false);
      } catch (e: any) {
        setTournamentError('Error: start.gg API key');
      } finally {
        setGettingTournament(false);
      }
    }
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
    <AppWindow>
      <Column style={{ flexGrow: 2, minWidth: '600px' }}>
        <FolderBar>
          <InputBase
            disabled
            size="small"
            value={dir}
            style={{ flexGrow: 1 }}
          />
          <IconButton aria-label="choose folder" onClick={chooseDir}>
            <FolderOpen />
          </IconButton>
          <IconButton aria-label="refresh folder" onClick={refreshReplays}>
            <Refresh />
          </IconButton>
        </FolderBar>
        {dirExists ? (
          <ReplayList replays={replays} onClick={onReplayClick} />
        ) : (
          <div>Folder not found</div>
        )}
      </Column>
      <Column style={{ flexGrow: 1, minWidth: '300px' }}>
        <div style={{ display: 'flex' }}>
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
        </div>
        {JSON.stringify(tournament)}
      </Column>
    </AppWindow>
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
