export type PlayerOverrides = {
  displayName: string;
  entrantId: number;
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
  overrideWin: boolean;
  playerOverrides: PlayerOverrides;
  playerType: number;
  port: number;
  teamId: number; // 0: red, 1: blue, 2: green, else not teams
};

export type Replay = {
  fileName: string;
  filePath: string;
  invalidReasons: string[];
  isTeams: boolean;
  lastFrame: number;
  players: Player[];
  selected: boolean;
  stageId: number;
  startAt?: Date;
};

export type InvalidReplay = {
  fileName: string;
  invalidReason: string;
};

export type Participant = {
  displayName: string;
  prefix: string;
  pronouns: string;
};

export enum State {
  PENDING = 1,
  STARTED = 2,
  COMPLETED = 3,
  CALLED = 6,
}

export type Set = {
  id: number;
  state: State;
  round: number;
  fullRoundText: string;
  winnerId: number | null;
  entrant1Id: number;
  entrant1Participants: Participant[];
  entrant1Score: string | null;
  entrant2Id: number;
  entrant2Participants: Participant[];
  entrant2Score: string | null;
  twitchStream: string | null;
  ordinal: number | null;
  wasReported: boolean;
};

export type Sets = {
  pendingSets: Set[];
  completedSets: Set[];
};

export type PhaseGroup = {
  id: number;
  name: string;
  sets: Sets;
};

export type Phase = {
  id: number;
  name: string;
  phaseGroups: PhaseGroup[];
};

export type Event = {
  id: number;
  name: string;
  slug: string;
  isDoubles: boolean;
  phases: Phase[];
};

export type Tournament = {
  slug: string;
  name: string;
  events: Event[];
};

export type AdminedTournament = {
  slug: string;
  name: string;
};

export type ChallongeTournament = {
  name: string;
  slug: string;
  sets: Sets;
};

export type StartggGameSelection = {
  characterId: number;
  entrantId: number;
};

export type StartggGame = {
  // 1-indexed
  gameNum: number;
  selections: StartggGameSelection[];
  stageId: number | undefined;
  winnerId: number;
};

export type StartggSet = {
  setId: number;
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
  displayName: string | undefined;
  port: number;
};

export type EnforceResult = {
  fileName: string;
  playerFailures: EnforcePlayerFailure[];
};

export type ContextSlot = {
  displayNames: string[];
  ports: number[];
  prefixes: string[];
  pronouns: string[];
  score: number;
};

export type ContextScore = {
  // slots.length === 2
  slots: [ContextSlot, ContextSlot];
};

export type Context = {
  bestOf: number;
  durationMs: number;
  scores: ContextScore[];
  startgg?: {
    tournament: {
      name: string;
    };
    event: {
      id: number;
      name: string;
      slug: string;
    };
    phase: {
      id: number;
      name: string;
    };
    phaseGroup: {
      id: number;
      name: string;
    };
    set: {
      id: number;
      fullRoundText: string;
      round: number;
      twitchStream: string | null;
    };
  };
  challonge?: {
    tournament: {
      name: string;
      slug: string;
    };
    set: {
      id: number;
      fullRoundText: string;
      round: number;
      ordinal: number;
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
