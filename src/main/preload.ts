import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import {
  Context,
  CopySettings,
  EnforceResult,
  Event,
  Output,
  Phase,
  PhaseGroup,
  Replay,
  ReportSettings,
  Set,
  Sets,
  StartggSet,
} from '../common/types';

export type Channels = 'ipc-example';

const electronHandler = {
  chooseReplaysDir: (): Promise<string> =>
    ipcRenderer.invoke('chooseReplaysDir'),
  deleteReplaysDir: (): Promise<void> => ipcRenderer.invoke('deleteReplaysDir'),
  getReplaysInDir: (): Promise<Replay[]> =>
    ipcRenderer.invoke('getReplaysInDir'),
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
  ): Promise<Sets> => ipcRenderer.invoke('getPhaseGroup', id, updatedSets),
  startSet: (id: number): Promise<Set> => ipcRenderer.invoke('startSet', id),
  reportSet: (set: StartggSet): Promise<Set[]> =>
    ipcRenderer.invoke('reportSet', set),
  updateSet: (set: StartggSet): Promise<Set> =>
    ipcRenderer.invoke('updateSet', set),
  getStartggKey: (): Promise<string> => ipcRenderer.invoke('getStartggKey'),
  setStartggKey: (startggKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggKey', startggKey),
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
  getCopySettings: (): Promise<CopySettings> =>
    ipcRenderer.invoke('getCopySettings'),
  setCopySettings: (copySettings: CopySettings): Promise<void> =>
    ipcRenderer.invoke('setCopySettings', copySettings),
  getReportSettings: (): Promise<ReportSettings> =>
    ipcRenderer.invoke('getReportSettings'),
  setReportSettings: (reportSettings: ReportSettings): Promise<void> =>
    ipcRenderer.invoke('setReportSettings', reportSettings),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  getLatestVersion: (): Promise<string> =>
    ipcRenderer.invoke('getLatestVersion'),
  onUsb: (callback: (event: IpcRendererEvent, newDir: string) => void) => {
    ipcRenderer.removeAllListeners('usbstorage');
    ipcRenderer.on('usbstorage', callback);
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
