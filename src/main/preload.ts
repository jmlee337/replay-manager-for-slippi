import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import {
  AdminedTournament,
  ChallongeMatchItem,
  ChallongeTournament,
  Context,
  CopySettings,
  EnforceResult,
  InvalidReplay,
  Mode,
  Output,
  Replay,
  ReportSettings,
  SelectedEvent,
  SelectedPhase,
  SelectedPhaseGroup,
  Set,
  StartggSet,
  Tournament,
} from '../common/types';

const electronHandler = {
  getReplaysDir: (): Promise<string> => ipcRenderer.invoke('getReplaysDir'),
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
  getCopyDir: (): Promise<string> => ipcRenderer.invoke('getCopyDir'),
  chooseCopyDir: (): Promise<string> => ipcRenderer.invoke('chooseCopyDir'),
  getCurrentTournament: (): Promise<Tournament | undefined> =>
    ipcRenderer.invoke('getCurrentTournament'),
  getSelectedSet: (): Promise<Set | undefined> =>
    ipcRenderer.invoke('getSelectedSet'),
  getSelectedSetChain: (): Promise<{
    event?: SelectedEvent;
    phase?: SelectedPhase;
    phaseGroup?: SelectedPhaseGroup;
  }> => ipcRenderer.invoke('getSelectedSetChain'),
  setSelectedSetChain: (
    eventId: number,
    phaseId: number,
    phaseGroupId: number,
  ): Promise<void> =>
    ipcRenderer.invoke('setSelectedSetChain', eventId, phaseId, phaseGroupId),
  getTournament: (slug: string, recursive: boolean): Promise<void> =>
    ipcRenderer.invoke('getTournament', slug, recursive),
  getEvent: (id: number, recursive: boolean): Promise<void> =>
    ipcRenderer.invoke('getEvent', id, recursive),
  getPhase: (id: number, recursive: boolean): Promise<void> =>
    ipcRenderer.invoke('getPhase', id, recursive),
  getPhaseGroup: (id: number): Promise<void> =>
    ipcRenderer.invoke('getPhaseGroup', id),
  startSet: (id: number | string): Promise<void> =>
    ipcRenderer.invoke('startSet', id),
  reportSet: (set: StartggSet): Promise<Set> =>
    ipcRenderer.invoke('reportSet', set),
  updateSet: (set: StartggSet): Promise<Set> =>
    ipcRenderer.invoke('updateSet', set),
  getMode: (): Promise<Mode> => ipcRenderer.invoke('getMode'),
  setMode: (mode: Mode): Promise<void> => ipcRenderer.invoke('setMode', mode),
  getStartggKey: (): Promise<string> => ipcRenderer.invoke('getStartggKey'),
  setStartggKey: (startggKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggKey', startggKey),
  getChallongeKey: (): Promise<string> => ipcRenderer.invoke('getChallongeKey'),
  setChallongeKey: (challongeKey: string): Promise<void> =>
    ipcRenderer.invoke('setChallongeKey', challongeKey),
  getCurrentChallongeTournaments: (): Promise<
    Map<string, ChallongeTournament>
  > => ipcRenderer.invoke('getCurrentChallongeTournaments'),
  getSelectedChallongeTournament: (): Promise<
    ChallongeTournament | undefined
  > => ipcRenderer.invoke('getSelectedChallongeTournament'),
  setSelectedChallongeTournament: (slug: string): Promise<void> =>
    ipcRenderer.invoke('setSelectedChallongeTournament', slug),
  getChallongeTournament: (slug: string): Promise<void> =>
    ipcRenderer.invoke('getChallongeTournament', slug),
  startChallongeSet: (slug: string, id: number): Promise<void> =>
    ipcRenderer.invoke('startChallongeSet', slug, id),
  reportChallongeSet: (
    slug: string,
    id: number,
    items: ChallongeMatchItem[],
  ): Promise<Set> => ipcRenderer.invoke('reportChallongeSet', slug, id, items),
  getTournaments: (): Promise<AdminedTournament[]> =>
    ipcRenderer.invoke('getTournaments'),
  getManualNames: (): Promise<string[]> => ipcRenderer.invoke('getManualNames'),
  setManualNames: (names: string[]): Promise<void> =>
    ipcRenderer.invoke('setManualNames', names),
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
  onTournament: (
    callback: (
      event: IpcRendererEvent,
      data: {
        selectedSet?: Set;
        startggTournament?: Tournament;
        challongeTournaments?: Map<string, ChallongeTournament>;
      },
    ) => void,
    selectedSetId: number | string,
  ) => {
    ipcRenderer.removeAllListeners('tournament');
    ipcRenderer.on('tournament', callback);
    ipcRenderer.invoke('setSelectedSetId', selectedSetId);
  },
  onUsb: (callback: (event: IpcRendererEvent, newDir: string) => void) => {
    ipcRenderer.removeAllListeners('usbstorage');
    ipcRenderer.on('usbstorage', callback);
  },
  update: (): Promise<void> => ipcRenderer.invoke('update'),
  isMac: process.platform === 'darwin',
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
