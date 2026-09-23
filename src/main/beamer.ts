import { app, BrowserWindow } from 'electron';
import DnsSd, { DnsSdBrowse } from '@fugood/dns-sd';
import { createSocket } from 'dgram';
import os from 'os';
import { mkdir, readdir, unlink } from 'fs/promises';
import path from 'path';
import sanitize from 'sanitize-filename';
import { parse as parseIpaddr } from 'ipaddr.js';
import {
  Beamer,
  BeamerFleet,
  BeamerGame,
  BeamerHealth,
  BeamerPort,
  SlpDownloadStatus,
  RequestFailure,
} from '../common/types';
import { assertInteger } from '../common/asserts';
import { hasCompleteFile } from './download';
import {
  BeamerFile,
  beamerDirWritten,
  enqueueBeamerBackgroundPull,
  enqueueBeamerPull,
  initDownloadQueue,
  isBeamerDownloadPending,
} from './downloadQueue';

const INDEX_ATTEMPTS = 3;
const INDEX_RETRY_MS = 1000;
const INDEX_TIMEOUT_MS = 5000;

const PING_FAILS_BEFORE_OFFLINE = 3;

const SWEEP_INTERVAL_MS = 90000;

const EVENT_GROUP = '239.255.42.1';
const EVENT_PORT = 34700;

const STATUS_TIMEOUT_MS = 4000;
const RESET_TIMEOUT_MS = 90000;
const MAX_JSON_BYTES = 1024 * 1024;

// the only wire schema this client reads - status, index and events alike
const BEAMER_SCHEMA = 1;

const BEAMER_HEALTHS: readonly BeamerHealth[] = [
  'ok',
  'starting',
  'warn',
  'error',
];

const BEAMER_EVENT_KINDS = ['game_started', 'game_finished'] as const;

type BeamerEventKind = (typeof BEAMER_EVENT_KINDS)[number];

type BeamerEvent = {
  event: BeamerEventKind;
  beamerId: string;
  beamerName: string;
  replay: { name: string; size?: number; url: string };
};

type BeamerStatusBody = {
  schema: typeof BEAMER_SCHEMA;
  station_id: string;
  station_name?: string;
  firmware_version?: string;
  replay_count?: number;
  replay_cap?: number;
  health?: BeamerHealth;
  warnings?: unknown;
  secs_since_port_change?: number;
  secs_since_game_start?: number;
  game?: unknown;
};

class BeamerSchemaError extends Error {
  firmwareVersion: string;

  stationName: string;

  constructor(stationName: string, firmwareVersion: string) {
    super(
      `Beamer ${stationName} found on ${
        firmwareVersion ? `firmware ${firmwareVersion}` : 'newer firmware'
      } - your Replay Reporter is out of date. Update Replay Reporter.`,
    );
    this.name = 'BeamerSchemaError';
    this.stationName = stationName;
    this.firmwareVersion = firmwareVersion;
  }
}

export const beamerFullPath = path.join(
  app.getPath('userData'),
  'replayCache',
  'beamer',
);

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asPort(value: unknown): BeamerPort | null {
  const record = asRecord(value);
  if (!record || !Number.isInteger(record.port)) {
    return null;
  }
  return {
    port: record.port as number,
    charId:
      Number.isInteger(record.char_id) && (record.char_id as number) >= 0
        ? (record.char_id as number)
        : null,
    costume: Number.isInteger(record.costume) ? (record.costume as number) : 0,
    char: asString(record.char),
    nametag: asString(record.nametag),
  };
}

function asGame(value: unknown): BeamerGame | null {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.ports)) {
    return null;
  }
  const ports = (record.ports as unknown[])
    .map(asPort)
    .filter((port: BeamerPort | null): port is BeamerPort => port !== null);
  return { live: record.live === true, ports };
}

function asHealth(value: unknown): BeamerHealth {
  return BEAMER_HEALTHS.includes(value as BeamerHealth)
    ? (value as BeamerHealth)
    : 'unknown';
}

function asCount(value: unknown) {
  return Number.isInteger(value) ? (value as number) : undefined;
}

function asWarnings(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (warning): warning is string =>
          typeof warning === 'string' && warning.length > 0,
      )
    : [];
}

function beamerFromStatus(
  base: Pick<Beamer, 'address' | 'host'>,
  status: BeamerStatusBody,
): Beamer {
  return {
    ...base,
    beamerId: asString(status.station_id),
    beamerName: asString(status.station_name),
    firmwareVersion: asString(status.firmware_version) || undefined,
    replayCount: asCount(status.replay_count),
    replayCap: asCount(status.replay_cap),
    health: asHealth(status.health),
    warnings: asWarnings(status.warnings),
    secsSincePortChange: asCount(status.secs_since_port_change),
    secsSinceGameStart: asCount(status.secs_since_game_start),
    game: asGame(status.game),
  };
}

