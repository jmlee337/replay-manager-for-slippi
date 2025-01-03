import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  IpcMainInvokeEvent,
  shell,
} from 'electron';
import Store from 'electron-store';
import { appendFile, rm } from 'fs/promises';
import detectUsb from 'detect-usb';
import path from 'path';
import { eject } from 'eject-media';
import {
  ChallongeMatchItem,
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
  getTournaments,
  getCurrentTournament,
  getSelectedSet,
  setSelectedSetId,
  getSelectedSetChain,
  setSelectedSetChain,
} from './startgg';
import { enforceReplays, getReplaysInDir, writeReplays } from './replay';
import {
  getChallongeTournament,
  getChallongeTournaments,
  getCurrentTournaments,
  getSelectedChallongeSet,
  getSelectedTournament,
  reportChallongeSet,
  setSelectedChallongeSetId,
  setSelectedTournament,
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

  ipcMain.removeHandler('getReplaysDir');
  ipcMain.handle('getReplaysDir', () =>
    replayDirs.length > 0 ? replayDirs[replayDirs.length - 1] : '',
  );

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
    if (replayDirs.length === 0) {
      throw new Error();
    }
    return getReplaysInDir(replayDirs[replayDirs.length - 1]);
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

  let copyDir = '';
  ipcMain.removeHandler('appendEnforcerResult');
  ipcMain.handle(
    'appendEnforcerResult',
    async (event: IpcMainInvokeEvent, str: string) => {
      if (!copyDir) {
        throw new Error('must set copy dir');
      }

      await appendFile(path.join(copyDir, 'enforcer.csv'), str);
    },
  );

  ipcMain.removeHandler('getCopyDir');
  ipcMain.handle('getCopyDir', () => copyDir);

  ipcMain.removeHandler('chooseCopyDir');
  ipcMain.handle('chooseCopyDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return '';
    }
    [copyDir] = openDialogRes.filePaths;
    return copyDir;
  });

  let sggApiKey = store.has('sggApiKey')
    ? (store.get('sggApiKey') as string)
    : '';

  ipcMain.removeHandler('getCurrentTournament');
  ipcMain.handle('getCurrentTournament', getCurrentTournament);

  ipcMain.removeHandler('getSelectedSetChain');
  ipcMain.handle('getSelectedSetChain', getSelectedSetChain);

  ipcMain.removeHandler('setSelectedSetChain');
  ipcMain.handle(
    'setSelectedSetChain',
    (
      event: IpcMainInvokeEvent,
      eventId: number,
      phaseId: number,
      phaseGroupId: number,
    ) => {
      setSelectedSetChain(eventId, phaseId, phaseGroupId);
    },
  );

  ipcMain.removeHandler('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event: IpcMainInvokeEvent, slug: string, recursive: boolean) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      await getTournament(sggApiKey, slug, recursive);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('getEvent');
  ipcMain.handle(
    'getEvent',
    async (e: IpcMainInvokeEvent, id: number, recursive: boolean) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      await getEvent(sggApiKey, id, recursive);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('getPhase');
  ipcMain.handle(
    'getPhase',
    async (event: IpcMainInvokeEvent, id: number, recursive: boolean) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      await getPhase(sggApiKey, id, recursive);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('getPhaseGroup');
  ipcMain.handle(
    'getPhaseGroup',
    async (event: IpcMainInvokeEvent, id: number) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      await getPhaseGroup(sggApiKey, id);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('startSet');
  ipcMain.handle(
    'startSet',
    async (event: IpcMainInvokeEvent, setId: number | string) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      await startSet(sggApiKey, setId);
      await getPhaseGroup(sggApiKey, getSelectedSetChain().phaseGroup!.id);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    async (event: IpcMainInvokeEvent, set: StartggSet): Promise<Set> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      const updatedSets = await reportSet(sggApiKey, set);
      await getPhaseGroup(sggApiKey, getSelectedSetChain().phaseGroup!.id);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
      return updatedSets.get(set.setId)!;
    },
  );

  ipcMain.removeHandler('updateSet');
  ipcMain.handle(
    'updateSet',
    async (event: IpcMainInvokeEvent, set: StartggSet): Promise<Set> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      const updatedSet = await updateSet(sggApiKey, set);
      await getPhaseGroup(sggApiKey, getSelectedSetChain().phaseGroup!.id);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
      return updatedSet;
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

  ipcMain.removeHandler('getCurrentChallongeTournaments');
  ipcMain.handle('getCurrentChallongeTournaments', getCurrentTournaments);

  ipcMain.removeHandler('getSelectedChallongeTournament');
  ipcMain.handle('getSelectedChallongeTournament', getSelectedTournament);

  ipcMain.removeHandler('setSelectedChallongeTournament');
  ipcMain.handle(
    'setSelectedChallongeTournament',
    (event: IpcMainInvokeEvent, slug: string) => {
      setSelectedTournament(slug);
    },
  );

  ipcMain.removeHandler('getChallongeTournament');
  ipcMain.handle(
    'getChallongeTournament',
    async (event: IpcMainInvokeEvent, slug: string) => {
      if (!challongeApiKey) {
        throw new Error('Please set Challonge API key.');
      }

      await getChallongeTournament(challongeApiKey, slug);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedChallongeSet(),
        challongeTournaments: getCurrentTournaments(),
      });
    },
  );

  ipcMain.removeHandler('startChallongeSet');
  ipcMain.handle(
    'startChallongeSet',
    async (event: IpcMainInvokeEvent, slug: string, id: number) => {
      if (!challongeApiKey) {
        throw new Error('Please set Challonge API key.');
      }

      await startChallongeSet(slug, id, challongeApiKey);
      await getChallongeTournament(challongeApiKey, slug);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedChallongeSet(),
        challongeTournaments: getCurrentTournaments(),
      });
    },
  );

  ipcMain.removeHandler('reportChallongeSet');
  ipcMain.handle(
    'reportChallongeSet',
    async (
      event: IpcMainInvokeEvent,
      slug: string,
      id: number,
      items: ChallongeMatchItem[],
    ) => {
      if (!challongeApiKey) {
        throw new Error('Please set Challonge API key.');
      }

      const updatedSet = await reportChallongeSet(
        slug,
        id,
        items,
        challongeApiKey,
      );
      await getChallongeTournament(challongeApiKey, slug);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedChallongeSet(),
        challongeTournaments: getCurrentTournaments(),
      });
      return updatedSet;
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

  ipcMain.removeHandler('getSelectedSet');
  ipcMain.handle('getSelectedSet', () => {
    if (mode === Mode.STARTGG) {
      return getSelectedSet();
    }
    if (mode === Mode.CHALLONGE) {
      return getSelectedChallongeSet();
    }
    return undefined;
  });

  ipcMain.removeHandler('setSelectedSetId');
  ipcMain.handle(
    'setSelectedSetId',
    (event: IpcMainInvokeEvent, selectedSetId: number | string) => {
      if (mode === Mode.STARTGG) {
        setSelectedSetId(selectedSetId);
      } else if (mode === Mode.CHALLONGE) {
        setSelectedChallongeSetId(selectedSetId as number);
      }
    },
  );

  let manualNames = store.has('manualNames')
    ? (store.get('manualNames') as string[])
    : [];
  ipcMain.removeHandler('getManualNames');
  ipcMain.handle('getManualNames', () => manualNames);

  ipcMain.removeHandler('setManualNames');
  ipcMain.handle(
    'setManualNames',
    (event: IpcMainInvokeEvent, newManualNames: string[]) => {
      store.set('manualNames', newManualNames);
      manualNames = newManualNames;
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
      writeContext: true,
      writeDisplayNames: true,
      writeFileNames: true,
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
      alsoCopy: true,
      alsoDelete: true,
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
    let response: Response | undefined;
    try {
      response = await fetch(
        'https://api.github.com/repos/jmlee337/replay-manager-for-slippi/releases',
      );
    } catch {
      throw new Error('***You may not be connected to the internet***');
    }
    const json = await response.json();
    return json[0].tag_name;
  });

  ipcMain.removeHandler('update');
  ipcMain.handle('update', async () => {
    await shell.openExternal(
      'https://github.com/jmlee337/replay-manager-for-slippi/releases/latest',
    );
    app.quit();
  });
}
