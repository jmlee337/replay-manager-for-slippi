import { Clear } from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from '@mui/material';
import { useRef, useState } from 'react';
import { GlobalHotKeys } from 'react-hotkeys';
import { Mode } from '../common/types';

export default function SearchBox({
  mode,
  searchSubstr,
  setSearchSubstr,
  vlerkMode,
}: {
  mode: Mode;
  searchSubstr: string;
  setSearchSubstr: (searchSubstr: string) => void;
  vlerkMode: boolean;
}) {
  const searchInputRef = useRef<HTMLInputElement>();
  const [showSearch, setShowSearch] = useState(false);
  const clearSearch = () => {
    setSearchSubstr('');
    setShowSearch(false);
  };
  return (
    <>
      {(showSearch || (vlerkMode && mode === Mode.STARTGG)) && (
        <Box style={{ background: 'white', padding: '8px 0' }}>
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
    </>
  );
}
