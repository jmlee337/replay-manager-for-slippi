import { Alert, Button, Dialog, DialogContent, Stack } from '@mui/material';
import { FolderOpen } from '@mui/icons-material';
import { ChallongeTournament, Mode } from '../common/types';
import ManualNamesForm from './ManualNamesForm';

export default function GuidedDialog({
  open,
  setOpen,
  mode,
  startggTournamentSlug,
  setStartggTournamentSlug,
  challongeTournaments,
  setChallongeTournaments,
  manualNames,
  setManualNames,
  copyDir,
  setCopyDir,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  mode: Mode;
  startggTournamentSlug: string;
  setStartggTournamentSlug: (startggTournamentSlug: string) => void;
  challongeTournaments: Map<string, ChallongeTournament>;
  setChallongeTournaments: (
    challongeTournaments: Map<string, ChallongeTournament>,
  ) => void;
  manualNames: string[];
  setManualNames: (manualNames: string[]) => void;
  copyDir: string;
  setCopyDir: (copyDir: string) => void;
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
      >
        {(!tournamentSet || !copyDirSet) && (
          <>
            <Alert severity="warning">Guided mode not ready</Alert>
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
        {tournamentSet && copyDirSet && (
          <Alert severity="success">
            Guide mode ready, insert USB drive...
          </Alert>
        )}
      </Stack>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        {!tournamentSet && mode === Mode.MANUAL ? (
          <ManualNamesForm
            close={() => {
              if (copyDir) {
                setOpen(false);
              }
            }}
            manualNames={manualNames}
            setManualNames={setManualNames}
          />
        ) : (
          <DialogContent>
            {!tournamentSet && mode === Mode.STARTGG && <>start.gg</>}
            {!tournamentSet && mode === Mode.CHALLONGE && <>challonge</>}
            {tournamentSet && !copyDirSet && (
              <Button
                endIcon={<FolderOpen />}
                onClick={async () => {
                  const newCopyDir = await window.electron.chooseCopyDir();
                  if (newCopyDir) {
                    setCopyDir(newCopyDir);
                  }
                }}
                variant="contained"
              >
                Set copy folder
              </Button>
            )}
            {tournamentSet && copyDirSet && <>ready</>}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
