export type LuckyJob = {
  id: string;
  tournament: string;
  setId: string;
  fingerprint: string;
  idempotencyKey?: string;
  files: { path: string; size: number; sha256: string }[];
  status:
    | 'pending'
    | 'uploading'
    | 'staged'
    | 'superseded'
    | 'blocked'
    | 'cancelled';
  sentBytes: number;
  attempts: number;
  retryAt: number;
  error?: string;
  uploadId?: string;
  tournamentUploadId?: string;
};
export type LuckyProgress = {
  status: string;
  pollAfterSeconds: number | null;
  imports: {
    importRunId: string;
    import: {
      percent: number | null;
      importedSets: number;
      importedGames: number;
      phase: string;
    };
    analytics: {
      state: string;
      percent: number | null;
      readySets: number;
      totalSets: number;
      coverageComplete: boolean;
    };
    skipped: { reason: string }[];
  }[];
};
export type LuckyBatch = {
  id: string;
  tournament: string;
  finalized: boolean;
  finishing?: boolean;
  progress?: LuckyProgress;
  error?: string;
  pollAt: number;
};
export type LuckySnapshot = {
  connected: boolean;
  enabled: boolean;
  jobs: LuckyJob[];
  batches: LuckyBatch[];
  error?: string;
};
