import {
  Button,
  CircularProgress,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FormEvent } from 'react';
import { Refresh } from '@mui/icons-material';
import { AdminedTournament } from '../common/types';

export default function StartggTournamentForm({
  gettingAdminedTournaments,
  adminedTournaments,
  gettingTournament,
  getAdminedTournaments,
  getTournament,
  close,
}: {
  gettingAdminedTournaments: boolean;
  adminedTournaments: AdminedTournament[];
  gettingTournament: boolean;
  getAdminedTournaments: () => Promise<void>;
  getTournament: (maybeSlug: string, initial?: boolean) => Promise<void>;
  close: () => void;
}) {
  const getTournamentOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      slug: { value: string };
    };
    const slugOrShort = target.slug.value;
    event.preventDefault();
    event.stopPropagation();
    if (slugOrShort) {
      await getTournament(slugOrShort, true);
      close();
    }
  };

  return (
    <>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="space-between"
        marginRight="24px"
      >
        <DialogTitle>Set start.gg tournament</DialogTitle>
        {gettingAdminedTournaments ? (
          <CircularProgress size="24px" style={{ padding: '8px' }} />
        ) : (
          <Tooltip arrow title="Refresh">
            <IconButton onClick={getAdminedTournaments}>
              <Refresh />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <DialogContent sx={{ pt: 0 }}>
        <form
          style={{
            alignItems: 'center',
            display: 'flex',
            marginTop: '8px',
            marginBottom: '8px',
            gap: '8px',
          }}
          onSubmit={getTournamentOnSubmit}
        >
          <TextField
            label="Tournament Slug"
            name="slug"
            placeholder="super-smash-con-2023"
            size="small"
            variant="outlined"
          />
          <Button
            disabled={gettingTournament}
            endIcon={gettingTournament && <CircularProgress size="24px" />}
            type="submit"
            variant="contained"
          >
            Get!
          </Button>
        </form>
        {gettingAdminedTournaments && adminedTournaments.length === 0 ? (
          <Stack direction="row" marginTop="8px" spacing="8px">
            <CircularProgress size="24px" />
            <DialogContentText>
              Getting admined tournaments...
            </DialogContentText>
          </Stack>
        ) : (
          adminedTournaments.map((adminedTournament) => (
            <ListItemButton
              key={adminedTournament.slug}
              onClick={async () => {
                await getTournament(adminedTournament.slug, true);
                close();
              }}
            >
              <ListItemText
                style={{ overflowX: 'hidden', whiteSpace: 'nowrap' }}
              >
                {adminedTournament.name}{' '}
                <Typography variant="caption">
                  ({adminedTournament.slug})
                </Typography>
              </ListItemText>
            </ListItemButton>
          ))
        )}
      </DialogContent>
    </>
  );
}
