import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import {
  AdminedTournament,
  ChallongeMatchItem,
  ChallongeTournament,
  Context,
  CopySettings,
  EnforceResult,
  Entrant,
  Event,
  InvalidReplay,
  Mode,
  Output,
  Phase,
  PhaseGroup,
  Replay,
  ReportSettings,
  Set,
  Sets,
  StartggSet,
} from '../common/types';

const electronHandler = {
  chooseReplaysDir: (): Promise<string> =>
    ipcRenderer.invoke('chooseReplaysDir'),
  deleteReplaysDir: (): Promise<void> => ipcRenderer.invoke('deleteReplaysDir'),
  getReplaysInDir: (): Promise<{
    replays: Replay[];
    invalidReplays: InvalidReplay[];
  }> => ipcRenderer.invoke('getReplaysInDir'),
  writeReplays: (
    dir: string,
    fileNames: string[],
    output: Output,
    replays: Replay[],
    startTimes: string[],
    subdir: string,
    writeDisplayNames: boolean,
    context: Context | undefined,
  ): Promise<void> =>
    ipcRenderer.invoke(
      'writeReplays',
      dir,
      fileNames,
      output,
      replays,
      startTimes,
      subdir,
      writeDisplayNames,
      context,
    ),
  enforceReplays: (replays: Replay[]): Promise<EnforceResult[]> =>
    ipcRenderer.invoke('enforceReplays', replays),
  chooseCopyDir: (): Promise<string> => ipcRenderer.invoke('chooseCopyDir'),
  getTournament: (slug: string): Promise<{ name: string; events: Event[] }> =>
    ipcRenderer.invoke('getTournament', slug),
  getEvent: (id: number): Promise<Phase[]> =>
    ipcRenderer.invoke('getEvent', id),
  getPhase: (id: number): Promise<PhaseGroup[]> =>
    ipcRenderer.invoke('getPhase', id),
  getPhaseGroup: (
    id: number,
    isDoubles: boolean,
    updatedSets?: Map<number, Set>,
  ): Promise<Sets> =>
    ipcRenderer.invoke('getPhaseGroup', id, isDoubles, updatedSets),
  startSet: (id: number): Promise<Set> => ipcRenderer.invoke('startSet', id),
  reportSet: (set: StartggSet): Promise<Set[]> =>
    ipcRenderer.invoke('reportSet', set),
  updateSet: (set: StartggSet): Promise<Set> =>
    ipcRenderer.invoke('updateSet', set),
  getPhaseGroupEntrants: (id: number): Promise<Entrant[]> =>
    ipcRenderer.invoke('getPhaseGroupEntrants', id),
  getMode: (): Promise<Mode> => ipcRenderer.invoke('getMode'),
  setMode: (mode: Mode): Promise<void> => ipcRenderer.invoke('setMode', mode),
  getStartggKey: (): Promise<string> => ipcRenderer.invoke('getStartggKey'),
  setStartggKey: (startggKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggKey', startggKey),
  getChallongeKey: (): Promise<string> => ipcRenderer.invoke('getChallongeKey'),
  setChallongeKey: (challongeKey: string): Promise<void> =>
    ipcRenderer.invoke('setChallongeKey', challongeKey),
  getChallongeTournament: (slug: string): Promise<ChallongeTournament> =>
    ipcRenderer.invoke('getChallongeTournament', slug),
  startChallongeSet: (slug: string, id: number): Promise<Set> =>
    ipcRenderer.invoke('startChallongeSet', slug, id),
  reportChallongeSet: (
    slug: string,
    id: number,
    items: ChallongeMatchItem[],
  ): Promise<Set> => ipcRenderer.invoke('reportChallongeSet', slug, id, items),
  getTournaments: (): Promise<AdminedTournament[]> =>
    ipcRenderer.invoke('getTournaments'),
  getAutoDetectUsb: (): Promise<boolean> =>
    ipcRenderer.invoke('getAutoDetectUsb'),
  setAutoDetectUsb: (autoDetectUsb: boolean): Promise<void> =>
    ipcRenderer.invoke('setAutoDetectUsb', autoDetectUsb),
  getScrollToBottom: (): Promise<boolean> =>
    ipcRenderer.invoke('getScrollToBottom'),
  setScrollToBottom: (scrollToBottom: boolean): Promise<void> =>
    ipcRenderer.invoke('setScrollToBottom', scrollToBottom),
  getUseEnforcer: (): Promise<boolean> => ipcRenderer.invoke('getUseEnforcer'),
  setUseEnforcer: (useEnforcer: boolean): Promise<void> =>
    ipcRenderer.invoke('setUseEnforcer', useEnforcer),
  getFileNameFormat: (): Promise<string> =>
    ipcRenderer.invoke('getFileNameFormat'),
  setFileNameFormat: (fileNameFormat: string): Promise<void> =>
    ipcRenderer.invoke('setFileNameFormat', fileNameFormat),
  resetFileNameFormat: (): Promise<string> =>
    ipcRenderer.invoke('resetFileNameFormat'),
  getFolderNameFormat: (): Promise<string> =>
    ipcRenderer.invoke('getFolderNameFormat'),
  setFolderNameFormat: (folderNameFormat: string): Promise<void> =>
    ipcRenderer.invoke('setFolderNameFormat', folderNameFormat),
  resetFolderNameFormat: (): Promise<string> =>
    ipcRenderer.invoke('resetFolderNameFormat'),
  getCopySettings: (): Promise<CopySettings> =>
    ipcRenderer.invoke('getCopySettings'),
  setCopySettings: (copySettings: CopySettings): Promise<void> =>
    ipcRenderer.invoke('setCopySettings', copySettings),
  getReportSettings: (): Promise<ReportSettings> =>
    ipcRenderer.invoke('getReportSettings'),
  setReportSettings: (reportSettings: ReportSettings): Promise<void> =>
    ipcRenderer.invoke('setReportSettings', reportSettings),
  getVlerkMode: (): Promise<boolean> => ipcRenderer.invoke('getVlerkMode'),
  setVlerkMode: (vlerkMode: boolean): Promise<void> =>
    ipcRenderer.invoke('setVlerkMode', vlerkMode),
  getGuidedMode: (): Promise<boolean> => ipcRenderer.invoke('getGuidedMode'),
  setGuidedMode: (guidedMode: boolean): Promise<void> =>
    ipcRenderer.invoke('setGuidedMode', guidedMode),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  onUsb: (callback: (event: IpcRendererEvent, newDir: string) => void) => {
    ipcRenderer.removeAllListeners('usbstorage');
    ipcRenderer.on('usbstorage', callback);
  },
  isMac: process.platform === 'darwin',
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
