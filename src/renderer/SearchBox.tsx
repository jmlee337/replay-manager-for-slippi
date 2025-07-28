import { Clear } from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mode } from '../common/types';
import { setWindowEventListener, WindowEvent } from './setWindowEventListener';

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

  const clearSearch = useCallback(() => {
    setSearchSubstr('');
    setShowSearch(false);
  }, [setSearchSubstr]);

  const ctrlF = useCallback(() => {
    setShowSearch(true);
    searchInputRef.current?.select();
  }, []);

  useEffect(() => {
    setWindowEventListener(WindowEvent.ESCAPE, clearSearch);
  }, [clearSearch]);

  useEffect(() => {
    setWindowEventListener(WindowEvent.CTRLF, ctrlF);
  }, [ctrlF]);

  return (
    (showSearch || (vlerkMode && mode === Mode.STARTGG)) && (
      <>
        <Box
          style={{
            background: '#F5A9B8',
            padding: '8px',
            position: 'fixed',
            width: '300px',
            right: 0,
          }}
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 5,
          }}
        >
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
              } else if (
                ((window.electron.isMac && event.metaKey) ||
                  (!window.electron.isMac && event.ctrlKey)) &&
                event.key === 'f'
              ) {
                searchInputRef.current?.select();
              }
            }}
            inputRef={searchInputRef}
            size="small"
            value={searchSubstr}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip arrow title="Clear search">
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
        <Box marginTop="56px" />
      </>
    )
  );
}
