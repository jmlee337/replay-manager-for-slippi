import {
  Alert,
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DeleteForever,
  ErrorOutline,
  Memory,
  NotificationsActive,
  NotificationsNone,
  Refresh,
  Warning,
} from '@mui/icons-material';
import { useEffect, useRef, useState } from 'react';
import {
  BeamerGame,
  BeamerFleet,
  BeamerPort,
  Beamer,
  LabeledBeamer,
} from '../common/types';
import {
  beamerDeadColor,
  beamerHealthColor,
  characterNames,
  unknownCharacterId,
} from '../common/constants';
import getCharacterIcon from './getCharacterIcon';

type BeamerBusy = {
  kind: 'copy' | 'refresh' | 'subscribe' | 'reset';
  target: string; // 'all' or a beamer id
};

function warningsFor(beamer: Beamer) {
  return beamer.warnings.join(', ');
}

function formatSecs(secs: number | undefined) {
  if (secs == null) {
    return '-';
  }
  if (secs < 60) {
    return `${secs}s`;
  }
  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    return `${mins}m ${`${secs % 60}`.padStart(2, '0')}s`;
  }
  return `${Math.floor(mins / 60)}h ${`${mins % 60}`.padStart(2, '0')}m`;
}

function formatReplays(beamer: Beamer) {
  if (beamer.replayCount == null) {
    return '-';
  }
  return beamer.replayCap != null
    ? `${beamer.replayCount} / ${beamer.replayCap}`
    : `${beamer.replayCount}`;
}

function BeamersTooltip({
  showWarnings,
  beamers,
}: {
  showWarnings: boolean;
  beamers: LabeledBeamer[];
}) {
  return (
    <Stack gap="2px">
      {beamers.map((beamer) => {
        const warnings = showWarnings ? warningsFor(beamer) : '';
        return (
          <Typography key={beamer.beamerId} variant="caption">
            {warnings ? `${beamer.label} - ${warnings}` : beamer.label}
          </Typography>
        );
      })}
    </Stack>
  );
}

function liveLightColor(beamer: Beamer) {
  if (beamer.game?.live) {
    return beamerHealthColor[beamer.health];
  }
  return beamerDeadColor[beamer.health] ?? beamerHealthColor[beamer.health];
}

function LiveLight({ beamer }: { beamer: Beamer }) {
  const dot = (
    <span
      style={{
        backgroundColor: liveLightColor(beamer),
        borderRadius: '50%',
        display: 'inline-block',
        height: '10px',
        width: '10px',
      }}
    />
  );
  let title = warningsFor(beamer);
  if (!title && beamer.health === 'error') {
    title = 'ERROR';
  }
  return title ? (
    <Tooltip arrow title={title}>
      {dot}
    </Tooltip>
  ) : (
    dot
  );
}

function PortCell({
  game,
  port,
}: {
  game: BeamerGame | null;
  port: BeamerPort | undefined;
}) {
  if (!port) {
    return <TableCell />;
  }
  const charName =
    (port.charId !== null && characterNames.get(port.charId)) || port.char;
  return (
    <TableCell>
      <Stack alignItems="center" direction="row" gap="4px">
        <Tooltip arrow title={charName}>
          <Avatar
            alt={charName}
            src={getCharacterIcon(
              port.charId ?? unknownCharacterId,
              port.costume,
            )}
            style={{ height: '24px', width: '24px' }}
            variant="square"
          />
        </Tooltip>
        <Typography
          color={game?.live ? 'text.primary' : 'text.secondary'}
          variant="body2"
        >
          {port.nametag || `P${port.port}`}
        </Typography>
      </Stack>
    </TableCell>
  );
}

