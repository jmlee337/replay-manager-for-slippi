import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { FolderOpen } from '@mui/icons-material';
import { AdminedTournament, GuideState, Mode } from '../common/types';
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
  tournamentSet,
  copyDirSet,
  tournamentStarted,
  setStartggTournamentSlug,
  getStartggTournament,
  getChallongeTournament,
  manualNames,
  setManualNames,
  copyDir,
  setCopyDir,
  confirmedCopySettings,
  setConfirmedCopySettings,
  state,
  setState,
  backdropOpen,
  setBackdropOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  mode: Mode;
  gettingAdminedTournaments: boolean;
  adminedTournaments: AdminedTournament[];
  gettingTournament: boolean;
  tournamentSet: boolean;
  copyDirSet: boolean;
  tournamentStarted: boolean;
  setStartggTournamentSlug: (startggTournamentSlug: string) => void;
  getStartggTournament: (
    maybeSlug: string,
    initial?: boolean,
  ) => Promise<boolean>;
  getChallongeTournament: (maybeSlug: string) => Promise<void>;
  manualNames: string[];
  setManualNames: (manualNames: string[]) => Promise<void>;
  copyDir: string;
  setCopyDir: (copyDir: string) => void;
  confirmedCopySettings: boolean;
  setConfirmedCopySettings: (confirmedCopySettings: boolean) => void;
  state: GuideState;
  setState: (state: GuideState) => void;
  backdropOpen: boolean;
  setBackdropOpen: (backdropOpen: boolean) => void;
}) {
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
            backdropOpen ? theme.zIndex.drawer + 2 : undefined,
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
        {tournamentSet && copyDirSet && !confirmedCopySettings && (
          <>
            <Alert severity="warning">Confirm copy settings</Alert>
            <Button
              onClick={() => {
                setConfirmedCopySettings(true);
                setBackdropOpen(
                  !tournamentStarted || state !== GuideState.NONE,
                );
              }}
              variant="contained"
            >
              Done!
            </Button>
            <Button
              disabled={backdropOpen}
              onClick={() => {
                setBackdropOpen(true);
              }}
              variant="contained"
            >
              Highlight Step
            </Button>
          </>
        )}
        {tournamentSet &&
          copyDirSet &&
          confirmedCopySettings &&
          !tournamentStarted && (
            <>
              <Alert severity="warning">
                {mode === Mode.STARTGG ? (
                  <>
                    Start event (refresh event
                    <br />
                    if you start on website)
                  </>
                ) : (
                  'Start tournament (then refresh)'
                )}
              </Alert>
              <Button
                disabled={backdropOpen}
                onClick={() => {
                  setBackdropOpen(true);
                }}
                variant="contained"
              >
                Highlight Step
              </Button>
            </>
          )}
        {tournamentSet &&
          copyDirSet &&
          confirmedCopySettings &&
          tournamentStarted &&
          state === GuideState.NONE && (
            <Alert severity="success">
              Guided mode ready, insert USB drive...
            </Alert>
          )}
        {tournamentSet &&
          copyDirSet &&
          confirmedCopySettings &&
          state !== GuideState.NONE && (
            <>
              <Alert severity="warning">
                {state === GuideState.SET && 'Select set'}
                {state === GuideState.REPLAYS && (
                  <>
                    Select replays
                    <br />
                    (deselect handwarmers)
                  </>
                )}
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
                  setBackdropOpen(true);
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
          setBackdropOpen(true);
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
                setBackdropOpen(true);
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
                setBackdropOpen(true);
              }
            }}
          />
        )}
        {!tournamentSet && mode === Mode.MANUAL && (
          <ManualNamesForm
            close={() => {
              if (copyDir) {
                setOpen(false);
                setBackdropOpen(true);
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
                      setBackdropOpen(true);
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
