import { app, clipboard, dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import Store from 'electron-store';
import { rm } from 'fs/promises';
import { Output, Replay, StartggSet } from '../common/types';
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
    'deleteDir',
    async (event: IpcMainInvokeEvent, dir: string) => {
      return rm(dir, { recursive: true });
    },
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
      output: Output,
      replays: Replay[],
      startTimes: string[],
      subdir: string,
      writeDisplayNames: boolean,
    ) => {
      return writeReplays(
        dir,
        fileNames,
        output,
        replays,
        startTimes,
        subdir,
        writeDisplayNames,
      );
    },
  );

  const store = new Store();
  let sggApiKey = store.has('sggApiKey')
    ? (store.get('sggApiKey') as string)
    : '';
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
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return getPhaseGroup(sggApiKey, id);
    },
  );
  ipcMain.handle(
    'reportSet',
    async (event: IpcMainInvokeEvent, set: StartggSet) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return reportSet(sggApiKey, set);
    },
  );
  ipcMain.handle('getStartggKey', () => sggApiKey);
  ipcMain.handle(
    'setStartggKey',
    (event: IpcMainInvokeEvent, newSggApiKey: string) => {
      store.set('sggApiKey', newSggApiKey);
      sggApiKey = newSggApiKey;
    },
  );
  ipcMain.handle(
    'copyToClipboard',
    (event: IpcMainInvokeEvent, text: string) => {
      clipboard.writeText(text);
    },
  );
  ipcMain.handle('getVersion', () => app.getVersion());
}
