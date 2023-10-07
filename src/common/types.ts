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
