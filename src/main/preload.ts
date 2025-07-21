import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import {
  AdminedTournament,
  ChallongeMatchItem,
  ChallongeTournament,
  Context,
  CopySettings,
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
  WebSocketServerStatus,
  CopyHostOrClient,
  EnforceState,
  EnforcerSetting,
  CopyHostFormat,
  Stream,
  EnforcePlayerFailure,
  Station,
  RendererWave,
} from '../common/types';

const electronHandler = {
  getReplaysDir: (): Promise<string> => ipcRenderer.invoke('getReplaysDir'),
  chooseReplaysDir: (): Promise<string> =>
    ipcRenderer.invoke('chooseReplaysDir'),
  getTrashDir: (): Promise<string> => ipcRenderer.invoke('getTrashDir'),
  chooseTrashDir: (): Promise<string> => ipcRenderer.invoke('chooseTrashDir'),
  clearTrashDir: (): Promise<void> => ipcRenderer.invoke('clearTrashDir'),
  deleteReplaysDir: (): Promise<boolean> =>
    ipcRenderer.invoke('deleteReplaysDir'),
  deleteSelectedReplays: (replayPaths: string[]): Promise<void> =>
    ipcRenderer.invoke('deleteSelectedReplays', replayPaths),
  maybeEject: (): Promise<boolean> => ipcRenderer.invoke('maybeEject'),
  getReplaysInDir: (): Promise<{
    replays: Replay[];
    invalidReplays: InvalidReplay[];
    replayLoadCount: number;
  }> => ipcRenderer.invoke('getReplaysInDir'),
  writeReplays: (
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
      fileNames,
      output,
      replays,
      startTimes,
      subdir,
      writeDisplayNames,
      context,
    ),
  appendEnforcerResult: (str: String): Promise<void> =>
    ipcRenderer.invoke('appendEnforcerResult', str),
  getCopyDir: (): Promise<string> => ipcRenderer.invoke('getCopyDir'),
  chooseCopyDir: (): Promise<string> => ipcRenderer.invoke('chooseCopyDir'),
  getCopyHost: (): Promise<CopyHostOrClient> =>
    ipcRenderer.invoke('getCopyHost'),
  getCopyHostFormat: (): Promise<CopyHostFormat> =>
    ipcRenderer.invoke('getCopyHostFormat'),
  startListeningForHosts: (): Promise<string> =>
    ipcRenderer.invoke('startListeningForHosts'),
  stopListeningForHosts: (): Promise<void> =>
    ipcRenderer.invoke('stopListeningForHosts'),
  onCopyHosts: (
    callback: (event: IpcRendererEvent, hosts: CopyHostOrClient[]) => void,
  ) => {
    ipcRenderer.removeAllListeners('copyHosts');
    ipcRenderer.on('copyHosts', callback);
  },
  connectToHost: (address: string): Promise<void> =>
    ipcRenderer.invoke('connectToHost', address),
  disconnectFromHost: (): Promise<void> =>
    ipcRenderer.invoke('disconnectFromHost'),
  onCopyHost: (
    callback: (event: IpcRendererEvent, host: CopyHostOrClient) => void,
  ) => {
    ipcRenderer.removeAllListeners('copyHost');
    ipcRenderer.on('copyHost', callback);
  },
  onCopyHostFormat: (
    callback: (event: IpcRendererEvent, hostFormat: CopyHostFormat) => void,
  ) => {
    ipcRenderer.removeAllListeners('copyHostFormat');
    ipcRenderer.on('copyHostFormat', callback);
  },
  getCopyClients: (): Promise<CopyHostOrClient[]> =>
    ipcRenderer.invoke('getCopyClients'),
  kickCopyClient: (address: string): Promise<void> =>
    ipcRenderer.invoke('kickCopyClient', address),
  startHostServer: (): Promise<string> => ipcRenderer.invoke('startHostServer'),
  stopHostServer: (): Promise<void> => ipcRenderer.invoke('stopHostServer'),
  startBroadcastingHost: (): Promise<string> =>
    ipcRenderer.invoke('startBroadcastingHost'),
  stopBroadcastingHost: (): Promise<void> =>
    ipcRenderer.invoke('stopBroadcastingHost'),
  onCopyClients: (
    callback: (event: IpcRendererEvent, clients: CopyHostOrClient[]) => void,
  ) => {
    ipcRenderer.removeAllListeners('copyClients');
    ipcRenderer.on('copyClients', callback);
  },
  onHostServerStatus: (
    callback: (event: IpcRendererEvent, status: WebSocketServerStatus) => void,
  ) => {
    ipcRenderer.removeAllListeners('hostServerStatus');
    ipcRenderer.on('hostServerStatus', callback);
  },
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
  getTournament: (slugOrShort: string, recursive: boolean): Promise<string> =>
    ipcRenderer.invoke('getTournament', slugOrShort, recursive),
  getEvent: (id: number): Promise<void> => ipcRenderer.invoke('getEvent', id),
  getPhase: (id: number): Promise<void> => ipcRenderer.invoke('getPhase', id),
  getPhaseGroup: (id: number): Promise<void> =>
    ipcRenderer.invoke('getPhaseGroup', id),
  getStreamsAndStations: (): Promise<{
    streams: Stream[];
    stations: Station[];
  }> => ipcRenderer.invoke('getStreamsAndStations'),
  assignStream: (originalSet: Set, streamId: number): Promise<void> =>
    ipcRenderer.invoke('assignStream', originalSet, streamId),
  assignStation: (originalSet: Set, stationId: number): Promise<void> =>
    ipcRenderer.invoke('assignStation', originalSet, stationId),
  resetSet: (id: number): Promise<void> => ipcRenderer.invoke('resetSet', id),
  startSet: (originalSet: Set): Promise<void> =>
    ipcRenderer.invoke('startSet', originalSet),
  reportSet: (set: StartggSet, originalSet: Set): Promise<Set> =>
    ipcRenderer.invoke('reportSet', set, originalSet),
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
  getUseLAN: (): Promise<boolean> => ipcRenderer.invoke('getUseLAN'),
  setUseLAN: (useLAN: boolean): Promise<void> =>
    ipcRenderer.invoke('setUseLAN', useLAN),
  getEnforcerSetting: (): Promise<EnforcerSetting> =>
    ipcRenderer.invoke('getEnforcerSetting'),
  setEnforcerSetting: (enforcerSetting: EnforcerSetting): Promise<void> =>
    ipcRenderer.invoke('setEnforcerSetting', enforcerSetting),
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
  getSmuggleCostumeIndex: (): Promise<boolean> =>
    ipcRenderer.invoke('getSmuggleCostumeIndex'),
  setSmuggleCostumeIndex: (smuggleCostumeIndex: boolean) =>
    ipcRenderer.invoke('setSmuggleCostumeIndex', smuggleCostumeIndex),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  onEnforceState: (
    callback: (
      event: IpcRendererEvent,
      enforceState: EnforceState,
      replayLoadCount: number,
    ) => void,
  ) => {
    ipcRenderer.removeAllListeners('enforceState');
    ipcRenderer.on('enforceState', callback);
  },
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
  onUsb: (
    callback: (
      event: IpcRendererEvent,
      newDir: string,
      newIsUsb: boolean,
    ) => void,
  ) => {
    ipcRenderer.removeAllListeners('usbstorage');
    ipcRenderer.on('usbstorage', callback);
  },
  update: (): Promise<void> => ipcRenderer.invoke('update'),
  isMac: process.platform === 'darwin',

  // enforcer
  sendEnforcerResults: (
    results: {
      fileName: string;
      playerFailures: EnforcePlayerFailure[];
    }[],
    enforcerReplayLoadCount: number,
  ): void =>
    ipcRenderer.send('sendEnforcerResults', results, enforcerReplayLoadCount),
  sendEnforcerError: (e: any, enforcerReplayLoadCount: number): void =>
    ipcRenderer.send('sendEnforcerError', e, enforcerReplayLoadCount),
  onEnforcer: (
    callback: (
      event: IpcRendererEvent,
      replays: { fileName: string; buffer: ArrayBuffer }[],
      replayLoadCount: number,
    ) => void,
  ) => {
    ipcRenderer.removeAllListeners('enforcer');
    ipcRenderer.on('enforcer', callback);
  },

  // entrants
  openEntrantsWindow: (): void => ipcRenderer.send('openEntrantsWindow'),
  getPoolsByWave: (): Promise<RendererWave[]> =>
    ipcRenderer.invoke('getPoolsByWave'),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
