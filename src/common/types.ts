export type Player = {
  connectCode: string;
  costumeIndex: number;
  displayName: string;
  externalCharacterId: number;
  isWinner: boolean;
  nametag: string;
  playerType: number;
  port: number;
  teamId: number;
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

export type Event = {
  id: number;
  name: string;
};

export type Phase = {
  id: number;
  name: string;
};

export type PhaseGroup = {
  id: number;
  name: string;
};

export type Set = {
  id: number;
  state: number;
  fullRoundText: string;
  winnerId: number;
  entrant1Id: number;
  entrant1Name: string;
  entrant1Score: string | null;
  entrant2Id: number;
  entrant2Name: string;
  entrant2Score: string | null;
};
