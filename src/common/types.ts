export type PlayerOverrides = {
  displayName: string;
  entrantId: number;
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

export type Set = {
  id: number;
  state: number;
  fullRoundText: string;
  winnerId: number | null;
  entrant1Id: number;
  entrant1Names: string[];
  entrant1Score: string | null;
  entrant2Id: number;
  entrant2Names: string[];
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
  phases: Phase[];
};

export type Tournament = {
  slug: string;
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
