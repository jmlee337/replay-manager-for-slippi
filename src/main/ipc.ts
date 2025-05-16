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
import { appendFile, copyFile, mkdir, readdir, unlink } from 'fs/promises';
import detectUsb from 'detect-usb';
import path from 'path';
import { eject } from 'eject-media';
import { format } from 'date-fns';
import {
  ChallongeMatchItem,
  Context,
  CopySettings,
  EnforcerSetting,
  EnforceState,
  EnforceStatus,
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
import {
  appendEnforcerResult,
  connectToHost,
  disconnectFromHost,
  getCopyClients,
  getHost,
  getHostEnforcerSetting,
  kickCopyClient,
  setCopyDir,
  setMainWindow,
  setOwnCopySettings,
  setOwnEnforcerSetting,
  setOwnFileNameFormat,
  setOwnFolderNameFormat,
  setOwnSmuggleCostumeIndex,
  startBroadcasting,
  startHostServer,
  startListening,
  stopBroadcasting,
  stopHostServer,
  stopListening,
} from './host';

export default function setupIPCs(mainWindow: BrowserWindow): void {
  const store = new Store<{ copySettings: CopySettings }>();
  let replayDirs: string[] = [];
  const knownUsbs = new Map<string, boolean>();
  const onInsert = (e: any) => {
    if (knownUsbs.has(e.data.key)) {
      return;
    }

    if (e.data.isAccessible) {
      knownUsbs.set(e.data.key, true);
      replayDirs.push(
        process.platform === 'win32'
          ? `${e.data.key}Slippi`
          : path.join(e.data.key, 'Slippi'),
      );
      mainWindow.webContents.send(
        'usbstorage',
        replayDirs[replayDirs.length - 1],
      );
    }
  };
  const onEject = (e: any) => {
    if (!knownUsbs.has(e.data.key)) {
      return;
    }

    knownUsbs.delete(e.data.key);
    replayDirs = replayDirs.filter((dir) => !dir.startsWith(e.data.key));
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

  const maybeEject = (currentDir: string) => {
    const key = Array.from(knownUsbs.keys()).find((usbKey) =>
      currentDir.startsWith(usbKey),
    );
    if (key) {
      return new Promise<boolean>((resolve, reject) => {
        eject(key, (error: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve(true);
          }
        });
      });
    }
    return Promise.resolve(false);
  };

  let trashDir = store.get('trashDir', '') as string;
  ipcMain.removeHandler('getTrashDir');
  ipcMain.handle('getTrashDir', () => trashDir);

  ipcMain.removeHandler('chooseTrashDir');
  ipcMain.handle('chooseTrashDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return trashDir;
    }
    [trashDir] = openDialogRes.filePaths;
    store.set('trashDir', trashDir);
    return trashDir;
  });

  ipcMain.removeHandler('clearTrashDir');
  ipcMain.handle('clearTrashDir', () => {
    store.set('trashDir', '');
    trashDir = '';
  });

  let copyDir = '';
  ipcMain.removeHandler('deleteReplaysDir');
  ipcMain.handle('deleteReplaysDir', async () => {
    if (replayDirs.length === 0) {
      return Promise.resolve(false);
    }

    const currentDir = replayDirs[replayDirs.length - 1];
    if (currentDir && copyDir && currentDir === copyDir) {
      return Promise.resolve(false);
    }

    const slpFilenames = (await readdir(currentDir, { withFileTypes: true }))
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.slp'))
      .map((dirent) => dirent.name);
    if (trashDir) {
      const trashSubdir = format(new Date(), 'yyyy-MM-dd HHmmss');
      const fullPath = path.join(trashDir, trashSubdir);
      await mkdir(fullPath, { recursive: true });
      await Promise.all(
        slpFilenames.map(async (filename) => {
          const srcPath = path.join(currentDir, filename);
          const dstPath = path.join(fullPath, filename);
          return copyFile(srcPath, dstPath);
        }),
      );
    }
    await Promise.all(
      slpFilenames.map(async (filename) => {
        const unlinkPath = path.join(currentDir, filename);
        return unlink(unlinkPath);
      }),
    );
    return maybeEject(currentDir);
  });

  ipcMain.removeHandler('maybeEject');
  ipcMain.handle('maybeEject', () =>
    maybeEject(replayDirs[replayDirs.length - 1]),
  );

  let enforcerSetting = store.get('enforcerSetting', EnforcerSetting.NONE);
  setOwnEnforcerSetting(enforcerSetting);
  ipcMain.removeHandler('getReplaysInDir');
  ipcMain.handle('getReplaysInDir', async () => {
    if (replayDirs.length === 0) {
      throw new Error();
    }
    const retReplays = await getReplaysInDir(replayDirs[replayDirs.length - 1]);
    if (getHostEnforcerSetting() ?? enforcerSetting !== EnforcerSetting.NONE) {
      const pendingState: EnforceState = {
        status: EnforceStatus.PENDING,
        fileNameToPlayerFailures: new Map(),
      };
      mainWindow.webContents.send('enforceState', pendingState);
      enforceReplays(retReplays.replays)
        // eslint-disable-next-line promise/always-return
        .then((fileNameToPlayerFailures) => {
          const doneState: EnforceState = {
            status: EnforceStatus.DONE,
            fileNameToPlayerFailures,
          };
          mainWindow.webContents.send('enforceState', doneState);
        })
        .catch((reason: any) => {
          const errorState: EnforceState = {
            status: EnforceStatus.ERROR,
            fileNameToPlayerFailures: new Map(),
            reason,
          };
          mainWindow.webContents.send('enforceState', errorState);
        });
    }
    return retReplays;
  });

  ipcMain.removeHandler('writeReplays');
  ipcMain.handle(
    'writeReplays',
    async (
      event: IpcMainInvokeEvent,
      fileNames: string[],
      output: Output,
      replays: Replay[],
      startTimes: string[],
      subdir: string,
      writeDisplayNames: boolean,
      context: Context | undefined,
    ) => {
      const host = getHost();
      if (!host.address && !copyDir) {
        throw new Error('copy dir not set');
      }

      return writeReplays(
        copyDir,
        host,
        fileNames,
        output,
        replays,
        startTimes,
        subdir,
        writeDisplayNames,
        context,
      );
    },
  );

  ipcMain.removeHandler('appendEnforcerResult');
  ipcMain.handle(
    'appendEnforcerResult',
    async (event: IpcMainInvokeEvent, str: string) => {
      const host = getHost();
      if (!host.address && !copyDir) {
        throw new Error('must set copy dir');
      }

      const promises = [];
      if (host.address) {
        promises.push(appendEnforcerResult(str));
      }
      if (copyDir) {
        promises.push(appendFile(path.join(copyDir, 'enforcer.csv'), str));
      }
      const rejections = (await Promise.allSettled(promises)).filter(
        (result) => result.status === 'rejected',
      ) as PromiseRejectedResult[];
      if (rejections.length > 0) {
        throw new Error(
          rejections.map((rejection) => rejection.reason).join(', '),
        );
      }
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
    setCopyDir(copyDir);
    return copyDir;
  });

  setMainWindow(mainWindow);

  ipcMain.removeHandler('getCopyHost');
  ipcMain.handle('getCopyHost', getHost);

  ipcMain.removeHandler('startListeningForHosts');
  ipcMain.handle('startListeningForHosts', startListening);

  ipcMain.removeHandler('stopListeningForHosts');
  ipcMain.handle('stopListeningForHosts', stopListening);

  ipcMain.removeHandler('connectToHost');
  ipcMain.handle('connectToHost', (event, address: string) =>
    connectToHost(address),
  );

  ipcMain.removeHandler('disconnectFromHost');
  ipcMain.handle('disconnectFromHost', disconnectFromHost);

  ipcMain.removeHandler('getCopyClients');
  ipcMain.handle('getCopyClients', getCopyClients);

  ipcMain.removeHandler('kickCopyClient');
  ipcMain.handle('kickCopyClient', (event, address: string) =>
    kickCopyClient(address),
  );

  ipcMain.removeHandler('startHostServer');
  ipcMain.handle('startHostServer', startHostServer);

  ipcMain.removeHandler('stopHostServer');
  ipcMain.handle('stopHostServer', stopHostServer);

  ipcMain.removeHandler('startBroadcastingHost');
  ipcMain.handle('startBroadcastingHost', startBroadcasting);

  ipcMain.removeHandler('stopBroadcastingHost');
  ipcMain.handle('stopBroadcastingHost', stopBroadcasting);

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
    async (
      event: IpcMainInvokeEvent,
      set: StartggSet,
      entrant1Id: number,
      entrant2Id: number,
    ): Promise<Set> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      let updatedSet: Set | undefined;
      try {
        updatedSet = await reportSet(sggApiKey, set);
      } catch (e: unknown) {
        if (e instanceof Error) {
          if (e.message === 'Cannot report completed set via API.') {
            if (set.gameData.length > 0) {
              updatedSet = await updateSet(sggApiKey, set);
            }
          } else if (e.message.startsWith('Set not found for id: preview')) {
            const updatedPhaseGroup = await getPhaseGroup(
              sggApiKey,
              getSelectedSetChain().phaseGroup!.id,
            );
            const realId = updatedPhaseGroup.sets.pendingSets.find(
              (realSet) =>
                realSet.entrant1Id === entrant1Id &&
                realSet.entrant2Id === entrant2Id,
            )?.id;
            if (realId) {
              set.setId = realId;
            }
            try {
              updatedSet = await reportSet(sggApiKey, set);
            } catch (e2: unknown) {
              if (
                e2 instanceof Error &&
                e2.message === 'Cannot report completed set via API.'
              ) {
                if (set.gameData.length > 0) {
                  updatedSet = await updateSet(sggApiKey, set);
                }
              } else {
                throw e2;
              }
            }
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
      const updatedPhaseGroup = await getPhaseGroup(
        sggApiKey,
        getSelectedSetChain().phaseGroup!.id,
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });

      if (!updatedSet) {
        updatedSet = updatedPhaseGroup.sets.completedSets.find(
          (completedSet) => completedSet.id === set.setId,
        );
        if (!updatedSet) {
          throw new Error(`Could not find updated set: ${set.setId}`);
        }
      }
      return updatedSet;
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

  ipcMain.removeHandler('getUseLAN');
  ipcMain.handle('getUseLAN', () => {
    if (store.has('useLAN')) {
      return store.get('useLAN') as boolean;
    }
    store.set('useLAN', false);
    return false;
  });
  ipcMain.removeHandler('setUseLAN');
  ipcMain.handle('setUseLAN', (event, newUseLAN: boolean) => {
    store.set('useLAN', newUseLAN);
    if (!newUseLAN) {
      stopListening();
      stopBroadcasting();
      stopHostServer();
    }
  });

  ipcMain.removeHandler('getEnforcerSetting');
  ipcMain.handle('getEnforcerSetting', () => enforcerSetting);

  ipcMain.removeHandler('setEnforcerSetting');
  ipcMain.handle(
    'setEnforcerSetting',
    (event, newEnforcerSetting: EnforcerSetting) => {
      store.set('enforcerSetting', newEnforcerSetting);
      enforcerSetting = newEnforcerSetting;
      setOwnEnforcerSetting(enforcerSetting);
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
  const INITIAL_FILE_NAME_FORMAT = ' - {playersChars} - {stage}';
  let fileNameFormat = store.get(
    'fileNameFormat',
    INITIAL_FILE_NAME_FORMAT,
  ) as string;
  if (fileNameFormat.startsWith('{ordinal}')) {
    fileNameFormat = fileNameFormat.slice(9);
    store.set('fileNameFormat', fileNameFormat);
  }
  setOwnFileNameFormat(fileNameFormat);
  ipcMain.removeHandler('getFileNameFormat');
  ipcMain.handle('getFileNameFormat', () => fileNameFormat);

  ipcMain.removeHandler('setFileNameFormat');
  ipcMain.handle(
    'setFileNameFormat',
    (event: IpcMainInvokeEvent, newFileNameFormat: string) => {
      if (!newFileNameFormat) {
        throw new Error('File name format cannot be empty.');
      }
      if (fileNameFormat !== newFileNameFormat) {
        store.set('fileNameFormat', newFileNameFormat);
        fileNameFormat = newFileNameFormat;
        setOwnFileNameFormat(fileNameFormat);
      }
    },
  );

  ipcMain.removeHandler('resetFileNameFormat');
  ipcMain.handle('resetFileNameFormat', () => {
    if (fileNameFormat !== INITIAL_FILE_NAME_FORMAT) {
      store.set('fileNameFormat', INITIAL_FILE_NAME_FORMAT);
      fileNameFormat = INITIAL_FILE_NAME_FORMAT;
      setOwnFileNameFormat(fileNameFormat);
    }
    return fileNameFormat;
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
  let folderNameFormat = store.get(
    'folderNameFormat',
    INITIAL_FOLDER_NAME_FORMAT,
  ) as string;
  setOwnFolderNameFormat(folderNameFormat);
  ipcMain.removeHandler('getFolderNameFormat');
  ipcMain.handle('getFolderNameFormat', () => folderNameFormat);

  ipcMain.removeHandler('setFolderNameFormat');
  ipcMain.handle(
    'setFolderNameFormat',
    (event: IpcMainInvokeEvent, newFolderNameFormat: string) => {
      if (!newFolderNameFormat) {
        throw new Error('Folder name format cannot be empty.');
      }
      if (folderNameFormat !== newFolderNameFormat) {
        store.set('folderNameFormat', newFolderNameFormat);
        folderNameFormat = newFolderNameFormat;
        setOwnFolderNameFormat(folderNameFormat);
      }
    },
  );

  ipcMain.removeHandler('resetFolderNameFormat');
  ipcMain.handle('resetFolderNameFormat', () => {
    if (folderNameFormat !== INITIAL_FOLDER_NAME_FORMAT) {
      store.set('folderNameFormat', INITIAL_FOLDER_NAME_FORMAT);
      folderNameFormat = INITIAL_FOLDER_NAME_FORMAT;
      setOwnFolderNameFormat(folderNameFormat);
    }
    return folderNameFormat;
  });

  let copySettings = store.get('copySettings', {
    output: Output.ZIP,
    writeContext: true,
    writeDisplayNames: true,
    writeFileNames: true,
    writeStartTimes: true,
  });
  setOwnCopySettings(copySettings);
  ipcMain.removeHandler('getCopySettings');
  ipcMain.handle('getCopySettings', () => copySettings);

  ipcMain.removeHandler('setCopySettings');
  ipcMain.handle(
    'setCopySettings',
    (event: IpcMainInvokeEvent, newCopySettings: CopySettings) => {
      store.set('copySettings', newCopySettings);
      copySettings = newCopySettings;
      setOwnCopySettings(copySettings);
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

  let smuggleCostumeIndex = store.get('smuggleCostumeIndex', true);
  setOwnSmuggleCostumeIndex(smuggleCostumeIndex);
  ipcMain.removeHandler('getSmuggleCostumeIndex');
  ipcMain.handle('getSmuggleCostumeIndex', () => smuggleCostumeIndex);

  ipcMain.removeHandler('setSmuggleCostumeIndex');
  ipcMain.handle(
    'setSmuggleCostumeIndex',
    (event: IpcMainInvokeEvent, newSmuggleCostumeIndex: boolean) => {
      store.set('smuggleCostumeIndex', newSmuggleCostumeIndex);
      smuggleCostumeIndex = newSmuggleCostumeIndex;
      setOwnSmuggleCostumeIndex(smuggleCostumeIndex);
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