function LiveSecsText({ reported }: { reported: number | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  const baseline = useRef<{ secs: number; at: number } | undefined>(undefined);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  let secs: number | undefined;
  if (reported == null) {
    baseline.current = undefined;
  } else {
    const previous = baseline.current;
    if (!previous || previous.secs !== reported) {
      baseline.current = { secs: reported, at: Date.now() };
      secs = reported;
    } else {
      secs = previous.secs + Math.floor((now - previous.at) / 1000);
    }
  }

  return (
    <Typography
      color="text.secondary"
      style={{ whiteSpace: 'nowrap' }}
      variant="body2"
    >
      {formatSecs(secs)}
    </Typography>
  );
}

function ResetConfirmDialog({
  confirmingReset,
  beamers,
  resetting,
  onClose,
  onConfirm,
}: {
  confirmingReset: LabeledBeamer | 'all' | null;
  beamers: LabeledBeamer[];
  resetting: boolean;
  onClose: () => void;
  onConfirm: (target: LabeledBeamer | 'all') => void;
}) {
  let eraseWarning =
    "Every replay on this beamer's drive will be erased. This cannot be undone.";
  if (
    confirmingReset &&
    confirmingReset !== 'all' &&
    confirmingReset.replayCount != null
  ) {
    eraseWarning = `All ${confirmingReset.replayCount} replays on this beamer's drive will be erased. This cannot be undone.`;
  }
  return (
    <Dialog
      open={Boolean(confirmingReset)}
      onClose={() => {
        if (!resetting) {
          onClose();
        }
      }}
    >
      <DialogTitle>
        {confirmingReset === 'all'
          ? `Erase all ${beamers.length} beamers?`
          : `Erase ${confirmingReset ? confirmingReset.label : 'beamer'}?`}
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning">
          {confirmingReset === 'all'
            ? `Every replay on all ${beamers.length} of these drives will be erased. This cannot be undone.`
            : eraseWarning}
        </Alert>
        {confirmingReset === 'all' && (
          <DialogContentText marginTop="8px" variant="body2">
            {beamers.map((beamer) => beamer.label).join(', ')}
          </DialogContentText>
        )}
        <DialogContentText marginTop="8px" variant="body2">
          If a game is being played right now, let it finish first.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={resetting} onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="error"
          disabled={resetting}
          endIcon={
            resetting ? <CircularProgress size="24px" /> : <DeleteForever />
          }
          onClick={() => {
            if (confirmingReset) {
              onConfirm(confirmingReset);
            }
          }}
          variant="contained"
        >
          {confirmingReset === 'all' ? 'Erase all' : 'Erase'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BeamerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [fleet, setFleet] = useState<BeamerFleet>({
    beamers: [],
    browsing: false,
    error: '',
    ghostBeamerErrors: [],
  });
  const [busyWith, setBusyWith] = useState<BeamerBusy | null>(null);
  const [confirmingReset, setConfirmingReset] = useState<
    LabeledBeamer | 'all' | null
  >(null);
  const [error, setError] = useState('');
  const [maxGamesFromIndex, setMaxGamesFromIndex] = useState('');

  useEffect(() => {
    window.electron.onBeamerFleet((_event, newFleet) => {
      setFleet(newFleet);
    });
    (async () => {
      setMaxGamesFromIndex(`${await window.electron.getMaxGamesFromIndex()}`);
    })();
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setError('');
    window.electron.startBeamerBrowse();
    return () => {
      window.electron.stopBeamerBrowse();
    };
  }, [open]);

  const runBusy = async (busy: BeamerBusy, action: () => Promise<unknown>) => {
    setBusyWith(busy);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyWith(null);
    }
  };

  const select = (beamerId: string) =>
    runBusy({ kind: 'copy', target: beamerId }, async () => {
      await window.electron.selectBeamer(
        beamerId,
        parseInt(maxGamesFromIndex, 10),
      );
      onClose();
    });

  const refresh = (beamerId: string) =>
    runBusy({ kind: 'refresh', target: beamerId }, () =>
      window.electron.refreshBeamerStatus(beamerId),
    );

  const toggleSubscribe = (beamer: LabeledBeamer) =>
    runBusy({ kind: 'subscribe', target: beamer.beamerId }, () =>
      window.electron.setBeamerSubscribed(beamer.beamerId, !beamer.subscribed),
    );

  const refreshAll = () =>
    runBusy({ kind: 'refresh', target: 'all' }, () =>
      window.electron.refreshAllBeamers(),
    );

  const reset = async (beamer: Beamer) => {
    await runBusy({ kind: 'reset', target: beamer.beamerId }, () =>
      window.electron.resetBeamer(beamer.beamerId),
    );
    setConfirmingReset(null);
  };

  const resetAll = async () => {
    await runBusy({ kind: 'reset', target: 'all' }, async () => {
      const failures = await window.electron.resetAllBeamers();
      if (failures.length > 0) {
        setError(
          `Erased the rest, but not these:\n${failures
            .map((failure) => `${failure.label}: ${failure.reason}`)
            .join('\n')}`,
        );
      }
    });
    setConfirmingReset(null);
  };

  const busyKind = (kind: BeamerBusy['kind']) => busyWith?.kind === kind;
  const busyTarget = (kind: BeamerBusy['kind'], target: string) =>
    busyWith?.kind === kind && busyWith.target === target;
  const erroringBeamers = fleet.beamers.filter(
    (beamer) => beamer.health === 'error',
  );
  const warningBeamers = fleet.beamers.filter(
    (beamer) => beamer.health === 'warn',
  );
  const firmwareVersions = new Set(
    fleet.beamers.map((beamer) => beamer.firmwareVersion ?? 'not reported'),
  );
  const firmwareMismatch = firmwareVersions.size > 1;

  return (
    <>
      <Dialog
        fullWidth
        maxWidth="md"
        open={open}
        onClose={() => {
          if (!busyWith) {
            onClose();
          }
        }}
      >
        <DialogTitle>
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
          >
            <Stack alignItems="center" direction="row" gap="8px">
              Beamers
              <Stack alignItems="baseline" direction="row" gap="4px">
                <TextField
                  inputProps={{
                    min: 1,
                    style: { textAlign: 'right' },
                  }}
                  onChange={(event) => {
                    setMaxGamesFromIndex(event.target.value);
                  }}
                  size="small"
                  style={{ width: '40px' }}
                  type="number"
                  value={maxGamesFromIndex}
                  variant="standard"
                />
                <Typography variant="body2">games downloaded</Typography>
              </Stack>
              {erroringBeamers.length > 0 && (
                <Tooltip
                  arrow
                  title={
                    <BeamersTooltip
                      showWarnings={false}
                      beamers={erroringBeamers}
                    />
                  }
                >
                  <Chip
                    color="error"
                    icon={<ErrorOutline />}
                    label={`${erroringBeamers.length} error${
                      erroringBeamers.length === 1 ? '' : 's'
                    }`}
                    size="small"
                  />
                </Tooltip>
              )}
              {warningBeamers.length > 0 && (
                <Tooltip
                  arrow
                  title={
                    <BeamersTooltip showWarnings beamers={warningBeamers} />
                  }
                >
                  <Chip
                    color="warning"
                    icon={<Warning />}
                    label={`${warningBeamers.length} warning${
                      warningBeamers.length === 1 ? '' : 's'
                    }`}
                    size="small"
                  />
                </Tooltip>
              )}
              {firmwareMismatch && (
                <Tooltip
                  arrow
                  title={`Firmware versions in use: ${[...firmwareVersions]
                    .sort()
                    .join(', ')}`}
                >
                  <Chip
                    color="warning"
                    icon={<Memory />}
                    label="Firmware mismatch"
                    size="small"
                  />
                </Tooltip>
              )}
            </Stack>
            {fleet.beamers.length > 0 && (
              <Stack alignItems="center" direction="row" gap="4px">
                <Tooltip
                  arrow
                  title="Re-run the status check on every beamer listed here"
                >
                  <span>
                    <IconButton
                      disabled={
                        busyKind('copy') ||
                        busyKind('refresh') ||
                        busyKind('reset')
                      }
                      onClick={refreshAll}
                      size="small"
                    >
                      {busyTarget('refresh', 'all') ? (
                        <CircularProgress size="20px" />
                      ) : (
                        <Refresh />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  arrow
                  title="Erase the replays on every beamer listed here"
                >
                  <span>
                    <Button
                      color="error"
                      disabled={busyKind('copy') || busyKind('reset')}
                      onClick={() => setConfirmingReset('all')}
                      size="small"
                      startIcon={<DeleteForever />}
                    >
                      Erase all
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {fleet.beamers.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Beamer</TableCell>
                  <TableCell>Live</TableCell>
                  <TableCell>Replays</TableCell>
                  <TableCell>P1</TableCell>
                  <TableCell>P2</TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    Ports changed
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    Game started
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {fleet.beamers.map((beamer) => {
                  const ports = [...(beamer.game?.ports ?? [])].sort(
                    (a, b) => a.port - b.port,
                  );
                  let subscribeIcon = (
                    <NotificationsNone color="action" fontSize="small" />
                  );
                  if (busyTarget('subscribe', beamer.beamerId)) {
                    subscribeIcon = <CircularProgress size="20px" />;
                  } else if (beamer.subscribed) {
                    subscribeIcon = (
                      <NotificationsActive color="action" fontSize="small" />
                    );
                  }
                  const beamerTitle = `${beamer.label} - ${beamer.beamerId} - ${
                    beamer.firmwareVersion ?? 'unknown firmware'
                  }`;
                  return (
                    <TableRow
                      hover
                      key={beamer.beamerId}
                      onClick={() => {
                        if (!busyKind('copy')) {
                          select(beamer.beamerId);
                        }
                      }}
                      style={{
                        cursor: busyKind('copy') ? 'default' : 'pointer',
                      }}
                    >
                      <TableCell padding="checkbox">
                        <span>
                          <IconButton
                            disabled={
                              busyKind('copy') ||
                              busyTarget('subscribe', beamer.beamerId)
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSubscribe(beamer);
                            }}
                            size="small"
                          >
                            {subscribeIcon}
                          </IconButton>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Stack alignItems="center" direction="row" gap="8px">
                          <Tooltip arrow title={beamerTitle}>
                            <Typography
                              noWrap
                              variant="body2"
                              sx={{ maxWidth: 220 }}
                            >
                              {beamer.label}
                            </Typography>
                          </Tooltip>
                          {busyTarget('copy', beamer.beamerId) && (
                            <CircularProgress size="16px" />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <LiveLight beamer={beamer} />
                      </TableCell>
                      <TableCell>
                        <Typography
                          color="text.secondary"
                          style={{ whiteSpace: 'nowrap' }}
                          variant="body2"
                        >
                          {formatReplays(beamer)}
                        </Typography>
                      </TableCell>
                      <PortCell game={beamer.game} port={ports[0]} />
                      <PortCell game={beamer.game} port={ports[1]} />
                      <TableCell>
                        <LiveSecsText reported={beamer.secsSincePortChange} />
                      </TableCell>
                      <TableCell>
                        <LiveSecsText reported={beamer.secsSinceGameStart} />
                      </TableCell>
                      <TableCell padding="none">
                        <Tooltip
                          arrow
                          title="Re-run this beamer's status check"
                        >
                          <span>
                            <IconButton
                              disabled={
                                busyKind('copy') ||
                                busyKind('refresh') ||
                                busyKind('reset')
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                refresh(beamer.beamerId);
                              }}
                            >
                              {busyTarget('refresh', beamer.beamerId) ? (
                                <CircularProgress size="24px" />
                              ) : (
                                <Refresh />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell padding="none">
                        <Tooltip arrow title="Erase this beamer's replays">
                          <span>
                            <IconButton
                              disabled={busyKind('copy') || busyKind('reset')}
                              onClick={(event) => {
                                event.stopPropagation();
                                setConfirmingReset(beamer);
                              }}
                            >
                              {busyTarget('reset', beamer.beamerId) ? (
                                <CircularProgress size="24px" />
                              ) : (
                                <DeleteForever color="error" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Alert severity="info" style={{ marginTop: '8px' }}>
              {fleet.browsing
                ? 'Listening for Beamers. A beamer appears here within a second or two of joining the network.'
                : 'Not listening yet.'}
            </Alert>
          )}
          {fleet.error && (
            <Alert severity="warning" style={{ marginTop: '8px' }}>
              {`Could not listen for Beamers: ${fleet.error}`}
            </Alert>
          )}
          {fleet.ghostBeamerErrors.map((ghostError) => (
            <Alert
              key={ghostError}
              severity="error"
              style={{ marginTop: '8px' }}
            >
              {ghostError}
            </Alert>
          ))}
          {error && (
            <Alert
              severity="error"
              style={{ marginTop: '8px', whiteSpace: 'pre-line' }}
            >
              {error}
            </Alert>
          )}
        </DialogContent>
      </Dialog>
      <ResetConfirmDialog
        beamers={fleet.beamers}
        confirmingReset={confirmingReset}
        onClose={() => setConfirmingReset(null)}
        onConfirm={(target) => {
          if (target === 'all') {
            resetAll();
          } else {
            reset(target);
          }
        }}
        resetting={busyKind('reset')}
      />
    </>
  );
}
