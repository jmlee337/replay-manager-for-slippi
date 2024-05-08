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
import path from 'path';
import {
  Context,
  CopySettings,
  Mode,
  Output,
  Replay,
  ReportSettings,
  Set,
  StartggSet,
} from '../common/types';
import {
  getEvent,
  getPhase,
  getPhaseGroup,
  getTournament,
  startSet,
  reportSet,
  updateSet,
} from './startgg';
import { enforceReplays, getReplaysInDir, writeReplays } from './replay';

export default function setupIPCs(mainWindow: BrowserWindow): void {
  const store = new Store();
  let autoDetectUsb = store.has('autoDetectUsb')
    ? (store.get('autoDetectUsb') as boolean)
    : true;
  let chosenReplaysDir = '';
  const onInsertEjectFallback = (e: any) => {
    if (
      (e.event === 'eject' || e.data.isAccessible) &&
      chosenReplaysDir.startsWith(e.data.key)
    ) {
      mainWindow.webContents.send('usbstorage', '');
    }
  };
  const knownUsbs: string[] = [];
  const onInsert = (e: any) => {
    if (!autoDetectUsb) {
      onInsertEjectFallback(e);
      return;
    }

    if (e.data.isAccessible) {
      knownUsbs.push(e.data.key);
      chosenReplaysDir = path.join(e.data.key, 'Slippi');
      mainWindow.webContents.send('usbstorage', chosenReplaysDir);
    }
  };
  const onEject = (e: any) => {
    if (!autoDetectUsb) {
      onInsertEjectFallback(e);
      return;
    }

    const i = knownUsbs.findIndex((val) => val === e.data.key);
    if (i >= 0) {
      knownUsbs.splice(i, 1);
      if (chosenReplaysDir.startsWith(e.data.key)) {
        if (knownUsbs.length > 0) {
          chosenReplaysDir = path.join(
            knownUsbs[knownUsbs.length - 1],
            'Slippi',
          );
          mainWindow.webContents.send('usbstorage', chosenReplaysDir);
        } else {
          mainWindow.webContents.send('usbstorage', '');
        }
      }
    }
  };
  detectUsb.removeAllListeners('insert');
  detectUsb.on('insert', onInsert);
  detectUsb.removeAllListeners('eject');
  detectUsb.on('eject', onEject);
  detectUsb.startListening();

  ipcMain.removeHandler('chooseReplaysDir');
  ipcMain.handle('chooseReplaysDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return chosenReplaysDir;
    }
    [chosenReplaysDir] = openDialogRes.filePaths;
    return chosenReplaysDir;
  });

  ipcMain.removeHandler('deleteReplaysDir');
  ipcMain.handle('deleteReplaysDir', async () =>
    rm(chosenReplaysDir, { recursive: true }),
  );

  ipcMain.removeHandler('getReplaysInDir');
  ipcMain.handle('getReplaysInDir', async () =>
    getReplaysInDir(chosenReplaysDir),
  );

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
      context: Context | undefined,
    ) =>
      writeReplays(
        dir,
        fileNames,
        output,
        replays,
        startTimes,
        subdir,
        writeDisplayNames,
        context,
      ),
  );

  ipcMain.removeHandler('enforceReplays');
  ipcMain.handle(
    'enforceReplays',
    async (event: IpcMainInvokeEvent, replays: Replay[]) =>
      enforceReplays(replays),
  );

  ipcMain.removeHandler('chooseCopyDir');
  ipcMain.handle('chooseCopyDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return '';
    }
    return openDialogRes.filePaths[0];
  });

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
    async (
      event: IpcMainInvokeEvent,
      id: number,
      isDoubles: boolean,
      updatedSets?: Map<number, Set>,
    ) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return getPhaseGroup(sggApiKey, id, isDoubles, updatedSets);
    },
  );

  ipcMain.removeHandler('startSet');
  ipcMain.handle(
    'startSet',
    async (event: IpcMainInvokeEvent, setId: number): Promise<Set> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return startSet(sggApiKey, setId);
    },
  );

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    async (event: IpcMainInvokeEvent, set: StartggSet): Promise<Set[]> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return reportSet(sggApiKey, set);
    },
  );

  ipcMain.removeHandler('updateSet');
  ipcMain.handle(
    'updateSet',
    async (event: IpcMainInvokeEvent, set: StartggSet): Promise<Set> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return updateSet(sggApiKey, set);
    },
  );

  ipcMain.removeHandler('getMode');
  ipcMain.handle('getMode', () => {
    if (store.has('mode')) {
      return store.get('mode') as Mode;
    }

    store.set('mode', Mode.STARTGG);
    return Mode.STARTGG;
  });

  ipcMain.removeHandler('setMode');
  ipcMain.handle('setMode', (event: IpcMainInvokeEvent, newMode: Mode) => {
    store.set('mode', newMode);
  });

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

  ipcMain.removeHandler('getAutoDetectUsb');
  ipcMain.handle('getAutoDetectUsb', () => autoDetectUsb);

  ipcMain.removeHandler('setAutoDetectUsb');
  ipcMain.handle(
    'setAutoDetectUsb',
    (event: IpcMainInvokeEvent, newAutoDetectUsb: boolean) => {
      store.set('autoDetectUsb', newAutoDetectUsb);
      autoDetectUsb = newAutoDetectUsb;
    },
  );

  ipcMain.removeHandler('getScrollToBottom');
  ipcMain.handle('getScrollToBottom', () => {
    if (store.has('scrollToBottom')) {
      return store.get('scrollToBottom') as boolean;
    }
    store.set('scrollToBottom', true);
    return true;
  });

  ipcMain.removeHandler('setScrollToBottom');
  ipcMain.handle(
    'setScrollToBottom',
    (event: IpcMainInvokeEvent, newScrollToBottom: boolean) => {
      store.set('scrollToBottom', newScrollToBottom);
    },
  );

  ipcMain.removeHandler('getUseEnforcer');
  ipcMain.handle('getUseEnforcer', () => {
    if (store.has('useEnforcer')) {
      return store.get('useEnforcer') as boolean;
    }
    store.set('useEnforcer', true);
    return true;
  });

  ipcMain.removeHandler('setUseEnforcer');
  ipcMain.handle(
    'setUseEnforcer',
    (event: IpcMainInvokeEvent, newUseEnforcer: boolean) => {
      store.set('useEnforcer', newUseEnforcer);
    },
  );

  // {date}
  // {time}
  // {roundShort}
  // {roundLong}
  // {playersOnly}
  // {playersChars}
  // {singlesChars}
  // {stage}
  // {ordinal}
  ipcMain.removeHandler('getFileNameFormat');
  ipcMain.handle('getFileNameFormat', () => {
    if (store.has('fileNameFormat')) {
      return store.get('fileNameFormat') as string;
    }

    const initialFileNameFormat = '{ordinal} - {playersChars} - {stage}';
    store.set('fileNameFormat', initialFileNameFormat);
    return initialFileNameFormat;
  });

  ipcMain.removeHandler('setFileNameFormat');
  ipcMain.handle(
    'setFileNameFormat',
    (event: IpcMainInvokeEvent, newFileNameFormat: string) => {
      store.set('fileNameFormat', newFileNameFormat);
    },
  );

  // {date}
  // {time}
  // {roundShort}
  // {roundLong}
  // {playersOnly}
  // {playersChars}
  // {singlesChars}
  // {games}
  ipcMain.removeHandler('getFolderNameFormat');
  ipcMain.handle('getFolderNameFormat', () => {
    if (store.has('folderNameFormat')) {
      return store.get('folderNameFormat');
    }

    const initialFolderNameFormat = '{time} - {roundShort} - {playersChars}';
    store.set('folderNameFormat', initialFolderNameFormat);
    return initialFolderNameFormat;
  });

  ipcMain.removeHandler('setFolderNameFormat');
  ipcMain.handle(
    'setFolderNameFormat',
    (event: IpcMainInvokeEvent, newFolderNameFormat: string) => {
      store.set('folderNameFormat', newFolderNameFormat);
    },
  );

  ipcMain.removeHandler('getCopySettings');
  ipcMain.handle('getCopySettings', () => {
    if (store.has('copySettings')) {
      return store.get('copySettings') as CopySettings;
    }
    const newCopySettings: CopySettings = {
      output: Output.ZIP,
      writeContext: false,
      writeDisplayNames: true,
      writeFileNames: false,
      writeStartTimes: true,
    };
    store.set('copySettings', newCopySettings);
    return newCopySettings;
  });

  ipcMain.removeHandler('setCopySettings');
  ipcMain.handle(
    'setCopySettings',
    (event: IpcMainInvokeEvent, newCopySettings: CopySettings) => {
      store.set('copySettings', newCopySettings);
    },
  );

  ipcMain.removeHandler('getReportSettings');
  ipcMain.handle('getReportSettings', () => {
    if (store.has('reportSettings')) {
      return store.get('reportSettings') as ReportSettings;
    }
    const newReportSettings: ReportSettings = {
      alsoCopy: false,
      alsoDelete: false,
    };
    store.set('reportSettings', newReportSettings);
    return newReportSettings;
  });

  ipcMain.removeHandler('setReportSettings');
  ipcMain.handle(
    'setReportSettings',
    (event: IpcMainInvokeEvent, newReportSettings: ReportSettings) => {
      store.set('reportSettings', newReportSettings);
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

  ipcMain.removeHandler('getLatestVersion');
  ipcMain.handle('getLatestVersion', async () => {
    const response = await fetch(
      'https://api.github.com/repos/jmlee337/replay-manager-for-slippi/releases',
    );
    const json = await response.json();
    return json[0].tag_name;
  });
}
