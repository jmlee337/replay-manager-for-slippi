import {
  Button,
  CircularProgress,
  DialogContent,
  DialogContentText,
  DialogTitle,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
} from '@mui/material';
import { FormEvent } from 'react';
import { AdminedTournament } from '../common/types';

export default function ChallongeTournamentForm({
  gettingAdminedTournaments,
  adminedTournaments,
  gettingTournament,
  getTournament,
  close,
}: {
  gettingAdminedTournaments: boolean;
  adminedTournaments: AdminedTournament[];
  gettingTournament: boolean;
  getTournament: (maybeSlug: string) => Promise<void>;
  close: () => void;
}) {
  const getTournamentOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      slug: { value: string };
    };
    const newSlug = target.slug.value;
    event.preventDefault();
    event.stopPropagation();
    if (newSlug) {
      await getTournament(newSlug);
      close();
    }
  };

  return (
    <>
      <DialogTitle>Add Challonge tournament</DialogTitle>
      <DialogContent>
        <form
          style={{
            alignItems: 'center',
            display: 'flex',
            marginTop: '8px',
            gap: '8px',
          }}
          onSubmit={getTournamentOnSubmit}
        >
          <TextField
            autoFocus
            label="Tournament Slug"
            name="slug"
            placeholder="pwq179iw"
            size="small"
            variant="outlined"
          />
          <Button
            disabled={gettingTournament}
            endIcon={gettingTournament && <CircularProgress size="24px" />}
            type="submit"
            variant="contained"
          >
            Add!
          </Button>
        </form>
        {gettingAdminedTournaments ? (
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
                await getTournament(adminedTournament.slug);
                close();
              }}
            >
              <ListItemText>{adminedTournament.name}</ListItemText>
            </ListItemButton>
          ))
        )}
      </DialogContent>
    </>
  );
}
