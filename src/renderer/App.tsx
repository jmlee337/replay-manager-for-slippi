import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { IconButton, InputBase } from '@mui/material';
import { FolderOpen, Refresh } from '@mui/icons-material';
import styled from '@emotion/styled';
import { Replay } from '../common/types';
import ReplayList from './ReplayList';

const AppWindow = styled.div`
  display: flex;
  flex-direction: column;
`;
const FolderBar = styled.div`
  display: flex;
  padding-left: 58px;
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
  return (
    <AppWindow>
      <FolderBar>
        <InputBase disabled size="small" value={dir} style={{ flexGrow: 1 }} />
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
