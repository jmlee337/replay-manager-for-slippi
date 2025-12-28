import { BrowserWindow } from 'electron';
import WebSocket from 'ws';
import {
  OfflineModeParticipant,
  OfflineModeSet,
  OfflineModeTournament,
  Participant,
  RendererOfflineModePhase,
  RendererOfflineModePool,
  RendererOfflineModeTournament,
  SelectedSetChain,
  Set,
  State,
} from '../common/types';

const INITIAL_TOURNAMENT: RendererOfflineModeTournament = {
  id: 0,
  name: '',
  slug: '',
  location: '',
  events: [],
  participants: [],
  stations: [],
  streams: [],
};

let address = '';
let error = '';
const idToSet = new Map<number, Set>();
let selectedSetId = 0;
let tournament = INITIAL_TOURNAMENT;
let mainWindow: BrowserWindow | undefined;
export function initOfflineMode(initMainWindow: BrowserWindow) {
  mainWindow = initMainWindow;
  address = '';
  error = '';
  idToSet.clear();
  selectedSetId = 0;
  tournament = INITIAL_TOURNAMENT;
}

function setStatus(newAddress: string, newError?: string) {
  address = newAddress;
  if (newError) {
    error = newError;
  }
  mainWindow?.webContents.send('offlineModeStatus', { address, error });
}

function setTournament(newTournament: RendererOfflineModeTournament) {
  tournament = newTournament;
  mainWindow?.webContents.send('tournament', {
    offlineModeTournament: tournament,
  });
}

export function getOfflineModeStatus() {
  return { address, error };
}

export function getCurrentOfflineModeTournament() {
  return tournament;
}

export function setSelectedOfflineModeSetId(id: number) {
  selectedSetId = id;
}

export function getSelectedOfflineModeSet() {
  return idToSet.get(selectedSetId);
}

export function getSelectedOfflineModeSetChain(
  selectedEventId: number,
  selectedPhaseId: number,
  selectedPhaseGroupId: number,
): SelectedSetChain {
  let selectedPool: RendererOfflineModePool | undefined;
  let selectedPhase: RendererOfflineModePhase | undefined;
  const selectedEvent = tournament.events.find(
    (event) => event.id === selectedEventId,
  );
  if (selectedEvent) {
    selectedPhase = selectedEvent.phases.find(
      (phase) => phase.id === selectedPhaseId,
    );
    if (selectedPhase) {
      selectedPool = selectedPhase.pools.find(
        (pool) => pool.id === selectedPhaseGroupId,
      );
    }
  }

  return {
    event: selectedEvent
      ? {
          id: selectedEvent.id,
          name: selectedEvent.name,
          slug: selectedEvent.slug,
          hasSiblings: tournament.events.length > 1,
        }
      : undefined,
    phase: selectedPhase
      ? {
          id: selectedPhase.id,
          name: selectedPhase.name,
          hasSiblings: selectedEvent!.phases.length > 1,
        }
      : undefined,
    phaseGroup: selectedPool
      ? {
          id: selectedPool.id,
          name: selectedPool.name,
          bracketType: selectedPool.bracketType,
          hasSiblings: selectedPhase!.pools.length > 1,
          waveId: selectedPool.waveId,
          winnersTargetPhaseId: selectedPool.winnersTargetPhaseId,
        }
      : undefined,
  };
}

function toParticipant(participant: OfflineModeParticipant): Participant {
  return {
    id: participant.id,
    displayName: participant.gamerTag,
    prefix: participant.prefix,
    pronouns: participant.pronouns,
  };
}

// TODO: set these on report
const reportedSetIds = new Map<number, boolean>();
function toSet(set: OfflineModeSet): Omit<Set, 'id'> & { id: number } {
  if (set.entrant1Id === null) {
    throw new Error(`entrant1Id null in set: ${set.id}`);
  }
  if (set.entrant2Id === null) {
    throw new Error(`entrant2Id null in set: ${set.id}`);
  }
  return {
    id: set.id,
    state: set.state,
    round: set.round,
    fullRoundText: set.fullRoundText,
    winnerId: set.winnerId,
    entrant1Id: set.entrant1Id,
    entrant1Participants: set.entrant1Participants.map(toParticipant),
    entrant1Score: set.entrant1Score,
    entrant2Id: set.entrant2Id,
    entrant2Participants: set.entrant2Participants.map(toParticipant),
    entrant2Score: set.entrant2Score,
    gameScores: [], // TODO
    stream: set.stream
      ? {
          id: set.stream.id,
          domain: set.stream.streamSource.toLowerCase(),
          path: set.stream.streamName,
        }
      : null,
    station: set.station
      ? {
          id: set.station.id,
          number: set.station.number,
        }
      : null,
    ordinal: set.ordinal,
    wasReported: reportedSetIds.has(set.id),
    updatedAtMs: set.updatedAt * 1000,
    completedAtMs: set.completedAt ? set.completedAt * 1000 : 0,
  };
}

let websocket: WebSocket | null = null;
function cleanup() {
  websocket?.removeAllListeners();
  websocket = null;

  setTournament(INITIAL_TOURNAMENT);
  setStatus('', '');
  idToSet.clear();
  selectedSetId = 0;
}
export function connectToOfflineMode(port: number) {
  if (websocket) {
    return;
  }

  const tryAddress = `ws://127.0.01:${port}`;
  websocket = new WebSocket(tryAddress, 'bracket-protocol')
    .on('open', () => {
      setStatus(tryAddress, '');
    })
    .on('error', (err) => {
      cleanup();
      setStatus('', err.message);
    })
    .on('close', () => {
      cleanup();
      setStatus('');
    })
    .on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.op === 'tournament-update-event') {
          idToSet.clear();
          const newTournament = message.tournament as OfflineModeTournament;
          setTournament({
            ...newTournament,
            events: newTournament.events.map((event) => ({
              ...event,
              phases: event.phases.map((phase) => ({
                ...phase,
                pools: phase.pools.map((pool) => {
                  const completedSets: Set[] = [];
                  const pendingSets: Set[] = [];
                  pool.sets.forEach((offlineModeSet) => {
                    if (
                      offlineModeSet.entrant1Id &&
                      offlineModeSet.entrant2Id
                    ) {
                      const set = toSet(offlineModeSet);
                      idToSet.set(set.id, set);
                      if (set.state === State.COMPLETED) {
                        completedSets.push(set);
                      } else {
                        pendingSets.push(set);
                      }
                    }
                  });
                  return {
                    ...pool,
                    sets: { completedSets, pendingSets },
                  };
                }),
              })),
            })),
          });
        }
      } catch {
        // just catch
      }
    });
}
