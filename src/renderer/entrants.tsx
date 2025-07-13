import { useEffect, useState } from 'react';
import {
  AppBar,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { createRoot } from 'react-dom/client';
import { Refresh } from '@mui/icons-material';
import { RendererPool, RendererWave } from '../common/types';

function Pool({ pool }: { pool: RendererPool }) {
  return (
    <Stack width="200px">
      <Typography variant="caption">{pool.name}</Typography>
      <List>
        {pool.entrants.map((entrant) => (
          <ListItemText key={entrant.id}>
            {entrant.participants
              .map((participant) => participant.displayName)
              .join(' + ')}
          </ListItemText>
        ))}
      </List>
    </Stack>
  );
}

function WaveEl({ wave }: { wave: RendererWave }) {
  return (
    <ListItem
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'start',
        gap: '8px',
      }}
    >
      {wave.pools.map((pool) => (
        <Pool key={pool.id} pool={pool} />
      ))}
    </ListItem>
  );
}

function Entrants() {
  const [waves, setWaves] = useState<RendererWave[]>([]);
  const [gettingWaves, setGettingWaves] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setWaves(await window.electron.getPoolsByWave());
      } catch {
        // just catch
      }
      setGettingWaves(false);
    })();
  }, []);

  return (
    <>
      <AppBar position="fixed" color="inherit">
        <Toolbar disableGutters style={{ justifyContent: 'space-between' }}>
          <Typography variant="h5" marginLeft="16px">
            Seeds by Pool
          </Typography>
          <Tooltip title="Refresh">
            <IconButton
              disabled={gettingWaves}
              onClick={async () => {
                setGettingWaves(true);
                try {
                  setWaves(await window.electron.getPoolsByWave());
                } catch {
                  // just catch
                }
                setGettingWaves(false);
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      {gettingWaves ? (
        <Stack
          width="100%"
          height="100%"
          alignItems="center"
          justifyContent="center"
        >
          <CircularProgress size="24px" />
        </Stack>
      ) : (
        <List disablePadding style={{ marginTop: '64px' }}>
          {waves.map((wave) => (
            <WaveEl key={wave.id} wave={wave} />
          ))}
        </List>
      )}
    </>
  );
}

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<Entrants />);