function isStatusBody(body: unknown): body is BeamerStatusBody {
  const record = asRecord(body);
  return Boolean(
    record &&
      record.schema === BEAMER_SCHEMA &&
      typeof record.station_id === 'string',
  );
}

function newerSchemaError(body: unknown) {
  const record = asRecord(body);
  if (
    !record ||
    typeof record.schema !== 'number' ||
    record.schema <= BEAMER_SCHEMA ||
    typeof record.station_id !== 'string'
  ) {
    return null;
  }
  return new BeamerSchemaError(
    asString(record.station_name) || record.station_id,
    asString(record.firmware_version),
  );
}

function parseJson(buf: Buffer): unknown {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new Error('That beamer sent back far more than it should have.');
  }
  if (!response.body) {
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > MAX_JSON_BYTES) {
      reader.cancel();
      throw new Error('That beamer sent back far more than it should have.');
    }
    chunks.push(value);
  }
  return parseJson(Buffer.concat(chunks));
}

function unreachableError(
  e: unknown,
  origin: string,
  timeoutMessage = `${origin} did not respond.`,
) {
  const timedOut =
    e instanceof Error &&
    (e.name === 'TimeoutError' || e.name === 'AbortError');
  return new Error(
    timedOut ? timeoutMessage : `Could not reach a Beamer at ${origin}.`,
  );
}

type StatusResult =
  | { kind: 'status'; body: BeamerStatusBody }
  | { kind: 'unreported' };

