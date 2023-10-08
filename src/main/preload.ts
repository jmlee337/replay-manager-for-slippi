import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  OpenDialogReturnValue,
} from 'electron';
import { Replay } from '../common/types';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  chooseDir: (): Promise<OpenDialogReturnValue> =>
    ipcRenderer.invoke('chooseDir'),
  getReplaysInDir: (dir: string): Promise<Replay[]> =>
    ipcRenderer.invoke('getReplaysInDir', dir),
  getTournament: (slug: string): Promise<any> =>
    ipcRenderer.invoke('getTournament', slug),
  getEvent: (id: number): Promise<any> => ipcRenderer.invoke('getEvent', id),
  getPhase: (id: number): Promise<any> => ipcRenderer.invoke('getPhase', id),
  getPhaseGroup: (id: number): Promise<any> =>
    ipcRenderer.invoke('getPhaseGroup', id),
  getStartggKey: (): Promise<string> => ipcRenderer.invoke('getStartggKey'),
  setStartggKey: (startggKey: string): Promise<void> =>
    ipcRenderer.invoke('setStartggKey', startggKey),
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
