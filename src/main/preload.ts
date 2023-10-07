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
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
