import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  IpcMainInvokeEvent,
} from 'electron';
import Store from 'electron-store';
import { rm } from 'fs/promises';
import detectUsb from 'detect-usb';
import { Output, Replay, StartggSet } from '../common/types';
import {
  getEvent,
  getPhase,
  getPhaseGroup,
  getTournament,
  reportSet,
} from './startgg';
import { getReplaysInDir, writeReplays } from './replay';

export default function setupIPCs(mainWindow: BrowserWindow): void {
  let chosenDir = '';
  const usbCallback = (data: any) => {
    if (
      (data.event === 'eject' || data.data.isAccessible) &&
      chosenDir.startsWith(data.data.key)
    ) {
      mainWindow.webContents.send('usbstorage');
    }
  };
  detectUsb.startListening();
  detectUsb.removeAllListeners('insert');
  detectUsb.on('insert', usbCallback);
  detectUsb.removeAllListeners('eject');
  detectUsb.on('eject', usbCallback);

  ipcMain.removeHandler('chooseDir');
  ipcMain.handle('chooseDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return '';
    }
    [chosenDir] = openDialogRes.filePaths;
    return chosenDir;
  });

  ipcMain.removeHandler('deleteDir');
  ipcMain.handle('deleteDir', async () => rm(chosenDir, { recursive: true }));

  ipcMain.removeHandler('getReplaysInDir');
  ipcMain.handle('getReplaysInDir', async () => getReplaysInDir(chosenDir));

  ipcMain.removeHandler('writeReplays');
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

  ipcMain.removeHandler('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event: IpcMainInvokeEvent, slug: string) => getTournament(slug),
  );

  ipcMain.removeHandler('getEvent');
  ipcMain.handle('getEvent', async (event: IpcMainInvokeEvent, id: number) =>
    getEvent(id),
  );

  ipcMain.removeHandler('getPhase');
  ipcMain.handle('getPhase', async (event: IpcMainInvokeEvent, id: number) =>
    getPhase(id),
  );

  ipcMain.removeHandler('getPhaseGroup');
  ipcMain.handle(
    'getPhaseGroup',
    async (event: IpcMainInvokeEvent, id: number) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return getPhaseGroup(sggApiKey, id);
    },
  );

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    async (event: IpcMainInvokeEvent, set: StartggSet) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return reportSet(sggApiKey, set);
    },
  );

  ipcMain.removeHandler('getStartggKey');
  ipcMain.handle('getStartggKey', () => sggApiKey);

  ipcMain.removeHandler('setStartggKey');
  ipcMain.handle(
    'setStartggKey',
    (event: IpcMainInvokeEvent, newSggApiKey: string) => {
      store.set('sggApiKey', newSggApiKey);
      sggApiKey = newSggApiKey;
    },
  );

  ipcMain.removeHandler('copyToClipboard');
  ipcMain.handle(
    'copyToClipboard',
    (event: IpcMainInvokeEvent, text: string) => {
      clipboard.writeText(text);
    },
  );

  ipcMain.removeHandler('getVersion');
  ipcMain.handle('getVersion', () => app.getVersion());
}
