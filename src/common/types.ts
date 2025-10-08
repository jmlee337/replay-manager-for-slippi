export type PlayerOverrides = {
  displayName: string;
  entrantId: number;
  participantId: number;
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
  id: number;
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
  entrant1Score: number;
  entrant2Score: number;
};

export type Set = {
  id: number | string;
  state: State;
  round: number;
  fullRoundText: string;
  winnerId: number | null;
  entrant1Id: number;
  entrant1Participants: Participant[];
  entrant1Score: number | null;
  entrant2Id: number;
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
  isOnline: boolean;
  state: State;
  phases: Phase[];
};

export type Tournament = {
  slug: string;
  name: string;
  location: string;
  events: Event[];
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
  entrantId: number;
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
  setId: number | string;
  winnerId: number;
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
  id: number;
  name: string;
  slug: string;
  hasSiblings: boolean;
};

export type SelectedPhase = {
  id: number;
  name: string;
  hasSiblings: boolean;
};

export type SelectedPhaseGroup = {
  id: number;
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
      id?: number | string;
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
      id?: number;
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
