import { contextBridge, ipcRenderer } from 'electron';
import {
  Event,
  Output,
  Phase,
  PhaseGroup,
  Replay,
  Sets,
  StartggSet,
} from '../common/types';

export type Channels = 'ipc-example';

const electronHandler = {
  chooseDir: (): Promise<string> => ipcRenderer.invoke('chooseDir'),
  deleteDir: (): Promise<void> => ipcRenderer.invoke('deleteDir'),
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
    ),
  getTournament: (slug: string): Promise<Event[]> =>
    ipcRenderer.invoke('getTournament', slug),
  getEvent: (id: number): Promise<Phase[]> =>
    ipcRenderer.invoke('getEvent', id),
  getPhase: (id: number): Promise<PhaseGroup[]> =>
    ipcRenderer.invoke('getPhase', id),
  getPhaseGroup: (id: number): Promise<Sets> =>
    ipcRenderer.invoke('getPhaseGroup', id),
  reportSet: (set: StartggSet): Promise<void> =>
    ipcRenderer.invoke('reportSet', set),
  getStartggKey: (): Promise<string> => ipcRenderer.invoke('getStartggKey'),
  setStartggKey: (startggKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggKey', startggKey),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('copyToClipboard', text),
  getVersion: (): Promise<string> => ipcRenderer.invoke('getVersion'),
  onUsb: (callback: () => void) => {
    ipcRenderer.removeAllListeners('usbstorage');
    ipcRenderer.on('usbstorage', callback);
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
