import { Bracket as ParryggBracketPb } from '@parry-gg/client';

export type Id = string | number;

export type PlayerOverrides = {
  displayName: string;
  entrantId: Id;
  participantId: Id;
  prefix: string;
  pronouns: string;
};

export type Player = {
  connectCode: string;
  costumeIndex: number;
  displayName: string;
  externalCharacterId: number;
  isWinner: boolean;
  nametag: string;
  playerOverrides: PlayerOverrides;
  playerType: number;
  port: number;
  stocksRemaining: number;
  teamId: number; // 0: red, 1: blue, 2: green, else not teams
};

export type Replay = {
  fileName: string;
  filePath: string;
  invalidReasons: string[];
  isTeams: boolean;
  lastFrame: number;
  players: [Player, Player, Player, Player];
  selected: boolean;
  stageId: number;
  startAt: Date;
  timeout: boolean;
};

export type InvalidReplay = {
  fileName: string;
  invalidReason: string;
};

export enum State {
  PENDING = 1,
  STARTED = 2,
  COMPLETED = 3,
  CALLED = 6,
}

export type Participant = {
  id: Id;
  displayName: string;
  prefix: string;
  pronouns: string;
};

export type Entrant = {
  id: number;
  participants: Participant[];
};

export type Stream = {
  id: number;
  domain: string;
  path: string;
};

export type Station = {
  id: number;
  number: number;
};

export type GameScore = {
  entrant1Score: number | null;
  entrant2Score: number | null;
};

export type Set = {
  id: Id;
  state: State;
  round: number;
  fullRoundText: string;
  winnerId: Id | null;
  entrant1Id: Id;
  entrant1Participants: Participant[];
  entrant1Score: number | null;
  entrant2Id: Id;
  entrant2Participants: Participant[];
  entrant2Score: number | null;
  gameScores: GameScore[];
  stream: Stream | null;
  station: Station | null;
  ordinal: number | null; // can be null for start.gg non-DE and challonge swiss
  wasReported: boolean;
  updatedAtMs: number;
  completedAtMs: number;
};

export type Sets = {
  pendingSets: Set[];
  completedSets: Set[];
};

export type PhaseGroup = {
  id: number;
  /**
   * 1: SINGLE_ELIMINATION
   * 2: DOUBLE_ELIMINATION
   * 3: ROUND_ROBIN
   * 4: SWISS
   * 6: CUSTOM_SCHEDULE
   * 7: MATCHMAKING (not supported)
   * https://developer.start.gg/reference/brackettype.doc
   */
  bracketType: number;
  entrants: Entrant[];
  name: string;
  sets: Sets;
  state: State;
  waveId: number | null;
  winnersTargetPhaseId: number | null;
};

export type Phase = {
  id: number;
  name: string;
  phaseGroups: PhaseGroup[];
  state: State;
};

export type Event = {
  id: number;
  name: string;
  slug: string;
  state: State;
  phases: Phase[];
};

export type Tournament = {
  slug: string;
  name: string;
  location: string;
  events: Event[];
  stations: Station[];
  streams: Stream[];
};

export type RendererPool = {
  id: number;
  name: string;
  entrants: Entrant[];
};

export type RendererWave = {
  id: number;
  pools: RendererPool[];
};

export type AdminedTournament = {
  slug: string;
  name: string;
};

export type ChallongeTournament = {
  entrants: Entrant[];
  name: string;
  slug: string;
  sets: Sets;
  state: State;
  // can be 'swiss' or 'round robin' or 'double elimination' among others
  tournamentType: string;
};

export type StartggGameSelection = {
  characterId: number;
  entrantId: Id;
};

export type StartggGame = {
  entrant1Score: number;
  entrant2Score: number;
  // 1-indexed
  gameNum: number;
  selections: StartggGameSelection[];
  stageId?: number;
  winnerId: number;
};

export type StartggSet = {
  setId: Id;
  winnerId: Id;
  isDQ: boolean;
  gameData: StartggGame[];
};

export type ChallongeMatchItem = {
  participant_id: string;
  score_set: string;
  rank: number;
  advancing: boolean;
};

export enum Output {
  FILES,
  FOLDER,
  ZIP,
}

export type EnforcePlayerFailure = {
  checkNames: string[];
  port: number;
};

export enum EnforceStatus {
  PENDING,
  DONE,
  ERROR,
}

export type EnforceState = {
  status: EnforceStatus;
  fileNameToPlayerFailures: Map<string, EnforcePlayerFailure[]>;
  reason?: any;
};

export type SelectedEvent = {
  id: Id;
  name: string;
  slug: string;
  hasSiblings: boolean;
};

export type SelectedPhase = {
  id: Id;
  name: string;
  hasSiblings: boolean;
};

export type SelectedPhaseGroup = {
  id: Id;
  name: string;
  /**
   * 1: SINGLE_ELIMINATION
   * 2: DOUBLE_ELIMINATION
   * 3: ROUND_ROBIN
   * 4: SWISS
   * 6: CUSTOM_SCHEDULE
   * 7: MATCHMAKING (not supported)
   * https://developer.start.gg/reference/brackettype.doc
   */
  bracketType: number;
  hasSiblings: boolean;
  waveId: number | null;
  winnersTargetPhaseId: number | null;
};

export type SelectedSetChain = {
  event?: SelectedEvent;
  phase?: SelectedPhase;
  phaseGroup?: SelectedPhaseGroup;
};

export type ContextSlot = {
  displayNames: string[];
  ports: number[];
  prefixes: string[];
  pronouns: string[];
  score: number;
};

