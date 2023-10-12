import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import Store from 'electron-store';
import { Replay, StartggSet } from '../common/types';
import {
  getEvent,
  getPhase,
  getPhaseGroup,
  getTournament,
  reportSet,
} from './startgg';
import { getReplaysInDir, writeReplays } from './replay';

export default function setupIPCs(): void {
  ipcMain.handle('chooseDir', async () =>
    dialog.showOpenDialog({ properties: ['openDirectory', 'showHiddenFiles'] }),
  );
  ipcMain.handle(
    'getReplaysInDir',
    async (event: IpcMainInvokeEvent, dir: string) => {
      return getReplaysInDir(dir);
    },
  );
  ipcMain.handle(
    'writeReplays',
    async (
      event: IpcMainInvokeEvent,
      dir: string,
      fileNames: string[],
      replays: Replay[],
      startTimes: string[],
      subdir: string,
      writeDisplayNames: boolean,
    ) => {
      return writeReplays(
        dir,
        fileNames,
        replays,
        startTimes,
        subdir,
        writeDisplayNames,
      );
    },
  );

  const store = new Store();
  let startggKey = store.get('startggKey') as string;
  ipcMain.handle(
    'getTournament',
    async (event: IpcMainInvokeEvent, slug: string) => getTournament(slug),
  );
  ipcMain.handle('getEvent', async (event: IpcMainInvokeEvent, id: number) =>
    getEvent(id),
  );
  ipcMain.handle('getPhase', async (event: IpcMainInvokeEvent, id: number) =>
    getPhase(id),
  );
  ipcMain.handle(
    'getPhaseGroup',
    async (event: IpcMainInvokeEvent, id: number) => {
      if (!startggKey) {
        throw new Error('Please set start.gg API key');
      }

      return getPhaseGroup(startggKey, id);
    },
  );
  ipcMain.handle(
    'reportSet',
    async (event: IpcMainInvokeEvent, set: StartggSet) => {
      if (!startggKey) {
        throw new Error('Please set start.gg API key');
      }

      return reportSet(startggKey, set);
    },
  );
  ipcMain.handle('getStartggKey', () => store.get('startggKey') as string);
  ipcMain.handle(
    'setStartggKey',
    (event: IpcMainInvokeEvent, newStartggKey: string) => {
      store.set('startggKey', newStartggKey);
      startggKey = newStartggKey;
    },
  );
}