async function getBeamerStatus(origin: string): Promise<StatusResult> {
  let response;
  try {
    response = await fetch(`${origin}/status`, {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
  } catch (e) {
    throw unreachableError(e, origin);
  }

  if (response.status === 503) {
    return { kind: 'unreported' };
  }
  if (!response.ok) {
    throw new Error(`${origin} answered ${response.status} for /status.`);
  }

  const body = await readJson(response);
  if (!isStatusBody(body)) {
    const schemaError = newerSchemaError(body);
    if (schemaError) {
      throw schemaError;
    }
    throw new Error(
      `${origin} did not return a status report. Is it a Beamer?`,
    );
  }
  return { kind: 'status', body };
}

async function requestBeamerReset(origin: string) {
  let response;
  try {
    response = await fetch(`${origin}/reset-beamer`, {
      method: 'POST',
      headers: { 'X-Beamer-Confirm': 'reset' },
      body: '',
      signal: AbortSignal.timeout(RESET_TIMEOUT_MS),
    });
  } catch (e) {
    throw unreachableError(
      e,
      origin,
      `${origin} did not answer the reset. Check the beamer before assuming its replays survived.`,
    );
  }

  if (response.ok) {
    return;
  }
  if (response.status === 400) {
    throw new Error(
      `${origin} refused the reset confirmation header. Is that a Beamer?`,
    );
  }
  const reported = asString(asRecord(await readJson(response))?.error);
  if (response.status === 409) {
    throw new Error(
      reported
        ? `That beamer refused: ${reported}. Nothing was erased - try again in a moment.`
        : 'That beamer is busy sending a replay, or with another action. Nothing was erased - try again in a moment.',
    );
  }
  throw new Error(
    reported || `${origin} answered ${response.status} for /reset-beamer.`,
  );
}

function addressFor(service: { addresses: string[]; port: number }) {
  const hasDots = (candidate: string) => candidate.includes('.');
  const isRoutable = (candidate: string) =>
    !candidate.startsWith('127.') && !candidate.startsWith('169.254.');

  const address =
    service.addresses.find(
      (candidate) => hasDots(candidate) && isRoutable(candidate),
    ) ??
    service.addresses.find(hasDots) ??
    service.addresses[0] ??
    '';
  if (!address) {
    return '';
  }
  const bracketed = address.includes(':') ? `[${address}]` : address;
  return service.port === 80 ? bracketed : `${bracketed}:${service.port}`;
}

type BeamerBrowseHandle = {
  stop: () => void;
};

function browseForBeamers(callbacks: {
  onFound: (base: Pick<Beamer, 'address' | 'host'>) => void;
  onLost: (host: string) => void;
  onError: (error: Error) => void;
}): BeamerBrowseHandle {
  let browser: DnsSdBrowse | null = DnsSd.search('_beamer._tcp')
    .on('serviceFound', (service) => {
      const address = addressFor(service);
      if (!address) {
        return;
      }
      callbacks.onFound({
        address,
        host: service.name,
      });
    })
    .on('serviceLost', (service) => {
      callbacks.onLost(service.name);
    })
    .on('error', (error) => {
      callbacks.onError(error);
    });

  return {
    stop: () => {
      if (browser) {
        browser.removeAllListeners();
        browser.stop();
        browser = null;
      }
    },
  };
}

export function sanitizeReplayName(name: string): string {
  const base = path.basename(name);
  if (!base.endsWith('.slp') || base.startsWith('.')) {
    return '';
  }
  return base;
}

function parseBeamerEvent(buf: Buffer): BeamerEvent | null {
  const body = asRecord(parseJson(buf));
  if (!body || body.schema !== BEAMER_SCHEMA) {
    return null;
  }
  if (!BEAMER_EVENT_KINDS.includes(body.event as BeamerEventKind)) {
    return null;
  }
  if (typeof body.station_id !== 'string' || !body.station_id) {
    return null;
  }
  const replay = asRecord(body.replay);
  const name =
    typeof replay?.name === 'string' ? sanitizeReplayName(replay.name) : '';
  if (!replay || !name || typeof replay.url !== 'string' || !replay.url) {
    return null;
  }
  return {
    event: body.event as BeamerEventKind,
    beamerId: body.station_id,
    beamerName: asString(body.station_name),
    replay: {
      name,
      size: asCount(replay.size),
      url: replay.url,
    },
  };
}

type BeamerEventsHandle = {
  stop: () => void;
};

function subscribeBeamerEvents(callbacks: {
  onEvent: (event: BeamerEvent, fromAddress: string) => void;
  onError: (error: Error) => void;
}): BeamerEventsHandle {
  const socket = createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('error', (error) => {
    callbacks.onError(error);
  });
  socket.on('message', (msg, rinfo) => {
    const event = parseBeamerEvent(msg);
    if (event) {
      callbacks.onEvent(event, rinfo.address);
    }
  });

  socket.bind(EVENT_PORT, () => {
    const join = (iface?: string) => {
      try {
        socket.addMembership(EVENT_GROUP, iface);
      } catch {
        // already a member on this interface, or it cannot join here
      }
    };
    join();
    Object.values(os.networkInterfaces()).forEach((ifaces) => {
      (ifaces ?? []).forEach((ni) => {
        if (ni.family === 'IPv4' && !ni.internal) {
          join(ni.address);
        }
      });
    });
  });

  return {
    stop: () => {
      try {
        socket.close();
      } catch {
        // already closed
      }
    },
  };
}

function toBeamerOrigin(addressOrHost: string) {
  // beamers have no TLS by design - strip https and force http
  const trimmed = addressOrHost
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Enter a Beamer address.');
  }

  let host = trimmed;
  try {
    const ipaddr = parseIpaddr(trimmed);
    host =
      ipaddr.kind() === 'ipv4' ? ipaddr.toString() : `[${ipaddr.toString()}]`;
  } catch {
    // Not an IP. Leave it alone so hostnames like beamer-3f2a.local work.
  }
  return `http://${host}`;
}

async function fetchIndex(origin: string) {
  let last: unknown;
  for (let i = 0; i < INDEX_ATTEMPTS; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fetch(`${origin}/SLIPPI/`, {
        signal: AbortSignal.timeout(INDEX_TIMEOUT_MS),
      });
    } catch (e) {
      last = e;
      if (i < INDEX_ATTEMPTS - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, INDEX_RETRY_MS);
        });
      }
    }
  }
  throw last;
}

export function beamerReplayUrl(url: string, origin: string): string {
  let resolved;
  try {
    resolved = new URL(url, origin);
  } catch {
    return '';
  }
  const resolvedStr = resolved.toString();
  const prefix = `${origin}/SLIPPI/`;
  return resolvedStr.startsWith(prefix) ? resolvedStr : '';
}

async function getBeamerIndex(origin: string) {
  let response;
  try {
    response = await fetchIndex(origin);
  } catch (e) {
    throw unreachableError(e, origin);
  }
  if (!response.ok) {
    throw new Error(
      `${origin} answered ${response.status} for /SLIPPI/. Is that a Beamer?`,
    );
  }

  const index = asRecord(await readJson(response));
  const filesList = Array.isArray(index?.files) ? index.files : null;
  if (!index || !filesList) {
    throw new Error(`${origin} did not return a replay index.`);
  }
  if (index.schema !== BEAMER_SCHEMA) {
    throw new Error(
      typeof index.schema === 'number' && index.schema > BEAMER_SCHEMA
        ? "That beamer's firmware is newer than this Replay Reporter understands. Update Replay Reporter."
        : `${origin} did not return a replay index.`,
    );
  }

  const files: BeamerFile[] = [];
  filesList.forEach((entry: unknown) => {
    const file = asRecord(entry);
    if (!file || typeof file.url !== 'string' || !file.url) {
      return;
    }
    const url = beamerReplayUrl(file.url, origin);
    if (!url) {
      return; // malformed or off-origin url - skip the file
    }
    let name = '';
    try {
      const { pathname } = new URL(url);
      name = sanitizeReplayName(path.basename(decodeURIComponent(pathname)));
    } catch {
      return; // malformed percent-encoding - skip the file
    }
    if (!name) {
      return;
    }
    files.push({
      name,
      size: Number.isInteger(file.size) ? (file.size as number) : undefined,
      url,
    });
  });
  return {
    beamerId: typeof index.station_id === 'string' ? index.station_id : '',
    files,
  };
}