// in game 1 port order
export type ContextScore = {
  slots: [ContextSlot, ContextSlot];
};

export type ContextPlayer = {
  name: string;
  characters: string[];
};

// in bracket schema order
export type ContextPlayers = {
  entrant1: ContextPlayer[];
  entrant2: ContextPlayer[];
};

export type Context = {
  bestOf: number;
  durationMs: number;
  scores: ContextScore[];
  finalScore: ContextScore;
  players: ContextPlayers;
  startgg?: {
    tournament: {
      name: string;
      location: string;
    };
    event: SelectedEvent;
    phase: SelectedPhase;
    phaseGroup: SelectedPhaseGroup;
    set: {
      id?: Id;
      fullRoundText: string;
      ordinal: number | null;
      round: number;
      stream: Stream | null;
    };
  };
  challonge?: {
    tournament: {
      name: string;
      slug: string;
      // can be 'swiss' or 'round robin' among others
      tournamentType: string;
    };
    set: {
      id?: string;
      fullRoundText: string;
      ordinal: number | null;
      round: number;
      stream: Stream | null;
    };
  };
  startMs: number;
};

export type CopySettings = {
  output: Output;
  writeContext: boolean;
  writeDisplayNames: boolean;
  writeFileNames: boolean;
  writeStartTimes: boolean;
};

export type ReportSettings = {
  alsoCopy: boolean;
  alsoDelete: boolean;
};

export enum Mode {
  MANUAL = 'manual',
  STARTGG = 'start.gg',
  CHALLONGE = 'challonge',
  PARRYGG = 'parry.gg',
  OFFLINE_MODE = 'offline mode',
}

export type NameWithHighlight = {
  highlight?: {
    start: number;
    end: number;
  };
  name: string;
};

export type SetWithNames = {
  set: Set;
  entrant1Names: NameWithHighlight[];
  entrant2Names: NameWithHighlight[];
};

export enum GuideState {
  NONE,
  SET,
  REPLAYS,
  PLAYERS,
}

export type CopyHostOrClient = {
  address: string;
  name: string;
};

export enum EnforcerSetting {
  NONE,
  LOG_ONLY,
  POP_UP_GOOMWAVE,
  POP_UP_ALL,
}

export type CopyHostFormat = {
  fileNameFormat: string;
  folderNameFormat: string;
  copySettings?: CopySettings;
  enforcerSetting?: EnforcerSetting;
  smuggleCostumeIndex?: boolean;
};

export enum WebSocketServerStatus {
  STOPPED,
  STARTED,
}

export type SlpDownloadStatus =
  | { status: 'idle' }
  | {
      status: 'downloading';
      slpUrls: string[];
      progress: number;
      currentFile: string;
    }
  | { status: 'error'; failedFiles: string[] }
  | { status: 'success' };

export type ParryggBracket = ParryggBracketPb.AsObject & { sets?: Sets };

// Offline Mode
export enum OfflineModeSyncState {
  SYNCED,
  QUEUED,
  LOCAL,
}

export type OfflineModeStation = {
  id: number;
  number: number;
};

export type OfflineModeStream = {
  id: number;
  streamName: string;
  streamSource: string;
};

export type OfflineModeGame = {
  entrant1Score: number | null;
  entrant2Score: number | null;
  stageId: number | null;
};

export type OfflineModeParticipant = {
  id: number;
  connectCode: string;
  discordId: string;
  discordUsername: string;
  gamerTag: string;
  prefix: string;
  pronouns: string;
  userSlug: string;
};

export type OfflineModeSet = {
  id: number;
  setId: number | string;
  ordinal: number;
  fullRoundText: string;
  shortRoundText: string;
  identifier: string;
  round: number;
  state: number;
  entrant1Id: number | null;
  entrant1Name: string | null;
  entrant1Participants: OfflineModeParticipant[];
  entrant1PrereqStr: string | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Name: string | null;
  entrant2Participants: OfflineModeParticipant[];
  entrant2PrereqStr: string | null;
  entrant2Score: number | null;
  games: OfflineModeGame[];
  winnerId: number | null;
  updatedAt: number;
  completedAt: number | null;
  station: OfflineModeStation | null;
  stream: OfflineModeStream | null;
  syncState: OfflineModeSyncState;
};

export type OfflineModePool = {
  id: number;
  name: string;
  bracketType: number;
  waveId: number | null;
  winnersTargetPhaseId: number | null;
  sets: OfflineModeSet[];
};

export type OfflineModePhase = {
  id: number;
  name: string;
  pools: OfflineModePool[];
  phaseOrder: number;
};

export type OfflineModeEvent = {
  id: number;
  name: string;
  slug: string;
  isOnline: boolean;
  videogameId: number;
  phases: OfflineModePhase[];
};

export type OfflineModeTournament = {
  id: number;
  name: string;
  slug: string;
  location: string;
  events: OfflineModeEvent[];
  participants: OfflineModeParticipant[];
  stations: OfflineModeStation[];
  streams: OfflineModeStream[];
};

export type RendererOfflineModePool = Omit<OfflineModePool, 'sets'> & {
  sets: Sets;
};
export type RendererOfflineModePhase = Omit<OfflineModePhase, 'pools'> & {
  pools: RendererOfflineModePool[];
};
export type RendererOfflineModeEvent = Omit<OfflineModeEvent, 'phases'> & {
  phases: RendererOfflineModePhase[];
};
export type RendererOfflineModeTournament = Omit<
  OfflineModeTournament,
  'events' | 'streams'
> & {
  events: RendererOfflineModeEvent[];
  streams: Stream[];
};

export type OfflineModeStatus = {
  address: string;
  error: string;
};
