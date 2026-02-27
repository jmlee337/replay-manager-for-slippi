import { BrowserWindow } from 'electron';
import WebSocket from 'ws';
import { createHash } from 'crypto';
import { createSocket, RemoteInfo, Socket } from 'dgram';
import {
  Family,
  OfflineModeParticipant,
  OfflineModeSeed,
  OfflineModeSet,
  OfflineModeStatus,
  OfflineModeTournament,
  Participant,
  RendererOfflineModePhase,
  RendererOfflineModePool,
  RendererOfflineModeTournament,
  RendererPool,
  RendererWave,
  SelectedSetChain,
  Set,
  StartggGame,
  State,
} from '../common/types';
import { getComputerName } from './util';

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
let family: Family = 'IPv4';
let port = 0;
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
export function setSelectedOfflineModeSetId(id: number) {
  selectedSetId = id;
}

export function getSelectedOfflineModeSet() {
  return idToSet.get(selectedSetId);
}

function setStatus(
  newAddress: string,
  newFamily: Family,
  newPort: number,
  newError?: string,
) {
  address = newAddress;
  family = newFamily;
  port = newPort;
  if (newError !== undefined) {
    error = newError;
  }
  const offlineModeStatus: OfflineModeStatus = {
    address,
    family,
    port,
    error,
  };
  mainWindow?.webContents.send('offlineModeStatus', offlineModeStatus);
}

function setTournament(newTournament: RendererOfflineModeTournament) {
  tournament = newTournament;
  mainWindow?.webContents.send('tournament', {
    selectedSet: getSelectedOfflineModeSet(),
    offlineModeTournament: tournament,
  });
}

export function getOfflineModeStatus(): OfflineModeStatus {
  return { address, family, port, error };
}

