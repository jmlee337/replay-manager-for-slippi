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
import { eject } from 'eject-media';
import {
  ChallongeMatchItem,
  Context,
  CopySettings,
  Entrant,
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
  getTournaments,
  getPhaseGroupEntrants,
} from './startgg';
import { enforceReplays, getReplaysInDir, writeReplays } from './replay';
import {
  getChallongeTournament,
  getChallongeTournaments,
  reportChallongeSet,
  startChallongeSet,
} from './challonge';

export default function setupIPCs(mainWindow: BrowserWindow): void {
  const store = new Store();
  let autoDetectUsb = store.has('autoDetectUsb')
    ? (store.get('autoDetectUsb') as boolean)
    : true;
  let replayDirs: string[] = [];
  const onInsertEjectFallback = (e: any) => {
    if (replayDirs.length > 0) {
      const currentDir = replayDirs[replayDirs.length - 1];
      if (
        (e.event === 'eject' || e.data.isAccessible) &&
        (currentDir === e.data.key ||
          currentDir.startsWith(`${e.data.key}${path.sep}`))
      ) {
        mainWindow.webContents.send('usbstorage', currentDir);
      }
    }
  };
  const knownUsbs = new Map<string, boolean>();
  const onInsert = (e: any) => {
    if (!autoDetectUsb) {
      onInsertEjectFallback(e);
      return;
    }

    if (e.data.isAccessible) {
      knownUsbs.set(e.data.key, true);
      replayDirs.push(path.join(e.data.key, 'Slippi'));
      mainWindow.webContents.send(
        'usbstorage',
        replayDirs[replayDirs.length - 1],
      );
    }
  };
  const onEject = (e: any) => {
    if (!autoDetectUsb) {
      onInsertEjectFallback(e);
      return;
    }

    knownUsbs.delete(e.data.key);
    replayDirs = replayDirs.filter(
      (dir) =>
        !(dir === e.data.key || dir.startsWith(`${e.data.key}${path.sep}`)),
    );
    mainWindow.webContents.send(
      'usbstorage',
      replayDirs.length > 0 ? replayDirs[replayDirs.length - 1] : '',
    );
  };
  detectUsb.removeAllListeners('insert');
  detectUsb.on('insert', onInsert);
  detectUsb.removeAllListeners('eject');
  detectUsb.on('eject', onEject);
  detectUsb.startListening();
  app.on('will-quit', () => {
    detectUsb.stopListening();
  });

  let mode = store.has('mode') ? (store.get('mode') as Mode) : Mode.STARTGG;
  ipcMain.removeHandler('getMode');
  ipcMain.handle('getMode', () => mode);

  ipcMain.removeHandler('setMode');
  ipcMain.handle('setMode', (event: IpcMainInvokeEvent, newMode: Mode) => {
    store.set('mode', newMode);
    mode = newMode;
  });

  let chosenReplaysDir = '';
  ipcMain.removeHandler('chooseReplaysDir');
  ipcMain.handle('chooseReplaysDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return replayDirs.length > 0 ? replayDirs[replayDirs.length - 1] : '';
    }
    if (chosenReplaysDir) {
      const spliceI = replayDirs.indexOf(chosenReplaysDir);
      if (spliceI >= 0) {
        replayDirs.splice(spliceI, 1);
      }
    }
    [chosenReplaysDir] = openDialogRes.filePaths;
    replayDirs.push(chosenReplaysDir);
    return chosenReplaysDir;
  });

  ipcMain.removeHandler('deleteReplaysDir');
  ipcMain.handle('deleteReplaysDir', async () => {
    if (replayDirs.length > 0) {
      const currentDir = replayDirs[replayDirs.length - 1];
      await rm(currentDir, { recursive: true });
      const key = Array.from(knownUsbs.keys()).find(
        (usbKey) =>
          currentDir === usbKey ||
          currentDir.startsWith(`${usbKey}${path.sep}`),
      );
      if (key) {
        await new Promise<void>((resolve, reject) => {
          eject(key, (error: Error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }
    }
  });

  ipcMain.removeHandler('getReplaysInDir');
  ipcMain.handle('getReplaysInDir', async () => {
    if (replayDirs.length > 0) {
      return getReplaysInDir(replayDirs[replayDirs.length - 1]);
    }
    return { replays: [], invalidReplays: [] };
  });

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

  ipcMain.removeHandler('getPhaseGroupEntrants');
  ipcMain.handle(
    'getPhaseGroupEntrants',
    async (event: IpcMainInvokeEvent, id: number): Promise<Entrant[]> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return getPhaseGroupEntrants(sggApiKey, id);
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

  let challongeApiKey = store.has('challongeApiKey')
    ? (store.get('challongeApiKey') as string)
    : '';
  ipcMain.removeHandler('getChallongeKey');
  ipcMain.handle('getChallongeKey', () => challongeApiKey);

  ipcMain.removeHandler('setChallongeKey');
  ipcMain.handle(
    'setChallongeKey',
    (event: IpcMainInvokeEvent, newChallongeKey: string) => {
      store.set('challongeApiKey', newChallongeKey);
      challongeApiKey = newChallongeKey;
    },
  );

  ipcMain.removeHandler('getChallongeTournament');
  ipcMain.handle(
    'getChallongeTournament',
    (event: IpcMainInvokeEvent, slug: string) => {
      if (!challongeApiKey) {
        throw new Error('Please set Challonge API key.');
      }

      return getChallongeTournament(slug, challongeApiKey);
    },
  );

  ipcMain.removeHandler('startChallongeSet');
  ipcMain.handle(
    'startChallongeSet',
    (event: IpcMainInvokeEvent, slug: string, id: number) => {
      if (!challongeApiKey) {
        throw new Error('Please set Challonge API key.');
      }

      return startChallongeSet(slug, id, challongeApiKey);
    },
  );

  ipcMain.removeHandler('reportChallongeSet');
  ipcMain.handle(
    'reportChallongeSet',
    (
      event: IpcMainInvokeEvent,
      slug: string,
      id: number,
      items: ChallongeMatchItem[],
    ) => {
      if (!challongeApiKey) {
        throw new Error('Please set Challonge API key.');
      }
      return reportChallongeSet(slug, id, items, challongeApiKey);
    },
  );

  ipcMain.removeHandler('getTournaments');
  ipcMain.handle('getTournaments', async () => {
    if (mode === Mode.STARTGG) {
      return sggApiKey ? getTournaments(sggApiKey) : [];
    }
    if (mode === Mode.CHALLONGE) {
      return challongeApiKey ? getChallongeTournaments(challongeApiKey) : [];
    }
    return [];
  });

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
    store.set('useEnforcer', false);
    return false;
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
  const INITIAL_FILE_NAME_FORMAT = '{ordinal} - {playersChars} - {stage}';
  ipcMain.removeHandler('getFileNameFormat');
  ipcMain.handle('getFileNameFormat', () => {
    if (store.has('fileNameFormat')) {
      const fileNameFormat = store.get('fileNameFormat') as string;
      if (fileNameFormat) {
        return fileNameFormat;
      }
    }

    store.set('fileNameFormat', INITIAL_FILE_NAME_FORMAT);
    return INITIAL_FILE_NAME_FORMAT;
  });

  ipcMain.removeHandler('setFileNameFormat');
  ipcMain.handle(
    'setFileNameFormat',
    (event: IpcMainInvokeEvent, newFileNameFormat: string) => {
      if (!newFileNameFormat) {
        throw new Error('File name format cannot be empty.');
      }
      store.set('fileNameFormat', newFileNameFormat);
    },
  );

  ipcMain.removeHandler('resetFileNameFormat');
  ipcMain.handle('resetFileNameFormat', () => {
    store.set('fileNameFormat', INITIAL_FILE_NAME_FORMAT);
    return INITIAL_FILE_NAME_FORMAT;
  });

  // {date}
  // {time}
  // {roundShort}
  // {roundLong}
  // {playersOnly}
  // {playersChars}
  // {singlesChars}
  // {games}
  // {phaseGroup}
  // {phase}
  // {event}
  const INITIAL_FOLDER_NAME_FORMAT = '{time} - {roundShort} - {playersChars}';
  ipcMain.removeHandler('getFolderNameFormat');
  ipcMain.handle('getFolderNameFormat', () => {
    if (store.has('folderNameFormat')) {
      const folderNameFormat = store.get('folderNameFormat') as string;
      if (folderNameFormat) {
        return folderNameFormat;
      }
    }

    store.set('folderNameFormat', INITIAL_FOLDER_NAME_FORMAT);
    return INITIAL_FOLDER_NAME_FORMAT;
  });

  ipcMain.removeHandler('setFolderNameFormat');
  ipcMain.handle(
    'setFolderNameFormat',
    (event: IpcMainInvokeEvent, newFolderNameFormat: string) => {
      if (!newFolderNameFormat) {
        throw new Error('Folder name format cannot be empty.');
      }
      store.set('folderNameFormat', newFolderNameFormat);
    },
  );

  ipcMain.removeHandler('resetFolderNameFormat');
  ipcMain.handle('resetFolderNameFormat', () => {
    store.set('folderNameFormat', INITIAL_FOLDER_NAME_FORMAT);
    return INITIAL_FOLDER_NAME_FORMAT;
  });

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

  let vlerkMode = store.has('vlerkMode')
    ? (store.get('vlerkMode') as boolean)
    : false;
  ipcMain.removeHandler('getVlerkMode');
  ipcMain.handle('getVlerkMode', () => vlerkMode);

  ipcMain.removeHandler('setVlerkMode');
  ipcMain.handle(
    'setVlerkMode',
    (event: IpcMainInvokeEvent, newVlerkMode: boolean) => {
      store.set('vlerkMode', newVlerkMode);
      vlerkMode = newVlerkMode;
    },
  );

  let guidedMode = store.has('guidedMode')
    ? (store.get('guidedMode') as boolean)
    : true;
  ipcMain.removeHandler('getGuidedMode');
  ipcMain.handle('getGuidedMode', () => guidedMode);

  ipcMain.removeHandler('setGuidedMode');
  ipcMain.handle(
    'setGuidedMode',
    (event: IpcMainInvokeEvent, newGuidedMode: boolean) => {
      store.set('guidedMode', newGuidedMode);
      guidedMode = newGuidedMode;
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
