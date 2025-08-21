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
import {
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  unlink,
} from 'fs/promises';
import detectUsb from 'detect-usb';
import path from 'path';
import { eject } from 'eject-media';
import { format } from 'date-fns';
import { MatchResult } from '@parry-gg/client';
import {
  AdminedTournament,
  ChallongeMatchItem,
  Context,
  CopySettings,
  EnforcePlayerFailure,
  EnforcerSetting,
  EnforceState,
  EnforceStatus,
  Id,
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
  resetSet,
  assignStream,
  getStreamsAndStations,
  assignStation,
  getPoolsByWave,
} from './startgg';
import { getReplaysInDir, writeReplays } from './replay';
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
  getParryggTournament,
  getParryggTournaments,
  getParryggEvent,
  getParryggPhase,
  getParryggBracket,
  getSelectedParryggSet,
  getCurrentParryggTournament,
  reportParryggSet,
  setSelectedParryggSetChain,
  setSelectedParryggSetId,
  setSelectedParryggTournament,
  startParryggSet,
  getSelectedParryggSetChain,
  getAdminedParryggTournaments,
} from './parrygg';
import {
  appendEnforcerResult,
  connectToHost,
  disconnectFromHost,
  getCopyClients,
  getHost,
  getHostFormat,
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
import { assertNumber, assertString } from '../common/asserts';
import { resolveHtmlPath } from './util';

type ReplayDir = {
  dir: string;
  usbKey: string;
};

let entrantsWindow: BrowserWindow | null = null;

async function getRealSetId(sggApiKey: string, originalSet: Set) {
  const updatedPhaseGroup = await getPhaseGroup(
    sggApiKey,
    assertNumber(getSelectedSetChain().phaseGroup!.id),
  );
  const candidateRealSets = updatedPhaseGroup.sets.pendingSets.filter(
    (realSet) =>
      realSet.entrant1Id === originalSet.entrant1Id &&
      realSet.entrant2Id === originalSet.entrant2Id &&
      realSet.round === originalSet.round,
  );
  if (candidateRealSets.length === 1) {
    return assertNumber(candidateRealSets[0].id);
  }
  return null;
}

export default function setupIPCs(
  mainWindow: BrowserWindow,
  enforcerWindow: BrowserWindow,
): void {
  const store = new Store<{ copySettings: CopySettings }>();
  let replayDirs: ReplayDir[] = [];
  const knownUsbs = new Map<string, boolean>();
  const onInsert = (e: any) => {
    if (knownUsbs.has(e.data.key)) {
      return;
    }

    if (e.data.isAccessible) {
      knownUsbs.set(e.data.key, true);
      replayDirs.push({
        dir:
          process.platform === 'win32'
            ? `${e.data.key}Slippi`
            : path.join(e.data.key, 'Slippi'),
        usbKey: e.data.key,
      });
      mainWindow.webContents.send(
        'usbstorage',
        replayDirs[replayDirs.length - 1].dir,
        true,
      );
    }
  };
  const onEject = (e: any) => {
    if (!knownUsbs.has(e.data.key)) {
      return;
    }

    knownUsbs.delete(e.data.key);
    replayDirs = replayDirs.filter((dir) => !dir.dir.startsWith(e.data.key));
    const newDir =
      replayDirs.length > 0 ? replayDirs[replayDirs.length - 1] : null;
    mainWindow.webContents.send(
      'usbstorage',
      newDir ? newDir.dir : '',
      Boolean(newDir?.usbKey),
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
    replayDirs.length > 0 ? replayDirs[replayDirs.length - 1].dir : '',
  );

  let chosenReplaysDir = '';
  ipcMain.removeHandler('chooseReplaysDir');
  ipcMain.handle('chooseReplaysDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles'],
    });
    if (openDialogRes.canceled) {
      return replayDirs.length > 0 ? replayDirs[replayDirs.length - 1].dir : '';
    }
    if (chosenReplaysDir) {
      const spliceI = replayDirs.findIndex(
        ({ dir }) => dir === chosenReplaysDir,
      );
      if (spliceI >= 0) {
        replayDirs.splice(spliceI, 1);
      }
    }
    [chosenReplaysDir] = openDialogRes.filePaths;
    replayDirs.push({ dir: chosenReplaysDir, usbKey: '' });
    return chosenReplaysDir;
  });

  const maybeEject = (currentDir: ReplayDir) => {
    if (currentDir.usbKey) {
      return new Promise<boolean>((resolve, reject) => {
        eject(currentDir.usbKey, (error: Error) => {
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
    if (currentDir && copyDir && currentDir.dir === copyDir) {
      return Promise.resolve(false);
    }

    const slpFilenames = (
      await readdir(currentDir.dir, { withFileTypes: true })
    )
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.slp'))
      .map((dirent) => dirent.name);
    if (trashDir) {
      const trashSubdir = format(new Date(), 'yyyy-MM-dd HHmmss');
      const fullPath = path.join(trashDir, trashSubdir);
      await mkdir(fullPath, { recursive: true });
      await Promise.all(
        slpFilenames.map(async (filename) => {
          const srcPath = path.join(currentDir.dir, filename);
          const dstPath = path.join(fullPath, filename);
          return copyFile(srcPath, dstPath);
        }),
      );
    }
    await Promise.all(
      slpFilenames.map(async (filename) => {
        const unlinkPath = path.join(currentDir.dir, filename);
        return unlink(unlinkPath);
      }),
    );
    return maybeEject(currentDir);
  });

  ipcMain.removeHandler('deleteSelectedReplays');
  ipcMain.handle(
    'deleteSelectedReplays',
    async (event: IpcMainInvokeEvent, replayPaths: string[]) => {
      if (trashDir) {
        const trashSubdir = format(new Date(), 'yyyy-MM-dd HHmmss');
        const fullPath = path.join(trashDir, trashSubdir);
        await mkdir(fullPath, { recursive: true });
        await Promise.all(
          replayPaths.map(async (replayPath) => {
            const dstPath = path.join(fullPath, path.basename(replayPath));
            return copyFile(replayPath, dstPath);
          }),
        );
      }
      await Promise.all(replayPaths.map(unlink));
    },
  );

  ipcMain.removeHandler('maybeEject');
  ipcMain.handle('maybeEject', () =>
    maybeEject(replayDirs[replayDirs.length - 1]),
  );

  let replayLoadCount = 0;
  let enforcerSetting = store.get('enforcerSetting', EnforcerSetting.NONE);
  setOwnEnforcerSetting(enforcerSetting);
  ipcMain.removeHandler('getReplaysInDir');
  ipcMain.handle('getReplaysInDir', async () => {
    if (replayDirs.length === 0) {
      throw new Error();
    }
    const retReplays = await getReplaysInDir(
      replayDirs[replayDirs.length - 1].dir,
    );
    replayLoadCount += 1;
    const currentReplayLoadCount = replayLoadCount;
    if (
      (getHostFormat().enforcerSetting ?? enforcerSetting) !==
      EnforcerSetting.NONE
    ) {
      const pendingState: EnforceState = {
        status: EnforceStatus.PENDING,
        fileNameToPlayerFailures: new Map(),
      };
      mainWindow.webContents.send(
        'enforceState',
        pendingState,
        currentReplayLoadCount,
      );
      enforcerWindow.webContents.send(
        'enforcer',
        await Promise.all(
          retReplays.replays.map(async (replay) => ({
            fileName: replay.fileName,
            buffer: (await readFile(replay.filePath)).buffer,
          })),
        ),
        currentReplayLoadCount,
      );
    }
    return { ...retReplays, replayLoadCount: currentReplayLoadCount };
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

  ipcMain.removeHandler('getCopyHostFormat');
  ipcMain.handle('getCopyHostFormat', getHostFormat);

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
    async (
      event: IpcMainInvokeEvent,
      slugOrShort: string,
      recursive: boolean,
    ) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      const slug = await getTournament(sggApiKey, slugOrShort, recursive);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
      return slug;
    },
  );

  ipcMain.removeHandler('getEvent');
  ipcMain.handle('getEvent', async (e: IpcMainInvokeEvent, id: number) => {
    if (!sggApiKey) {
      throw new Error('Please set start.gg API key');
    }

    await getEvent(sggApiKey, id, false);
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedSet(),
      startggTournament: getCurrentTournament(),
    });
  });

  ipcMain.removeHandler('getPhase');
  ipcMain.handle('getPhase', async (event: IpcMainInvokeEvent, id: number) => {
    if (!sggApiKey) {
      throw new Error('Please set start.gg API key');
    }

    await getPhase(sggApiKey, id, false);
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedSet(),
      startggTournament: getCurrentTournament(),
    });
  });

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

  ipcMain.removeHandler('getStreamsAndStations');
  ipcMain.handle('getStreamsAndStations', getStreamsAndStations);

  ipcMain.removeHandler('assignStream');
  ipcMain.handle(
    'assignStream',
    async (event: IpcMainInvokeEvent, originalSet: Set, streamId: number) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      try {
        await assignStream(sggApiKey, assertNumber(originalSet.id), streamId);
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          e.message.startsWith('An unknown error has occurred')
        ) {
          const realSetId = await getRealSetId(sggApiKey, originalSet);
          if (realSetId) {
            await assignStream(sggApiKey, realSetId, streamId);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
      await getPhaseGroup(
        sggApiKey,
        assertNumber(getSelectedSetChain().phaseGroup!.id),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('assignStation');
  ipcMain.handle(
    'assignStation',
    async (event, originalSet: Set, stationId: number) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      try {
        await assignStation(sggApiKey, originalSet.id, stationId);
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          e.message.startsWith('An unknown error has occurred')
        ) {
          const realSetId = await getRealSetId(sggApiKey, originalSet);
          if (realSetId) {
            await assignStation(sggApiKey, realSetId, stationId);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
      await getPhaseGroup(
        sggApiKey,
        assertNumber(getSelectedSetChain().phaseGroup!.id),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('resetSet');
  ipcMain.handle(
    'resetSet',
    async (event: IpcMainInvokeEvent, setId: number) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      await resetSet(sggApiKey, setId);
      await getPhaseGroup(
        sggApiKey,
        assertNumber(getSelectedSetChain().phaseGroup!.id),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('startSet');
  ipcMain.handle(
    'startSet',
    async (event: IpcMainInvokeEvent, originalSet: Set) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      try {
        await startSet(sggApiKey, originalSet.id);
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          e.message.startsWith('Set not found for id: preview')
        ) {
          const realSetId = await getRealSetId(sggApiKey, originalSet);
          if (realSetId) {
            await startSet(sggApiKey, realSetId);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
      await getPhaseGroup(
        sggApiKey,
        assertNumber(getSelectedSetChain().phaseGroup!.id),
      );
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
      originalSet: Set,
    ): Promise<Set | undefined> => {
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
            const realSetId = await getRealSetId(sggApiKey, originalSet);
            if (realSetId) {
              set.setId = realSetId;
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
        } else {
          throw e;
        }
      }
      const updatedPhaseGroup = await getPhaseGroup(
        sggApiKey,
        assertNumber(getSelectedSetChain().phaseGroup!.id),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });

      if (!updatedSet) {
        updatedSet = updatedPhaseGroup.sets.completedSets.find(
          (completedSet) => completedSet.id === set.setId,
        );
      }
      return updatedSet;
    },
  );

  ipcMain.removeHandler('updateSet');
  ipcMain.handle(
    'updateSet',
    async (
      event: IpcMainInvokeEvent,
      set: StartggSet,
    ): Promise<Set | undefined> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      const updatedSet = await updateSet(sggApiKey, set);
      await getPhaseGroup(
        sggApiKey,
        assertNumber(getSelectedSetChain().phaseGroup!.id),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
      return updatedSet;
    },
  );

  ipcMain.removeHandler('getPoolsByWave');
  ipcMain.handle('getPoolsByWave', () => {
    if (!sggApiKey) {
      throw new Error('Please set start.gg API key');
    }

    return getPoolsByWave(sggApiKey);
  });

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

  let parryggApiKey = store.has('parryggApiKey')
    ? (store.get('parryggApiKey') as string)
    : '';
  ipcMain.removeHandler('getParryggKey');
  ipcMain.handle('getParryggKey', () => parryggApiKey);

  ipcMain.removeHandler('setParryggKey');
  ipcMain.handle(
    'setParryggKey',
    (event: IpcMainInvokeEvent, newParryggKey: string) => {
      store.set('parryggApiKey', newParryggKey);
      parryggApiKey = newParryggKey;
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

  ipcMain.removeHandler('getAdminedParryggTournaments');
  ipcMain.handle('getAdminedParryggTournaments', getAdminedParryggTournaments);

  ipcMain.removeHandler('getCurrentParryggTournament');
  ipcMain.handle('getCurrentParryggTournament', getCurrentParryggTournament);

  ipcMain.removeHandler('setSelectedParryggTournament');
  ipcMain.handle(
    'setSelectedParryggTournament',
    (event: IpcMainInvokeEvent, slug: string) => {
      setSelectedParryggTournament(slug);
    },
  );

  ipcMain.removeHandler('setSelectedParryggSetChain');
  ipcMain.handle(
    'setSelectedParryggSetChain',
    (
      event: IpcMainInvokeEvent,
      eventId: string,
      phaseId: string,
      bracketId: string,
    ) => {
      setSelectedParryggSetChain(eventId, phaseId, bracketId);
    },
  );

  ipcMain.removeHandler('getSelectedParryggSet');
  ipcMain.handle('getSelectedParryggSet', getSelectedParryggSet);

  ipcMain.removeHandler('setSelectedParryggSetId');
  ipcMain.handle(
    'setSelectedParryggSetId',
    (event: IpcMainInvokeEvent, setId: string) => {
      setSelectedParryggSetId(setId);
    },
  );

  ipcMain.removeHandler('getParryggTournament');
  ipcMain.handle(
    'getParryggTournament',
    async (event: IpcMainInvokeEvent, slug: string, recursive?: boolean) => {
      if (!parryggApiKey) {
        throw new Error('Please set parry.gg API key.');
      }

      await getParryggTournament(parryggApiKey, slug, recursive);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedParryggSet(),
        parryggTournament: getCurrentParryggTournament(),
      });
    },
  );

  ipcMain.removeHandler('getParryggEvent');
  ipcMain.handle(
    'getParryggEvent',
    async (event: IpcMainInvokeEvent, eventId: string) => {
      if (!parryggApiKey) {
        throw new Error('Please set parry.gg API key.');
      }

      await getParryggEvent(parryggApiKey, eventId);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedParryggSet(),
        parryggTournament: getCurrentParryggTournament(),
      });
    },
  );

  ipcMain.removeHandler('getParryggPhase');
  ipcMain.handle(
    'getParryggPhase',
    async (event: IpcMainInvokeEvent, phaseId: string) => {
      if (!parryggApiKey) {
        throw new Error('Please set parry.gg API key.');
      }

      await getParryggPhase(parryggApiKey, phaseId);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedParryggSet(),
        parryggTournament: getCurrentParryggTournament(),
      });
    },
  );

  ipcMain.removeHandler('getParryggBracket');
  ipcMain.handle(
    'getParryggBracket',
    async (event: IpcMainInvokeEvent, bracketId: string) => {
      if (!parryggApiKey) {
        throw new Error('Please set parry.gg API key.');
      }

      await getParryggBracket(parryggApiKey, bracketId);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedParryggSet(),
        parryggTournament: getCurrentParryggTournament(),
      });
    },
  );

  ipcMain.removeHandler('startParryggSet');
  ipcMain.handle(
    'startParryggSet',
    async (event: IpcMainInvokeEvent, setId: string) => {
      if (!parryggApiKey) {
        throw new Error('Please set parry.gg API key.');
      }

      await startParryggSet(parryggApiKey, setId);
      await getParryggBracket(
        parryggApiKey,
        assertString(getSelectedParryggSetChain().bracket!.id),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedParryggSet(),
        parryggTournament: getCurrentParryggTournament(),
      });
    },
  );

  ipcMain.removeHandler('reportParryggSet');
  ipcMain.handle(
    'reportParryggSet',
    async (
      event: IpcMainInvokeEvent,
      slug: string,
      setId: string,
      result: MatchResult.AsObject,
    ) => {
      if (!parryggApiKey) {
        throw new Error('Please set parry.gg API key.');
      }
      const updatedSet = await reportParryggSet(parryggApiKey, setId, result);
      await getParryggBracket(
        parryggApiKey,
        assertString(getSelectedParryggSetChain().bracket!.id),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedParryggSet(),
        parryggTournament: getCurrentParryggTournament(),
      });
      return updatedSet;
    },
  );

  ipcMain.removeHandler('getTournaments');
  ipcMain.handle('getTournaments', async (): Promise<AdminedTournament[]> => {
    if (mode === Mode.STARTGG) {
      return sggApiKey ? getTournaments(sggApiKey) : [];
    }
    if (mode === Mode.CHALLONGE) {
      return challongeApiKey ? getChallongeTournaments(challongeApiKey) : [];
    }
    if (mode === Mode.PARRYGG) {
      return parryggApiKey ? getParryggTournaments(parryggApiKey) : [];
    }
    return [];
  });

  ipcMain.removeHandler('getSelectedSet');
  ipcMain.handle('getSelectedSet', (): Set | undefined => {
    if (mode === Mode.STARTGG) {
      return getSelectedSet();
    }
    if (mode === Mode.CHALLONGE) {
      return getSelectedChallongeSet();
    }
    if (mode === Mode.PARRYGG) {
      return getSelectedParryggSet();
    }
    return undefined;
  });

  ipcMain.removeHandler('setSelectedSetId');
  ipcMain.handle(
    'setSelectedSetId',
    (event: IpcMainInvokeEvent, selectedSetId: Id) => {
      if (!selectedSetId) {
        return;
      }
      if (mode === Mode.STARTGG) {
        setSelectedSetId(selectedSetId);
      } else if (mode === Mode.CHALLONGE) {
        setSelectedChallongeSetId(assertNumber(selectedSetId));
      } else if (mode === Mode.PARRYGG) {
        setSelectedParryggSetId(assertString(selectedSetId));
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
  // {phaseOrEvent}
  const INITIAL_FOLDER_NAME_FORMAT =
    '{phaseOrEvent} {roundShort} - {playersChars}';
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

  ipcMain.on(
    'sendEnforcerResults',
    (
      event,
      results: { fileName: string; playerFailures: EnforcePlayerFailure[] }[],
      enforcerReplayLoadCount: number,
    ) => {
      const fileNameToPlayerFailures = new Map(
        results.map(({ fileName, playerFailures }) => [
          fileName,
          playerFailures,
        ]),
      );
      const doneState: EnforceState = {
        status: EnforceStatus.DONE,
        fileNameToPlayerFailures,
      };
      mainWindow.webContents.send(
        'enforceState',
        doneState,
        enforcerReplayLoadCount,
      );
    },
  );
  ipcMain.on(
    'sendEnforcerError',
    (event, reason: any, enforcerReplayLoadCount: number) => {
      const errorState: EnforceState = {
        status: EnforceStatus.ERROR,
        fileNameToPlayerFailures: new Map(),
        reason,
      };
      mainWindow.webContents.send(
        'enforceState',
        errorState,
        enforcerReplayLoadCount,
      );
    },
  );

  ipcMain.on('openEntrantsWindow', () => {
    if (entrantsWindow) {
      entrantsWindow.moveTop();
      entrantsWindow.focus();
      return;
    }

    entrantsWindow = new BrowserWindow({
      width: 870,
      webPreferences: {
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../.erb/dll/preload.js'),
      },
    });
    entrantsWindow.loadURL(resolveHtmlPath('entrants.html'));
    entrantsWindow.on('close', () => {
      entrantsWindow = null;
    });
  });
}
