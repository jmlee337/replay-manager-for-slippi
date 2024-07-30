import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { FolderOpen } from '@mui/icons-material';
import {
  AdminedTournament,
  ChallongeTournament,
  GuideState,
  Mode,
} from '../common/types';
import ManualNamesForm from './ManualNamesForm';
import StartggTournamentForm from './StartggTournamentForm';
import ChallongeTournamentForm from './ChallongeTournamentForm';

export default function GuidedDialog({
  open,
  setOpen,
  mode,
  gettingAdminedTournaments,
  adminedTournaments,
  gettingTournament,
  startggTournamentSlug,
  setStartggTournamentSlug,
  getStartggTournament,
  challongeTournaments,
  getChallongeTournament,
  manualNames,
  setManualNames,
  copyDir,
  setCopyDir,
  state,
  setState,
  backdropOpen,
  openBackdrop,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  mode: Mode;
  gettingAdminedTournaments: boolean;
  adminedTournaments: AdminedTournament[];
  gettingTournament: boolean;
  startggTournamentSlug: string;
  setStartggTournamentSlug: (startggTournamentSlug: string) => void;
  getStartggTournament: (
    maybeSlug: string,
    initial?: boolean,
  ) => Promise<boolean>;
  challongeTournaments: Map<string, ChallongeTournament>;
  getChallongeTournament: (maybeSlug: string) => Promise<void>;
  manualNames: string[];
  setManualNames: (manualNames: string[]) => void;
  copyDir: string;
  setCopyDir: (copyDir: string) => void;
  state: GuideState;
  setState: (state: GuideState) => void;
  backdropOpen: boolean;
  openBackdrop: () => void;
}) {
  const tournamentSet =
    (mode === Mode.STARTGG && startggTournamentSlug) ||
    (mode === Mode.CHALLONGE && challongeTournaments.size > 0) ||
    (mode === Mode.MANUAL && manualNames.length > 0);
  const copyDirSet = copyDir.length > 0;
  return (
    <>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="end"
        marginTop="8px"
        spacing="8px"
        sx={{
          zIndex: (theme) =>
            state !== GuideState.NONE && backdropOpen
              ? theme.zIndex.drawer + 2
              : undefined,
        }}
      >
        {(!tournamentSet || !copyDirSet) && (
          <>
            <Alert severity="error">Guided mode not ready</Alert>
            <Button
              onClick={() => {
                setOpen(true);
              }}
              variant="contained"
            >
              Set up
            </Button>
          </>
        )}
        {tournamentSet && copyDirSet && state === GuideState.NONE && (
          <Alert severity="success">
            Guided mode ready, insert USB drive...
          </Alert>
        )}
        {tournamentSet && copyDirSet && state !== GuideState.NONE && (
          <>
            <Alert severity="warning">
              {state === GuideState.SET && 'Select set'}
              {state === GuideState.REPLAYS &&
                'Select Replays (deselect handwarmers)'}
              {state === GuideState.PLAYERS && 'Assign players and report'}
            </Alert>
            {state === GuideState.REPLAYS && (
              <Button
                onClick={() => {
                  setState(GuideState.PLAYERS);
                }}
                variant="contained"
              >
                Done!
              </Button>
            )}
            <Button
              disabled={backdropOpen}
              onClick={() => {
                openBackdrop();
              }}
              variant="contained"
            >
              Highlight Step
            </Button>
          </>
        )}
      </Stack>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        {!tournamentSet && mode === Mode.STARTGG && (
          <StartggTournamentForm
            gettingAdminedTournaments={gettingAdminedTournaments}
            adminedTournaments={adminedTournaments}
            gettingTournament={gettingTournament}
            getTournament={getStartggTournament}
            setSlug={setStartggTournamentSlug}
            close={() => {
              if (copyDir) {
                setOpen(false);
              }
            }}
          />
        )}
        {!tournamentSet && mode === Mode.CHALLONGE && (
          <ChallongeTournamentForm
            gettingAdminedTournaments={gettingAdminedTournaments}
            adminedTournaments={adminedTournaments}
            gettingTournament={gettingTournament}
            getTournament={getChallongeTournament}
            close={() => {
              if (copyDir) {
                setOpen(false);
              }
            }}
          />
        )}
        {!tournamentSet && mode === Mode.MANUAL && (
          <ManualNamesForm
            close={() => {
              if (copyDir) {
                setOpen(false);
              }
            }}
            manualNames={manualNames}
            setManualNames={setManualNames}
          />
        )}
        {tournamentSet && !copyDirSet && (
          <>
            <DialogTitle>Set copy folder</DialogTitle>
            <DialogContent>
              <Stack direction="row" justifyContent="end">
                <Button
                  endIcon={<FolderOpen />}
                  onClick={async () => {
                    const newCopyDir = await window.electron.chooseCopyDir();
                    if (newCopyDir) {
                      setCopyDir(newCopyDir);
                      setOpen(false);
                    }
                  }}
                  variant="contained"
                >
                  Set
                </Button>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
