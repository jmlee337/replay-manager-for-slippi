import {
  Button,
  CircularProgress,
  DialogContent,
  DialogTitle,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
} from '@mui/material';
import { FormEvent } from 'react';
import { AdminedTournament } from '../common/types';

export default function StartggTournamentForm({
  gettingAdminedTournaments,
  adminedTournaments,
  gettingTournament,
  getTournament,
  setSlug,
  close,
}: {
  gettingAdminedTournaments: boolean;
  adminedTournaments: AdminedTournament[];
  gettingTournament: boolean;
  getTournament: (maybeSlug: string, initial?: boolean) => Promise<boolean>;
  setSlug: (slug: string) => void;
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
      if (await getTournament(newSlug, true)) {
        setSlug(newSlug);
        close();
      }
    }
  };

  return (
    <>
      <DialogTitle>Set start.gg tournament</DialogTitle>
      <DialogContent>
        <form
          style={{ alignItems: 'center', display: 'flex', marginTop: '8px' }}
          onSubmit={getTournamentOnSubmit}
        >
          <TextField
            autoFocus
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
          >
            Get!
          </Button>
        </form>
        {gettingAdminedTournaments ? (
          <Stack direction="row" justifyContent="center" marginTop="8px">
            <CircularProgress size="24px" />
          </Stack>
        ) : (
          adminedTournaments.map((adminedTournament) => (
            <ListItemButton
              key={adminedTournament.slug}
              onClick={async () => {
                if (await getTournament(adminedTournament.slug, true)) {
                  setSlug(adminedTournament.slug);
                  close();
                }
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