function beamerDirFor(beamerId: string) {
  if (!beamerId) {
    throw new Error(
      'Refusing to cache replays for a beamer with no station id.',
    );
  }
  const label = sanitize(beamerId.replace(/:/g, '_'));
  if (!label) {
    throw new Error(`Could not derive a cache directory for ${beamerId}.`);
  }
  return path.join(beamerFullPath, label);
}

async function nextOlderMissingFile(dest: string, files: BeamerFile[]) {
  const present = await Promise.all(
    files.map((file) => hasCompleteFile(dest, file)),
  );
  // the index is newest-first: the last present file is the oldest one we
  // have, so the next file after it is the newest replay we are missing
  const oldestPresent = present.lastIndexOf(true);
  return oldestPresent >= 0 && oldestPresent + 1 < files.length
    ? files[oldestPresent + 1]
    : null;
}

async function listCachedReplays(dest: string) {
  try {
    return (await readdir(dest, { withFileTypes: true }))
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.slp'))
      .map((dirent) => dirent.name);
  } catch {
    return [];
  }
}

async function pruneStaleReplays(
  dest: string,
  cached: string[],
  indexNames: string[],
) {
  const keep = new Set(indexNames);
  const stale = cached.filter((name) => !keep.has(name));

  let parts: string[] = [];
  try {
    parts = (await readdir(dest, { withFileTypes: true }))
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.slp.part'))
      .map((dirent) => dirent.name)
      .filter((name) => !keep.has(name.slice(0, -'.part'.length)));
  } catch {
    // Already gone.
  }

  await Promise.all(
    [...stale, ...parts].map(async (name) => {
      if (
        name.endsWith('.part') &&
        isBeamerDownloadPending(dest, name.slice(0, -'.part'.length))
      ) {
        return;
      }
      try {
        await unlink(path.join(dest, name));
      } catch {
        // Already gone (or in use). The next refresh tries again.
      }
    }),
  );
  return stale;
}

let mainWindow: BrowserWindow | undefined;
let autoSubscribeBeamers = false;

const sendBeamerDownloadStatus = (status: SlpDownloadStatus) => {
  if (mainWindow) {
    mainWindow.webContents.send('beamerDownloadStatus', status);
  }
};

type BeamerBase = Pick<Beamer, 'address' | 'host'>;

const liveBeamers = {
  byId: new Map<string, Beamer>(),
  idByAddress: new Map<string, string>(), // address -> beamerId
  pingFails: new Map<string, number>(), // beamerId -> consecutive missed pings
};

const findLiveBeamerAt = (address: string) => {
  const beamerId = liveBeamers.idByAddress.get(address);
  return beamerId ? liveBeamers.byId.get(beamerId) : undefined;
};

function removeLiveBeamer(beamerId: string) {
  const removed = liveBeamers.byId.get(beamerId);
  liveBeamers.byId.delete(beamerId);
  liveBeamers.pingFails.delete(beamerId);
  if (removed && liveBeamers.idByAddress.get(removed.address) === beamerId) {
    liveBeamers.idByAddress.delete(removed.address);
  }
}

function removeLiveBeamerAt(address: string) {
  const existing = findLiveBeamerAt(address);
  if (existing) {
    removeLiveBeamer(existing.beamerId);
  }
}

function upsertLiveBeamer(beamer: Beamer) {
  if (!beamer.beamerId) {
    throw new Error('Refusing to key a beamer with no station id.');
  }
  const existing = liveBeamers.byId.get(beamer.beamerId);
  if (
    existing &&
    existing.address !== beamer.address &&
    liveBeamers.idByAddress.get(existing.address) === beamer.beamerId
  ) {
    liveBeamers.idByAddress.delete(existing.address);
  }
  const previous = findLiveBeamerAt(beamer.address);
  if (previous && previous.beamerId !== beamer.beamerId) {
    liveBeamers.byId.delete(previous.beamerId);
    liveBeamers.pingFails.delete(previous.beamerId);
  }
  liveBeamers.idByAddress.set(beamer.address, beamer.beamerId);
  liveBeamers.byId.set(beamer.beamerId, beamer);
}

