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
  StartggGame,
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
    gameScores: set.games.map((game) => ({
      entrant1Score: game.entrant1Score,
      entrant2Score: game.entrant2Score,
    })),
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

let nextNum = 1;
let websocket: WebSocket | null = null;
function cleanup() {
  websocket?.removeAllListeners();
  websocket = null;

  nextNum = 1;
  setTournament(INITIAL_TOURNAMENT);
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
          if (message.tournament) {
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
              streams: newTournament.streams.map((stream) => ({
                id: stream.id,
                domain: stream.streamSource.toLowerCase(),
                path: stream.streamName,
              })),
            });
          } else {
            setTournament(INITIAL_TOURNAMENT);
          }
        }
      } catch {
        // just catch
      }
    });
}

type Request = {
  num: number;
  id: number;
} & (
  | {
      op: 'reset-set-request' | 'call-set-request' | 'start-set-request';
    }
  | {
      op: 'assign-set-station-request';
      stationId: number;
    }
  | {
      op: 'assign-set-stream-request';
      streamId: number;
    }
  | {
      op: 'report-set-request';
      winnerId: number;
      isDQ: boolean;
      gameData: StartggGame[];
    }
);

type ResponseOp =
  | 'reset-set-response'
  | 'call-set-response'
  | 'start-set-response'
  | 'assign-set-station-response'
  | 'assign-set-stream-response'
  | 'report-set-response';

type Response = {
  num: number;
  op: ResponseOp;
  err?: string;
  data?: {
    set: OfflineModeSet;
  };
};

function getExpectedResponseOp(request: Request): ResponseOp {
  switch (request.op) {
    case 'reset-set-request':
      return 'reset-set-response';
    case 'call-set-request':
      return 'call-set-response';
    case 'start-set-request':
      return 'start-set-response';
    case 'assign-set-station-request':
      return 'assign-set-station-response';
    case 'assign-set-stream-request':
      return 'assign-set-stream-response';
    case 'report-set-request':
      return 'report-set-response';
    default:
      throw new Error('unreachable');
  }
}

async function sendRequest(request: Request) {
  const expectedOp = getExpectedResponseOp(request);
  return new Promise<OfflineModeSet>((resolve, reject) => {
    if (websocket === null) {
      reject(new Error('offline mode not connected'));
      return;
    }

    const listener = (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString()) as Response;
        if (message.num === request.num && message.op === expectedOp) {
          websocket?.removeListener('message', listener);
          if (message.err) {
            reject(new Error(message.err));
          } else if (!message.data) {
            reject(new Error('no data'));
          } else {
            resolve(message.data.set);
          }
        }
      } catch {
        // just catch
      }
    };
    websocket.addListener('message', listener);
    websocket.send(JSON.stringify(request));
  });
}

export async function resetOfflineModeSet(id: number): Promise<Set> {
  const num = nextNum;
  nextNum += 1;

  const resetSetRequest: Request = {
    num,
    op: 'reset-set-request',
    id,
  };
  const updatedSet = await sendRequest(resetSetRequest);
  return toSet(updatedSet);
}

export async function callOfflineModeSet(id: number): Promise<Set> {
  const num = nextNum;
  nextNum += 1;

  const callSetRequest: Request = {
    num,
    op: 'call-set-request',
    id,
  };
  const updatedSet = await sendRequest(callSetRequest);
  return toSet(updatedSet);
}

export async function startOfflineModeSet(id: number): Promise<Set> {
  const num = nextNum;
  nextNum += 1;

  const startSetRequest: Request = {
    num,
    op: 'start-set-request',
    id,
  };
  const updatedSet = await sendRequest(startSetRequest);
  return toSet(updatedSet);
}

export async function assignOfflineModeSetStation(
  id: number,
  stationId: number,
): Promise<Set> {
  const num = nextNum;
  nextNum += 1;

  const assignSetStationRequest: Request = {
    num,
    op: 'assign-set-station-request',
    id,
    stationId,
  };
  const updatedSet = await sendRequest(assignSetStationRequest);
  return toSet(updatedSet);
}

export async function assignOfflineModeSetStream(
  id: number,
  streamId: number,
): Promise<Set> {
  const num = nextNum;
  nextNum += 1;

  const assignSetStreamRequest: Request = {
    num,
    op: 'assign-set-stream-request',
    id,
    streamId,
  };
  const updatedSet = await sendRequest(assignSetStreamRequest);
  return toSet(updatedSet);
}

export async function reportOfflineModeSet(
  id: number,
  winnerId: number,
  isDQ: boolean,
  gameData: StartggGame[],
): Promise<Set> {
  const num = nextNum;
  nextNum += 1;

  const reportSetRequest: Request = {
    num,
    op: 'report-set-request',
    id,
    winnerId,
    isDQ,
    gameData,
  };
  const updatedSet = await sendRequest(reportSetRequest);
  reportedSetIds.set(updatedSet.id, true);
  return toSet(updatedSet);
}
