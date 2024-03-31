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
  isTeams: boolean;
  isValid: boolean;
  lastFrame: number;
  players: Player[];
  selected: boolean;
  stageId: number;
  startAt: string;
};

export type Participant = {
  displayName: string;
  prefix: string;
  pronouns: string;
};

export type Set = {
  id: number;
  state: number;
  round: number;
  fullRoundText: string;
  winnerId: number | null;
  entrant1Id: number;
  entrant1Participants: Participant[];
  entrant1Score: string | null;
  entrant2Id: number;
  entrant2Participants: Participant[];
  entrant2Score: string | null;
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
  phases: Phase[];
};

export type Tournament = {
  slug: string;
  name: string;
  events: Event[];
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
  game: number;
  slots: ContextSlot[];
};

export type Context = {
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
    bestOf: number;
    fullRoundText: string;
    round: number;
    scores: ContextScore[];
  };
};