function markPingMiss(address: string) {
  const existing = findLiveBeamerAt(address);
  if (existing) {
    liveBeamers.pingFails.set(
      existing.beamerId,
      (liveBeamers.pingFails.get(existing.beamerId) ?? 0) + 1,
    );
  }
}

// a ghost is a beamer seen on mDNS that doesn't meet the HTTP API...
const ghosts = new Map<
  string, // address
  { base: BeamerBase; error?: BeamerSchemaError }
>();

const forgetBeamerAt = (address: string) => {
  ghosts.delete(address);
  removeLiveBeamerAt(address);
};

const rememberedBeamers = new Map<string, { origin: string; name: string }>();

function rememberBeamer(
  beamerId: string,
  origin: string,
  name: string | undefined,
) {
  if (!beamerId || !name) {
    return;
  }
  rememberedBeamers.set(beamerId, { origin, name });
}

const beamerLabel = (beamerId: string) =>
  rememberedBeamers.get(beamerId)?.name || beamerId;

const subscriptions = {
  subscribed: new Map<string, string>(), // stationId -> origin
  baselines: new Map<string, string>(), // stationId -> newest index name at subscribe time
  unsubscribed: new Set<string>(), // unsubscribes have session lifetimes
};

const isSubscribed = (beamer: Pick<Beamer, 'beamerId'>) =>
  subscriptions.subscribed.has(beamer.beamerId);

async function seedSubscriptionBaseline(beamerId: string) {
  const origin = subscriptions.subscribed.get(beamerId);
  if (!origin) {
    return;
  }
  try {
    const { files } = await getBeamerIndex(origin);
    if (subscriptions.subscribed.get(beamerId) !== origin) {
      return;
    }
    const newest = files.reduce(
      (max: string, file: BeamerFile) =>
        max && file.name <= max ? max : file.name,
      '',
    );
    subscriptions.baselines.set(beamerId, newest);
  } catch {
    // unreachable - the sweep seeds inline on its next pass
  }
}

function beginSubscriptionBaseline(beamerId: string) {
  subscriptions.baselines.delete(beamerId);
  seedSubscriptionBaseline(beamerId).catch(() => {});
}

function rememberBeamerSubscription(origin: string, beamer: Beamer) {
  if (!beamer.beamerId) {
    return;
  }
  subscriptions.subscribed.set(beamer.beamerId, origin);
  rememberBeamer(beamer.beamerId, origin, beamer.beamerName);
  beginSubscriptionBaseline(beamer.beamerId);
}

const autoSubscribeCandidate = (beamer: Beamer) =>
  autoSubscribeBeamers &&
  Boolean(beamer.beamerId) &&
  !subscriptions.subscribed.has(beamer.beamerId) &&
  !subscriptions.unsubscribed.has(beamer.beamerId);

const browse = {
  handle: null as BeamerBrowseHandle | null,
  open: false,
  error: '',
};