export function getCurrentOfflineModeTournament() {
  return tournament;
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

export function getOfflineModePoolsByWave(): RendererWave[] {
  const poolIdToSeeds = new Map<number, OfflineModeSeed[]>();
  const waveIdToPools = new Map<number, RendererPool[]>();
  const noWavePools: (RendererPool & {
    eventId: number;
    phaseId: number;
    winnersTargetPhaseId: number | null;
  })[] = [];
  tournament.events.forEach((event) => {
    event.phases.forEach((phase) => {
      const parentName = event.phases.length > 1 ? phase.name : event.name;
      phase.seeds.forEach((seed) => {
        let seeds = poolIdToSeeds.get(seed.poolId);
        if (!seeds) {
          seeds = [];
          poolIdToSeeds.set(seed.poolId, seeds);
        }
        seeds.push(seed);
      });
      phase.pools.forEach((pool) => {
        const rendererPool: RendererPool = {
          id: pool.id,
          name: pool.name,
          seeds: (poolIdToSeeds.get(pool.id) ?? []).map((seed) => ({
            id: seed.id,
            seedNum: seed.seedNum,
            groupSeedNum: seed.groupSeedNum,
            placeholder: seed.placeholder,
            entrant: seed.entrant
              ? {
                  id: seed.entrant.id,
                  participants: seed.entrant.participants.map(toParticipant),
                }
              : null,
          })),
        };
        if (pool.waveId) {
          let pools = waveIdToPools.get(pool.waveId);
          if (!pools) {
            pools = [];
            waveIdToPools.set(pool.waveId, pools);
          }
          pools.push(rendererPool);
        } else {
          noWavePools.push({
            ...rendererPool,
            name:
              phase.pools.length > 1
                ? `${parentName}, ${pool.name}`
                : parentName,
            eventId: event.id,
            phaseId: phase.id,
            winnersTargetPhaseId: pool.winnersTargetPhaseId,
          });
        }
      });
    });
  });

  noWavePools.sort((a, b) => {
    if (a.eventId !== b.eventId) {
      return a.eventId - b.eventId;
    }

    if (a.winnersTargetPhaseId !== null && b.winnersTargetPhaseId === null) {
      return -1;
    }
    if (a.winnersTargetPhaseId === null && b.winnersTargetPhaseId !== null) {
      return 1;
    }
    if (
      a.winnersTargetPhaseId !== null &&
      b.winnersTargetPhaseId !== null &&
      a.winnersTargetPhaseId !== b.winnersTargetPhaseId
    ) {
      if (a.winnersTargetPhaseId === b.phaseId) {
        return -1;
      }
      if (a.phaseId === b.winnersTargetPhaseId) {
        return 1;
      }
      return a.winnersTargetPhaseId - b.winnersTargetPhaseId;
    }

    if (a.phaseId !== b.phaseId) {
      return a.phaseId - b.phaseId;
    }

    return a.name.length === b.name.length
      ? a.name.localeCompare(b.name)
      : a.name.length - b.name.length;
  });

  Array.from(waveIdToPools.values()).forEach((phaseGroups) =>
    phaseGroups.sort((a, b) =>
      a.name.length === b.name.length
        ? a.name.localeCompare(b.name)
        : a.name.length - b.name.length,
    ),
  );

  return [
    ...Array.from(waveIdToPools.keys())
      .sort((a, b) => a - b)
      .map(
        (waveId): RendererWave => ({
          id: waveId,
          pools: waveIdToPools.get(waveId)!,
        }),
      ),
    {
      id: 0,
      pools: noWavePools,
    },
  ];
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
    sggId:
      typeof set.setId === 'number' &&
      Number.isInteger(set.setId) &&
      set.setId > 0
        ? set.setId
        : null,
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

let offlineModePassword = '';
export function setOfflineModePassword(newOfflineModePassword: string) {
  offlineModePassword = newOfflineModePassword;
}

const addressToInfo = new Map<
  string,
  { computerName: string; family: Family; port: number }
>();
let listenError = '';
export function getRemoteOfflineModes() {
  return {
    remoteOfflineModes: Array.from(addressToInfo).map(
      ([
        remoteAddress,
        {
          computerName: remoteComputerName,
          family: remoteFamily,
          port: remotePort,
        },
      ]) => ({
        address: remoteAddress,
        computerName: remoteComputerName,
        family: remoteFamily,
        port: remotePort,
      }),
    ),
    listenError,
  };
}
function sendRemoteOfflineMode() {
  const { remoteOfflineModes } = getRemoteOfflineModes();
  mainWindow?.webContents.send(
    'remoteOfflineMode',
    remoteOfflineModes,
    listenError,
  );
}
function handleSocketMessage(msg: Buffer, rinfo: RemoteInfo) {
  try {
    const json = JSON.parse(msg.toString());
    const { computerName } = json;
    if (
      Number.isInteger(json.port) &&
      json.port >= 1024 &&
      json.port <= 65536
    ) {
      // ipv6 link local addresses may include an interface number eg. %en0
      // which will not be recognized as a valid URL. Convert these to the
      // ipv6 loopback address.
      let remoteAddress = rinfo.address;
      if (
        rinfo.family === 'IPv6' &&
        Array.from(remoteAddress.slice(0, 3), (char) =>
          parseInt(char, 16).toString(2),
        )
          .join('')
          .startsWith('1111111010')
      ) {
        remoteAddress = '::1';
      }

      addressToInfo.set(remoteAddress, {
        computerName: typeof computerName === 'string' ? computerName : '',
        family: rinfo.family,
        port: json.port,
      });
      sendRemoteOfflineMode();
    }
  } catch {
    // just catch
  }
}

const LISTEN_PORT = 52456;
let v4Socket: Socket | null = null;
let v6Socket: Socket | null = null;
export async function deafenForOfflineMode() {
  if (v4Socket) {
    v4Socket.removeAllListeners();
    v4Socket.close();
    v4Socket = null;
  }
  if (v6Socket) {
    v6Socket.removeAllListeners();
    v6Socket.close();
    v6Socket = null;
  }
  addressToInfo.clear();
  sendRemoteOfflineMode();
}

export async function listenForOfflineMode() {
  if (!v4Socket) {
    v4Socket = createSocket('udp4');
    v4Socket.on('message', handleSocketMessage);
    try {
      await new Promise<void>((resolve, reject) => {
        v4Socket!.on('error', (err) => {
          reject(err);
        });
        v4Socket!.bind(LISTEN_PORT, () => {
          v4Socket!.removeAllListeners('error');
          resolve();
        });
      });
    } catch (e: any) {
      listenError = e.message;
      deafenForOfflineMode();
      return;
    }
  }
  if (!v6Socket) {
    v6Socket = createSocket('udp6');
    v6Socket.on('message', handleSocketMessage);
    try {
      await new Promise<void>((resolve, reject) => {
        v6Socket!.on('error', (err) => {
          reject(err);
        });
        v6Socket!.bind(LISTEN_PORT, () => {
          v6Socket!.removeAllListeners('error');
          resolve();
        });
      });
    } catch (e: any) {
      listenError = e.message;
      deafenForOfflineMode();
      return;
    }
  }
  listenError = '';
  sendRemoteOfflineMode();
}

type AuthIdentify = {
  op: 'auth-identify';
  authentication: string;
};

type Request = {
  num: number;
} & (
  | {
      op: 'reset-set-request' | 'call-set-request' | 'start-set-request';
      id: number;
    }
  | {
      op: 'assign-set-station-request';
      id: number;
      stationId: number;
    }
  | {
      op: 'assign-set-stream-request';
      id: number;
      streamId: number;
    }
  | {
      op: 'report-set-request';
      id: number;
      winnerId: number;
      isDQ: boolean;
      gameData: StartggGame[];
    }
  | {
      op: 'client-id-request';
      computerName: string;
      clientName: string;
    }
);

let websocket: WebSocket | null = null;
export function disconnectFromOfflineMode() {
  if (websocket) {
    websocket.close();
  }
}

let nextNum = 1;
function cleanup() {
  websocket?.removeAllListeners();
  websocket = null;

  nextNum = 1;
  idToSet.clear();
  selectedSetId = 0;
  setTournament(INITIAL_TOURNAMENT);
  address = '';
  port = 0;
}

const UNAUTH_CODE = 4009;
export function connectToOfflineMode(
  newAddress: string,
  newFamily: Family,
  newPort: number,
) {
  if (websocket) {
    return;
  }

  websocket = new WebSocket(
    `ws://${newFamily === 'IPv4' ? newAddress : `[${newAddress}]`}:${newPort}`,
    'admin-protocol',
  )
    .on('error', (err) => {
      cleanup();
      setStatus('', 'IPv4', 0, err.message);
    })
    .on('close', (code) => {
      cleanup();
      if (code === UNAUTH_CODE) {
        setStatus('', 'IPv4', 0, 'Incorrect Password');
      } else {
        setStatus('', 'IPv4', 0);
      }
    })
    .on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.op === 'auth-hello') {
          if (
            typeof message.challenge === 'string' &&
            typeof message.salt === 'string'
          ) {
            const secret = createHash('sha256')
              .update(offlineModePassword)
              .update(message.salt)
              .digest()
              .toString('base64url');
            const authentication = createHash('sha256')
              .update(secret)
              .update(message.challenge)
              .digest()
              .toString('base64url');
            const authIdentify: AuthIdentify = {
              op: 'auth-identify',
              authentication,
            };
            websocket?.send(JSON.stringify(authIdentify));
          }
        } else if (message.op === 'auth-success-event') {
          setStatus(newAddress, newFamily, newPort, '');
          deafenForOfflineMode();

          const num = nextNum;
          nextNum += 1;
          const clientIdRequest: Request = {
            op: 'client-id-request',
            num,
            computerName: getComputerName(),
            clientName: 'Replay Reporter for Slippi',
          };
          websocket?.send(JSON.stringify(clientIdRequest));
        } else if (message.op === 'tournament-update-event') {
          idToSet.clear();
          if (message.tournament) {
            const newTournament = message.tournament as OfflineModeTournament;
            setTournament({
              ...newTournament,
              events: newTournament.events
                .filter((event) => event.videogameId === 1 && !event.isOnline)
                .map((event) => ({
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