const listedBeamers = () =>
  Array.from(liveBeamers.byId.values())
    .filter(
      (beamer) =>
        (liveBeamers.pingFails.get(beamer.beamerId) ?? 0) <
        PING_FAILS_BEFORE_OFFLINE,
    )
    .map((beamer) => ({
      ...beamer,
      subscribed: isSubscribed(beamer),
      label: beamerLabel(beamer.beamerId),
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );

const getBeamerFleet = (): BeamerFleet => ({
  beamers: listedBeamers(),
  browsing: browse.handle !== null,
  error: browse.error,
  ghostBeamerErrors: Array.from(ghosts.values()).flatMap((ghost) =>
    ghost.error ? [ghost.error.message] : [],
  ),
});

const sendBeamerFleet = () => {
  if (mainWindow) {
    mainWindow.webContents.send('beamerFleet', getBeamerFleet());
  }
};

const pruneStaleReplaysFor = async (
  origin: string,
  beamer: Beamer,
  previousCount?: number,
) => {
  if (!beamer.beamerId) {
    return;
  }
  const dest = beamerDirFor(beamer.beamerId);
  const cached = await listCachedReplays(dest);
  if (cached.length === 0) {
    return;
  }

  if (
    previousCount != null &&
    beamer.replayCount != null &&
    beamer.replayCount === previousCount
  ) {
    return;
  }

  const { files } = await getBeamerIndex(origin);
  const stale = await pruneStaleReplays(
    dest,
    cached,
    files.map((file) => file.name),
  );
  if (stale.length === 0) {
    return;
  }

  beamerDirWritten.emit('dirWritten', dest);
};

const refreshBeamer = async (base: BeamerBase) => {
  const origin = toBeamerOrigin(base.address);
  let result: StatusResult;
  try {
    result = await getBeamerStatus(origin);
  } catch (e) {
    if (e instanceof BeamerSchemaError) {
      removeLiveBeamerAt(base.address);
      ghosts.set(base.address, { base, error: e });
      return;
    }
    markPingMiss(base.address);
    return;
  }
  const beamer =
    result.kind === 'status' ? beamerFromStatus(base, result.body) : null;

  if (!beamer || !beamer.beamerId) {
    removeLiveBeamerAt(base.address);
    ghosts.set(base.address, { base });
    return;
  }

  const previous =
    liveBeamers.byId.get(beamer.beamerId) ?? findLiveBeamerAt(base.address);
  upsertLiveBeamer(beamer);
  liveBeamers.pingFails.delete(beamer.beamerId);
  ghosts.delete(base.address);

  if (subscriptions.subscribed.has(beamer.beamerId)) {
    subscriptions.subscribed.set(beamer.beamerId, origin);
  }
  rememberBeamer(beamer.beamerId, origin, beamer.beamerName || beamer.beamerId);

  if (autoSubscribeCandidate(beamer)) {
    rememberBeamerSubscription(origin, beamer);
  }

  try {
    await pruneStaleReplaysFor(origin, beamer, previous?.replayCount);
  } catch {
    // if there's no index, we don't know whats stale - just noop.
  }
};

export async function refreshAllBeamers() {
  const bases = [
    ...liveBeamers.byId.values(),
    ...Array.from(ghosts.values()).map((ghost) => ghost.base),
  ].map(({ address, host }) => ({ address, host }));
  await Promise.all(bases.map((base) => refreshBeamer(base)));
  sendBeamerFleet();
}

let beamerEvents: BeamerEventsHandle | null = null;
const statusRefreshInFlight = new Set<string>();

const refreshBeamerForEvent = async (beamerId: string) => {
  const beamer = liveBeamers.byId.get(beamerId);
  if (!beamer || statusRefreshInFlight.has(beamerId)) {
    return;
  }
  statusRefreshInFlight.add(beamerId);
  try {
    await refreshBeamer({
      address: beamer.address,
      host: beamer.host,
    });
    sendBeamerFleet();
  } finally {
    statusRefreshInFlight.delete(beamerId);
  }
};

const pullWanted = (beamerId: string) =>
  subscriptions.subscribed.has(beamerId) ||
  (autoSubscribeBeamers && !subscriptions.unsubscribed.has(beamerId));

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweepInFlight = false;
let sweepQueued = false;

async function reconcileSubscribedBeamer(beamerId: string, origin: string) {
  const baseline = subscriptions.baselines.get(beamerId);
  if (baseline === undefined) {
    await seedSubscriptionBaseline(beamerId);
    return;
  }
  let files: BeamerFile[];
  try {
    ({ files } = await getBeamerIndex(origin));
  } catch {
    return;
  }
  if (!subscriptions.subscribed.has(beamerId)) {
    return;
  }
  const dest = beamerDirFor(beamerId);
  const label = beamerLabel(beamerId);
  files.forEach((file) => {
    if (file.name <= baseline || isBeamerDownloadPending(dest, file.name)) {
      return;
    }
    enqueueBeamerBackgroundPull({
      dest,
      name: file.name,
      url: file.url,
      size: file.size,
      beamerId,
      beamerName: label,
    });
  });
}

async function runSubscriptionSweep() {
  sweepInFlight = true;
  try {
    await Promise.allSettled(
      [...subscriptions.subscribed.entries()].map(([beamerId, origin]) =>
        reconcileSubscribedBeamer(beamerId, origin),
      ),
    );
  } finally {
    sweepInFlight = false;
    if (sweepQueued && sweepTimer) {
      sweepQueued = false;
      runSubscriptionSweep();
    }
  }
}

function scheduleSubscriptionSweep() {
  if (!sweepTimer) {
    return;
  }
  if (sweepInFlight) {
    sweepQueued = true;
    return;
  }
  runSubscriptionSweep();
}

function startSubscriptionSweep() {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(scheduleSubscriptionSweep, SWEEP_INTERVAL_MS);
}

function stopSubscriptionSweep() {
  if (!sweepTimer) {
    return;
  }
  clearInterval(sweepTimer);
  sweepTimer = null;
  sweepQueued = false;
}

const onBeamerEvent = (event: BeamerEvent) => {
  scheduleSubscriptionSweep();
  refreshBeamerForEvent(event.beamerId).catch(() => {});
  if (event.event === 'game_finished' && pullWanted(event.beamerId)) {
    const beamer = liveBeamers.byId.get(event.beamerId);
    const origin =
      subscriptions.subscribed.get(event.beamerId) ||
      rememberedBeamers.get(event.beamerId)?.origin ||
      (beamer ? toBeamerOrigin(beamer.address) : '');
    if (origin) {
      try {
        const url = beamerReplayUrl(event.replay.url, origin);
        if (!url) {
          throw new Error('Ignoring replay that fails beamer sanitization.');
        }
        enqueueBeamerBackgroundPull({
          dest: beamerDirFor(event.beamerId),
          name: event.replay.name,
          url,
          size: event.replay.size,
          beamerId: event.beamerId,
          beamerName: beamerLabel(event.beamerId),
        });
      } catch {
        // unparseable replay url - it'll get fetched on select
      }
    }
  }
};

const startBeamerEvents = () => {
  if (beamerEvents) {
    return;
  }
  beamerEvents = subscribeBeamerEvents({
    onEvent: onBeamerEvent,
    onError: () => {
      // best-effort: a bind/join failure just means no live hints this session
    },
  });
};

const stopBeamerEvents = () => {
  beamerEvents?.stop();
  beamerEvents = null;
};

const startBeamerBrowser = () => {
  if (browse.handle) {
    return;
  }
  browse.error = '';
  browse.handle = browseForBeamers({
    onFound: (base) => {
      const known = findLiveBeamerAt(base.address);
      if (known) {
        upsertLiveBeamer({ ...known, ...base });
      } else {
        ghosts.set(base.address, {
          base,
          error: ghosts.get(base.address)?.error,
        });
      }
      sendBeamerFleet();
      refreshBeamer(base)
        .then(sendBeamerFleet)
        .catch(() => {
          sendBeamerFleet();
        });
    },
    onLost: (host) => {
      const sharing = [
        ...liveBeamers.byId.values(),
        ...Array.from(ghosts.values()).map((ghost) => ghost.base),
      ].filter((base) => base.host === host);
      if (sharing.length === 0) {
        return;
      }
      if (sharing.length === 1) {
        forgetBeamerAt(sharing[0].address);
        sendBeamerFleet();
        return;
      }
      Promise.all(
        sharing.map(async (base) => {
          try {
            await getBeamerStatus(toBeamerOrigin(base.address));
          } catch {
            forgetBeamerAt(base.address);
          }
        }),
      )
        .then(sendBeamerFleet)
        .catch(() => {
          sendBeamerFleet();
        });
    },
    onError: (error) => {
      browse.error = error.message;
      sendBeamerFleet();
    },
  });
  sendBeamerFleet();
};

const stopBeamerBrowser = () => {
  browse.handle?.stop();
  browse.handle = null;
  browse.error = '';
};

const beamerListenersWanted = () =>
  browse.open || autoSubscribeBeamers || subscriptions.subscribed.size > 0;

const updateBeamerListeners = () => {
  if (beamerListenersWanted()) {
    startBeamerBrowser();
    startBeamerEvents();
  } else {
    stopBeamerBrowser();
    stopBeamerEvents();
  }
  if (subscriptions.subscribed.size > 0) {
    startSubscriptionSweep();
  } else {
    stopSubscriptionSweep();
  }
};

export function stopBeamerBrowse() {
  browse.open = false;
  updateBeamerListeners();
}

export function startBeamerBrowse() {
  browse.open = true;
  updateBeamerListeners();
  refreshAllBeamers().catch(() => {}); // truth-check the fleet the moment the dialog opens
  sendBeamerFleet();
}

export async function selectBeamer(beamerId: string, maxGames: number) {
  const beamer = liveBeamers.byId.get(beamerId);
  const origin =
    (beamer ? toBeamerOrigin(beamer.address) : '') ||
    rememberedBeamers.get(beamerId)?.origin ||
    '';
  if (!origin) {
    throw new Error('That beamer is no longer advertising itself.');
  }

  const indexPromise = getBeamerIndex(origin);
  const statusPromise = getBeamerStatus(origin).catch(() => null);
  const { beamerId: indexBeamerId, files } = await indexPromise;
  const remembered = beamerLabel(indexBeamerId);
  if (!remembered) {
    throw new Error('A beamer did not report its station id.');
  }
  const status = await statusPromise;
  const beamerName =
    status?.kind === 'status' && typeof status.body.station_name === 'string'
      ? status.body.station_name
      : '';
  const label = beamerName || remembered;

  const dest = beamerDirFor(indexBeamerId);

  await mkdir(dest, { recursive: true });
  rememberBeamer(indexBeamerId, origin, label);
  await enqueueBeamerPull(dest, files.slice(0, maxGames), indexBeamerId, label);
  return { dest, display: label, beamerId: indexBeamerId };
}

export async function refreshFromBeamer(
  beamerId: string,
  dir: string,
  maxGames: number,
) {
  const origin = rememberedBeamers.get(beamerId)?.origin;
  if (!origin) {
    throw new Error('Those replays are no longer loaded from a Beamer.');
  }

  const { files } = await getBeamerIndex(origin);
  await enqueueBeamerPull(
    dir,
    files.slice(0, maxGames),
    beamerId,
    beamerLabel(beamerId),
  );
}

export async function getPreviousBeamerReplay(beamerId: string, dir: string) {
  const origin = rememberedBeamers.get(beamerId)?.origin;
  if (!origin) {
    return '';
  }
  try {
    const { files } = await getBeamerIndex(origin);
    return (await nextOlderMissingFile(dir, files))?.name ?? '';
  } catch {
    return ''; // beamer unreachable - there is no previous replay
  }
}

export async function downloadPreviousBeamerReplay(
  beamerId: string,
  dir: string,
) {
  const origin = rememberedBeamers.get(beamerId)?.origin;
  if (!origin) {
    throw new Error('Those replays are no longer loaded from a Beamer.');
  }
  const { files } = await getBeamerIndex(origin);
  const previous = await nextOlderMissingFile(dir, files);
  if (!previous) {
    return;
  }
  await enqueueBeamerPull(dir, [previous], beamerId, beamerLabel(beamerId));
}

export function setBeamerSubscribed(beamerId: string, subscribed: boolean) {
  if (subscribed) {
    const beamer = liveBeamers.byId.get(beamerId);
    if (beamer) {
      rememberBeamerSubscription(toBeamerOrigin(beamer.address), beamer);
    } else {
      const rememberedOrigin = rememberedBeamers.get(beamerId)?.origin;
      if (rememberedOrigin) {
        subscriptions.subscribed.set(beamerId, rememberedOrigin);
        beginSubscriptionBaseline(beamerId);
      }
    }
  } else {
    subscriptions.unsubscribed.add(beamerId);
    subscriptions.subscribed.delete(beamerId);
    subscriptions.baselines.delete(beamerId);
  }
  updateBeamerListeners();
  sendBeamerFleet();
}

export function getBeamersAutoSubscribe() {
  return autoSubscribeBeamers;
}

export function setBeamersAutoSubscribe(on: boolean) {
  autoSubscribeBeamers = on;
  if (on) {
    const swept = listedBeamers().filter(autoSubscribeCandidate);
    swept.forEach((beamer) =>
      rememberBeamerSubscription(toBeamerOrigin(beamer.address), beamer),
    );
    if (swept.length > 0) {
      sendBeamerFleet();
    }
  }
  updateBeamerListeners();
}

export async function refreshBeamerStatus(beamerId: string) {
  const existing = liveBeamers.byId.get(beamerId);
  if (!existing) {
    throw new Error('That beamer is no longer advertising itself.');
  }
  await refreshBeamer({
    address: existing.address,
    host: existing.host,
  });
  sendBeamerFleet();
}

const runOverFleet = async (
  action: (beamer: Beamer) => Promise<void>,
): Promise<RequestFailure[]> => {
  const targets = listedBeamers();
  if (targets.length === 0) {
    throw new Error('No beamers are advertising themselves.');
  }

  const results = await Promise.allSettled(targets.map(action));

  const failures: RequestFailure[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const beamer = targets[i];
      failures.push({
        label: beamer.label,
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  });

  sendBeamerFleet();
  return failures;
};

export async function resetBeamer(beamerId: string) {
  const existing = liveBeamers.byId.get(beamerId);
  if (!existing) {
    throw new Error('That beamer is no longer advertising itself.');
  }
  const base = { address: existing.address, host: existing.host };
  await requestBeamerReset(toBeamerOrigin(base.address));
  await refreshBeamer(base);
  sendBeamerFleet();
}

export function resetAllBeamers() {
  return runOverFleet(async (beamer) => {
    const base = { address: beamer.address, host: beamer.host };
    await requestBeamerReset(toBeamerOrigin(base.address));
    await refreshBeamer(base);
  });
}

export function clampMaxGamesFromIndex(newMaxGamesFromIndex: number) {
  return Math.max(assertInteger(newMaxGamesFromIndex), 1);
}

export function initBeamers(
  initMainWindow: BrowserWindow,
  initAutoSubscribe: boolean,
) {
  mainWindow = initMainWindow;
  autoSubscribeBeamers = initAutoSubscribe;
  initDownloadQueue(sendBeamerDownloadStatus);
  updateBeamerListeners();
}
