import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} from 'electron';
import Store from 'electron-store';
import {
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  unlink,
} from 'fs/promises';
import path from 'path';
import { eject } from 'eject-media';
import { format } from 'date-fns';
import { EventEmitter } from 'events';
import { MatchResult } from '@parry-gg/client';
import { createWriteStream } from 'fs';
import yauzl from 'yauzl-promise';
import { pipeline } from 'stream/promises';
import { detectUsb, MountData } from './detectUsb';
import {
  ReplayDir,
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
  ParryggGame,
  Replay,
  ReportSettings,
  SelectedSetChain,
  Set,
  SlpDownloadStatus,
  RequestFailure,
  StartggGame,
  StartggSet,
} from '../common/types';
import {
  getEvent,
  getPhase,
  getPhaseGroup,
  getTournament,
  callSet,
  startSet,
  reportSet,
  updateSet,
  getTournaments,
  getCurrentTournament,
  getSelectedSet,
  setSelectedSetId,
  resetSet,
  assignStream,
  assignStation,
  getPoolsByWave,
  getSelectedSetChain,
} from './startgg';
import { getReplaysInDir, getReportedSubdirs, writeReplays } from './replay';
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
  setSelectedParryggSetId,
  setSelectedParryggTournament,
  startParryggSet,
  callParryggSet,
  getAdminedParryggTournaments,
  getSelectedParryggSetChain,
} from './parrygg';
import {
  appendEnforcerResult,
  connectToHost,
  deleteZip,
  disconnectFromHost,
  getCopyClients,
  getHost,
  getHostFormat,
  isBroadcasting,
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
  stopListeningAndSend,
} from './host';
import { assertInteger, assertString } from '../common/asserts';
import { resolveHtmlPath } from './util';
import { downloadFile } from './download';
import {
  initBeamers,
  selectBeamer,
  refreshFromBeamer,
  getPreviousBeamerReplay,
  downloadPreviousBeamerReplay,
  startBeamerBrowse,
  stopBeamerBrowse,
  setBeamerSubscribed,
  getBeamersAutoSubscribe,
  setBeamersAutoSubscribe,
  refreshBeamerStatus,
  resetBeamer,
  refreshAllBeamers,
  resetAllBeamers,
  clampMaxGamesFromIndex,
  beamerFullPath,
} from './beamer';
import { beamerDirWritten, cancelBeamerDownload } from './downloadQueue';
import {
  assignOfflineModeSetStation,
  assignOfflineModeSetStream,
  callOfflineModeSet,
  connectToOfflineMode,
  deafenForOfflineMode,
  disconnectFromOfflineMode,
  getCurrentOfflineModeTournament,
  getOfflineModePoolsByWave,
  getOfflineModeStatus,
  getOfflineModeHosts,
  getSelectedOfflineModeSet,
  getSelectedOfflineModeSetChain,
  initOfflineMode,
  listenForOfflineMode,
  reportOfflineModeSet,
  resetOfflineModeSet,
  setOfflineModePassword,
  setSelectedOfflineModeSetId,
  startOfflineModeSet,
  deafenForOfflineModeAndSend,
} from './offlinemode';

let entrantsWindow: BrowserWindow | null = null;

const replayCacheFullPath = path.join(app.getPath('userData'), 'replayCache');
const protocolLoadFullPath = path.join(replayCacheFullPath, 'protocol');
const undoDstFullPath = path.join(app.getPath('userData'), 'undo');

async function measureReplayCache(cacheRoot: string) {
  let files = 0;
  let bytes = 0;

  const walk = async (dir: string) => {
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      // no cache dir yet - nothing to measure
      return;
    }
    await Promise.all(
      dirents.map(async (dirent) => {
        const full = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
          await walk(full);
          return;
        }
        if (
          !dirent.name.endsWith('.slp') &&
          !dirent.name.endsWith('.slp.part')
        ) {
          return;
        }
        try {
          const stats = await stat(full);
          files += 1;
          bytes += stats.size;
        } catch {
          // gone between the readdir and the stat...
        }
      }),
    );
  };

  await walk(cacheRoot);
  return { files, bytes };
}

export default function setupIPCs(
  mainWindow: BrowserWindow,
  enforcerWindow: BrowserWindow,
  eventEmitter: EventEmitter,
): void {
  const store = new Store<{
    autoSubscribeBeamers: boolean;
    copySettings: CopySettings;
    hideCopyButton: boolean;
    maxGamesFromIndex: number;
    mode: Mode;
    offlineModePassword: string;
  }>();
  initOfflineMode(mainWindow);

  let offlineModePassword = store.get('offlineModePassword', '');
  setOfflineModePassword(offlineModePassword);
  ipcMain.removeHandler('getOfflineModePassword');
  ipcMain.handle('getOfflineModePassword', () => offlineModePassword);

  ipcMain.removeHandler('setOfflineModePassword');
  ipcMain.handle(
    'setOfflineModePassword',
    (event, newOfflineModePassword: string) => {
      offlineModePassword = newOfflineModePassword;
      store.set('offlineModePassword', offlineModePassword);
      setOfflineModePassword(offlineModePassword);
    },
  );

  let replayDirs: ReplayDir[] = [];
  const knownUsbs = new Map<string, boolean>();

  function topReplayDir() {
    return replayDirs.length > 0 ? replayDirs[replayDirs.length - 1] : null;
  }

  function announceReplayDir() {
    mainWindow.webContents.send('replayDir', topReplayDir());
  }

  function addReplayDir(entry: ReplayDir) {
    replayDirs.push(entry);
    announceReplayDir();
  }

  function removeReplayDirs(pred: (replayDir: ReplayDir) => boolean) {
    replayDirs = replayDirs.filter((replayDir) => !pred(replayDir));
    announceReplayDir();
  }

  function announceIfActive(dest: string) {
    const top =
      replayDirs.length > 0 ? replayDirs[replayDirs.length - 1] : null;
    if (top && top.dir === dest) {
      announceReplayDir();
    }
  }

  function beamerReplayDir(beamerId: string) {
    const current = replayDirs.find(
      (replayDir) =>
        replayDir.dirType === 'beamer' && replayDir.beamerId === beamerId,
    );
    if (!current) {
      throw new Error('Those replays are no longer loaded from a Beamer.');
    }
    return current.dir;
  }

  let slpDownloadStatus: SlpDownloadStatus = { status: 'idle' };

  async function handleProtocolLoadSlpUrls(slpUrls: string[]) {
    await mkdir(protocolLoadFullPath, { recursive: true });
    const failedFiles: RequestFailure[] = [];
    const total = slpUrls.length;
    let completed = 0;

    const send = (fileName: string) => {
      slpDownloadStatus = {
        status: 'downloading',
        sources: [],
        progress: Math.round((completed / total) * 100),
        currentFile: fileName,
        filesDone: completed,
        totalFiles: total,
        failedCount: failedFiles.length,
      };
      if (mainWindow) {
        mainWindow.webContents.send('slp-download-status', slpDownloadStatus);
      }
    };

    await Promise.all(
      slpUrls.map(async (url) => {
        const fileName = path.basename(new URL(url).pathname);
        const dest = path.join(protocolLoadFullPath, fileName);
        try {
          await downloadFile(url, dest, { encoding: 'identity' });
        } catch (err) {
          try {
            await unlink(`${dest}.part`);
          } catch (unlinkErr) {
            // ignore
          }
          failedFiles.push({
            label: url,
            reason: err instanceof Error ? err.message : String(err),
          });
        } finally {
          completed += 1;
          send(fileName);
        }
      }),
    );

    slpDownloadStatus = {
      status: 'downloading',
      sources: [],
      progress: 100,
      currentFile: '',
      filesDone: total,
      totalFiles: total,
      failedCount: failedFiles.length,
    };
    if (mainWindow) {
      mainWindow.webContents.send('slp-download-status', slpDownloadStatus);
    }
    if (failedFiles.length > 0) {
      slpDownloadStatus = { status: 'error', failedFiles };
      if (mainWindow)
        mainWindow.webContents.send('slp-download-status', slpDownloadStatus);
    } else {
      slpDownloadStatus = { status: 'success' };
      if (mainWindow)
        mainWindow.webContents.send('slp-download-status', slpDownloadStatus);
      let display = protocolLoadFullPath;
      try {
        display = new URL(slpUrls[0]).origin;
      } catch {
        // fall back to the cache path if the url can't be parsed
      }
      addReplayDir({
        dir: protocolLoadFullPath,
        dirType: 'deeplink',
        display,
      });
    }
  }

  eventEmitter.on('protocol-load-slp-urls', (slpUrls: string[]) => {
    handleProtocolLoadSlpUrls(slpUrls);
  });

  const onInsert = (e: MountData) => {
    if (knownUsbs.has(e.key)) {
      return;
    }

    if (e.isAccessible) {
      knownUsbs.set(e.key, true);
      const dir =
        process.platform === 'win32'
          ? `${e.key}Slippi`
          : path.join(e.key, 'Slippi');
      addReplayDir({
        dir,
        dirType: 'usb',
        display: dir,
        usbKey: e.key,
      });
    }
  };
  const onEject = (e: string) => {
    if (!knownUsbs.has(e)) {
      return;
    }

    knownUsbs.delete(e);
    removeReplayDirs((replayDir) => replayDir.dir.startsWith(e));
  };
  detectUsb.removeAllListeners('insert');
  detectUsb.on('insert', onInsert);
  detectUsb.removeAllListeners('eject');
  detectUsb.on('eject', onEject);
  detectUsb.startListening();

  let mode = store.has('mode') ? (store.get('mode') as Mode) : Mode.STARTGG;
  if (mode === Mode.OFFLINE_MODE) {
    listenForOfflineMode();
  }
  ipcMain.removeHandler('getMode');
  ipcMain.handle('getMode', () => mode);

  ipcMain.removeHandler('setMode');
  ipcMain.handle('setMode', (event, newMode: Mode) => {
    if (mode !== newMode && mode === Mode.OFFLINE_MODE) {
      disconnectFromOfflineMode();
      deafenForOfflineModeAndSend();
    }
    store.set('mode', newMode);
    mode = newMode;
  });

  let selectedEventId: Id;
  let selectedPhaseId: Id;
  let selectedPhaseGroupId: Id;
  if (mode === Mode.PARRYGG) {
    selectedEventId = '';
    selectedPhaseId = '';
    selectedPhaseGroupId = '';
  } else {
    selectedEventId = 0;
    selectedPhaseId = 0;
    selectedPhaseGroupId = 0;
  }

  let undoSrcFullPath = '';
  ipcMain.removeHandler('getReplaysDir');
  ipcMain.handle('getReplaysDir', () => {
    if (undoSrcFullPath) {
      return undoDstFullPath;
    }
    return replayDirs.length > 0 ? replayDirs[replayDirs.length - 1].dir : '';
  });

  let chosenReplaysDir = '';
  ipcMain.removeHandler('chooseReplaysDir');
  ipcMain.handle('chooseReplaysDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles', 'createDirectory'],
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
    replayDirs.push({
      dir: chosenReplaysDir,
      dirType: 'local',
      display: chosenReplaysDir,
    });
    return chosenReplaysDir;
  });

  let maxGamesFromIndex = store.get('maxGamesFromIndex', 4);
  initBeamers(mainWindow, store.get('autoSubscribeBeamers', false));

  beamerDirWritten.removeAllListeners('dirWritten');
  beamerDirWritten.on('dirWritten', (dest) => {
    announceIfActive(dest);
  });

  ipcMain.removeHandler('cancelBeamerDownload');
  ipcMain.handle('cancelBeamerDownload', () => {
    cancelBeamerDownload();
  });

  ipcMain.removeHandler('selectBeamer');
  ipcMain.handle(
    'selectBeamer',
    async (event, beamerId: string, newMaxGamesFromIndex: number) => {
      maxGamesFromIndex = clampMaxGamesFromIndex(newMaxGamesFromIndex);
      store.set('maxGamesFromIndex', maxGamesFromIndex);
      const {
        dest,
        display,
        beamerId: indexBeamerId,
      } = await selectBeamer(beamerId, maxGamesFromIndex);
      replayDirs = replayDirs.filter((replayDir) => replayDir.dir !== dest);
      addReplayDir({
        dir: dest,
        dirType: 'beamer',
        display,
        beamerId: indexBeamerId,
      });
      return dest;
    },
  );

  ipcMain.removeHandler('refreshFromBeamer');
  ipcMain.handle('refreshFromBeamer', async (event, beamerId: string) => {
    await refreshFromBeamer(
      beamerId,
      beamerReplayDir(beamerId),
      maxGamesFromIndex,
    );
  });

  ipcMain.removeHandler('getPreviousBeamerReplay');
  ipcMain.handle('getPreviousBeamerReplay', (event, beamerId: string) => {
    try {
      return getPreviousBeamerReplay(beamerId, beamerReplayDir(beamerId));
    } catch {
      return '';
    }
  });

  ipcMain.removeHandler('downloadPreviousBeamerReplay');
  ipcMain.handle(
    'downloadPreviousBeamerReplay',
    async (event, beamerId: string) => {
      await downloadPreviousBeamerReplay(beamerId, beamerReplayDir(beamerId));
    },
  );

  ipcMain.removeHandler('getReplayCacheSize');
  ipcMain.handle('getReplayCacheSize', () =>
    measureReplayCache(replayCacheFullPath),
  );

  const pathInside = (child: string, parent: string) => {
    const rel = path.relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };

  ipcMain.removeHandler('clearReplayCache');
  ipcMain.handle('clearReplayCache', async () => {
    const cached = (replayDir: ReplayDir) =>
      pathInside(replayDir.dir, replayCacheFullPath);
    if (replayDirs.some(cached)) {
      removeReplayDirs(cached);
    }
    cancelBeamerDownload();
    await rm(replayCacheFullPath, { recursive: true, force: true });
  });

  ipcMain.removeHandler('startBeamerBrowse');
  ipcMain.handle('startBeamerBrowse', () => {
    startBeamerBrowse();
  });

  ipcMain.removeHandler('stopBeamerBrowse');
  ipcMain.handle('stopBeamerBrowse', () => {
    stopBeamerBrowse();
  });

  ipcMain.removeHandler('setBeamerSubscribed');
  ipcMain.handle(
    'setBeamerSubscribed',
    (event, beamerId: string, subscribed: boolean) => {
      setBeamerSubscribed(beamerId, subscribed);
    },
  );

  ipcMain.removeHandler('getBeamersAutoSubscribe');
  ipcMain.handle('getBeamersAutoSubscribe', () => getBeamersAutoSubscribe());

  ipcMain.removeHandler('setBeamersAutoSubscribe');
  ipcMain.handle('setBeamersAutoSubscribe', (event, on: boolean) => {
    store.set('autoSubscribeBeamers', on);
    setBeamersAutoSubscribe(on);
  });

  ipcMain.removeHandler('refreshBeamerStatus');
  ipcMain.handle('refreshBeamerStatus', (event, beamerId: string) =>
    refreshBeamerStatus(beamerId),
  );

  ipcMain.removeHandler('refreshAllBeamers');
  ipcMain.handle('refreshAllBeamers', () => refreshAllBeamers());

  ipcMain.removeHandler('resetBeamer');
  ipcMain.handle('resetBeamer', (event, beamerId: string) =>
    resetBeamer(beamerId),
  );

  ipcMain.removeHandler('resetAllBeamers');
  ipcMain.handle('resetAllBeamers', () => resetAllBeamers());

  ipcMain.removeHandler('getMaxGamesFromIndex');
  ipcMain.handle('getMaxGamesFromIndex', () => maxGamesFromIndex);

  const maybeEject = (currentDir: ReplayDir) => {
    if (currentDir.dirType !== 'usb') {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      eject(currentDir.usbKey, () => {
        // best effort
        resolve(true);
      });
    });
  };

  let trashDir = store.get('trashDir', '') as string;
  ipcMain.removeHandler('getTrashDir');
  ipcMain.handle('getTrashDir', () => trashDir);

  ipcMain.removeHandler('chooseTrashDir');
  ipcMain.handle('chooseTrashDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles', 'createDirectory'],
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
  ipcMain.handle('deleteReplaysDir', async (event, usedFilenames: string[]) => {
    if (replayDirs.length === 0 && !undoSrcFullPath) {
      return Promise.resolve(false);
    }

    const currentDir = undoSrcFullPath
      ? undoDstFullPath
      : replayDirs[replayDirs.length - 1].dir;
    if (currentDir && copyDir && currentDir === copyDir) {
      return Promise.resolve(false);
    }
    if (!undoSrcFullPath) {
      if (replayDirs.length === 0) {
        throw new Error('replayDirs empty');
      }
      if (replayDirs[replayDirs.length - 1].dirType === 'beamer') {
        throw new Error(
          'Beamer replays live in the cache - erase on the beamer or clear the cache in Settings.',
        );
      }
    }

    const slpFilenames = (await readdir(currentDir, { withFileTypes: true }))
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.slp'))
      .map((dirent) => dirent.name);
    if (trashDir) {
      const trashSubdir = format(new Date(), 'yyyy-MM-dd HHmmss');
      const fullPath = path.join(trashDir, trashSubdir);
      await mkdir(fullPath, { recursive: true });
      const usedFilenamesMap = new Map(
        usedFilenames.map((filename) => [filename, true]),
      );
      await Promise.all(
        slpFilenames.map(async (filename) => {
          const srcPath = path.join(currentDir, filename);
          const dstDir = usedFilenamesMap.has(fullPath)
            ? path.join(fullPath, 'used')
            : path.join(fullPath, 'unused');
          await mkdir(dstDir, { recursive: true });
          const dstPath = path.join(dstDir, filename);
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
    return undoSrcFullPath
      ? Promise.resolve(false)
      : maybeEject(replayDirs[replayDirs.length - 1]);
  });

  ipcMain.removeHandler('deleteSelectedReplays');
  ipcMain.handle(
    'deleteSelectedReplays',
    async (event, replayPaths: string[], used: boolean) => {
      const beamerRoot = beamerFullPath;
      if (
        replayPaths.some((replayPath) => pathInside(replayPath, beamerRoot))
      ) {
        throw new Error(
          'Beamer replays live in the cache - erase on the beamer or clear the cache in Settings.',
        );
      }
      if (trashDir) {
        const trashSubdir = format(new Date(), 'yyyy-MM-dd HHmmss');
        const fullPath = path.join(
          trashDir,
          trashSubdir,
          used ? 'used' : 'unused',
        );
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
    if (replayDirs.length === 0 && !undoSrcFullPath) {
      throw new Error();
    }

    const replayDir = undoSrcFullPath
      ? undoDstFullPath
      : replayDirs[replayDirs.length - 1].dir;
    const dirType: ReplayDir['dirType'] = undoSrcFullPath
      ? 'local'
      : replayDirs[replayDirs.length - 1].dirType;
    const retReplays = await getReplaysInDir(replayDir);
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
          retReplays.replays
            .filter((replay) => replay.lastFrame > -124)
            .map(async (replay) => {
              const buffer = await readFile(replay.filePath);
              return {
                fileName: replay.fileName,
                array: new Uint8Array(
                  buffer.buffer,
                  buffer.byteOffset,
                  buffer.byteLength,
                ),
              };
            }),
        ),
        currentReplayLoadCount,
      );
    }
    return {
      ...retReplays,
      dir: replayDir,
      dirType,
      replayLoadCount: currentReplayLoadCount,
    };
  });

  ipcMain.removeHandler('writeReplays');
  ipcMain.handle(
    'writeReplays',
    async (
      event,
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
  ipcMain.handle('appendEnforcerResult', async (event, str: string) => {
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
  });

  ipcMain.removeHandler('getReportedSubdirs');
  ipcMain.handle('getReportedSubdirs', () =>
    copyDir ? getReportedSubdirs(copyDir) : [],
  );

  ipcMain.removeHandler('getUndoSubdir');
  ipcMain.handle('getUndoSubdir', () => path.basename(undoSrcFullPath));

  ipcMain.removeHandler('setUndoSubdir');
  ipcMain.handle(
    'setUndoSubdir',
    async (event, newUndoSubdir: string): Promise<ReplayDir | null> => {
      if (newUndoSubdir === '') {
        await rm(undoDstFullPath, { force: true, recursive: true });

        undoSrcFullPath = '';
        return topReplayDir();
      }

      await mkdir(undoDstFullPath, { recursive: true });
      const newUndoSrcFullPath = path.join(copyDir, newUndoSubdir);
      if (newUndoSrcFullPath.endsWith('.zip')) {
        try {
          const zip = await yauzl.open(newUndoSrcFullPath);
          try {
            // eslint-disable-next-line no-restricted-syntax
            for await (const entry of zip) {
              if (entry.filename.endsWith('.slp')) {
                const readStream = await entry.openReadStream();
                const writeStream = createWriteStream(
                  path.join(undoDstFullPath, entry.filename),
                );
                await pipeline(readStream, writeStream);
              }
            }
          } finally {
            zip.close();
          }
        } catch (e: any) {
          await rm(undoDstFullPath, { force: true, recursive: true });
          throw e;
        }
      } else {
        const undoSlpNames = (await readdir(newUndoSrcFullPath)).filter(
          (name) => name.endsWith('.slp'),
        );
        try {
          await Promise.all(
            undoSlpNames.map(async (undoSlpName) => {
              const srcSlpFullPath = path.join(newUndoSrcFullPath, undoSlpName);
              const dstSlpFullPath = path.join(undoDstFullPath, undoSlpName);
              return copyFile(srcSlpFullPath, dstSlpFullPath);
            }),
          );
        } catch (e: any) {
          await rm(undoDstFullPath, { force: true, recursive: true });
          throw e;
        }
      }

      undoSrcFullPath = newUndoSrcFullPath;
      return {
        dir: undoDstFullPath,
        display: undoDstFullPath,
        dirType: 'local',
      };
    },
  );

  // host delete
  ipcMain.removeHandler('deleteUndoSrcDst');
  ipcMain.handle('deleteUndoSrcDst', async (): Promise<ReplayDir | null> => {
    if (!undoSrcFullPath) {
      throw new Error('no undo subdir');
    }

    if (undoSrcFullPath.endsWith('.zip') && getHost().address) {
      try {
        await deleteZip(path.basename(undoSrcFullPath, '.zip'));
      } catch {
        // just catch
      }
    }
    await rm(undoDstFullPath, { force: true, recursive: true });
    await rm(undoSrcFullPath, { force: true, recursive: true });
    undoSrcFullPath = '';

    return topReplayDir();
  });

  ipcMain.removeHandler('getCopyDir');
  ipcMain.handle('getCopyDir', () => copyDir);

  ipcMain.removeHandler('chooseCopyDir');
  ipcMain.handle('chooseCopyDir', async () => {
    const openDialogRes = await dialog.showOpenDialog({
      properties: ['openDirectory', 'showHiddenFiles', 'createDirectory'],
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
  ipcMain.handle('stopListeningForHosts', stopListeningAndSend);

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
  ipcMain.handle('setStartggKey', (event, newSggApiKey: string) => {
    store.set('sggApiKey', newSggApiKey);
    sggApiKey = newSggApiKey;
  });

  ipcMain.removeHandler('getCurrentTournament');
  ipcMain.handle('getCurrentTournament', getCurrentTournament);

  ipcMain.removeHandler('getSelectedSetChain');
  ipcMain.handle('getSelectedSetChain', (): SelectedSetChain => {
    if (mode === Mode.STARTGG) {
      return getSelectedSetChain(
        assertInteger(selectedEventId),
        assertInteger(selectedPhaseId),
        assertInteger(selectedPhaseGroupId),
      );
    }
    if (mode === Mode.PARRYGG) {
      return getSelectedParryggSetChain(
        assertString(selectedEventId),
        assertString(selectedPhaseId),
        assertString(selectedPhaseGroupId),
      );
    }
    if (mode === Mode.OFFLINE_MODE) {
      return getSelectedOfflineModeSetChain(
        assertInteger(selectedEventId),
        assertInteger(selectedPhaseId),
        assertInteger(selectedPhaseGroupId),
      );
    }

    return {};
  });

  ipcMain.removeHandler('setSelectedSetChain');
  ipcMain.handle(
    'setSelectedSetChain',
    (event, eventId: Id, phaseId: Id, phaseGroupId: Id) => {
      selectedEventId = eventId;
      selectedPhaseId = phaseId;
      selectedPhaseGroupId = phaseGroupId;
    },
  );

  ipcMain.removeHandler('getStartggTournament');
  ipcMain.handle(
    'getStartggTournament',
    async (event, slugOrShort: string, recursive: boolean) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      await getTournament(sggApiKey, slugOrShort, recursive);
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('getEvent');
  ipcMain.handle('getEvent', async (ev, id: number) => {
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
  ipcMain.handle('getPhase', async (event, id: number) => {
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
  ipcMain.handle('getPhaseGroup', async (event, id: number) => {
    if (!sggApiKey) {
      throw new Error('Please set start.gg API key');
    }

    await getPhaseGroup(sggApiKey, id);
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedSet(),
      startggTournament: getCurrentTournament(),
    });
  });

  const getRealSetId = async (key: string, originalSet: Set) => {
    const updatedPhaseGroup = await getPhaseGroup(
      key,
      assertInteger(selectedPhaseGroupId),
    );
    const candidateRealSets = updatedPhaseGroup.sets.pendingSets.filter(
      (realSet) =>
        realSet.entrant1Id === originalSet.entrant1Id &&
        realSet.entrant2Id === originalSet.entrant2Id &&
        realSet.round === originalSet.round,
    );
    if (candidateRealSets.length === 1) {
      return assertInteger(candidateRealSets[0].id);
    }
    return null;
  };

  ipcMain.removeHandler('assignStream');
  ipcMain.handle(
    'assignStream',
    async (event, originalSet: Set, streamId: number) => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      try {
        await assignStream(sggApiKey, originalSet.id, streamId);
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
      await getPhaseGroup(sggApiKey, assertInteger(selectedPhaseGroupId));
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
      await getPhaseGroup(sggApiKey, assertInteger(selectedPhaseGroupId));
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
    },
  );

  ipcMain.removeHandler('resetSet');
  ipcMain.handle('resetSet', async (event, setId: number) => {
    if (!sggApiKey) {
      throw new Error('Please set start.gg API key');
    }

    await resetSet(sggApiKey, setId);
    await getPhaseGroup(sggApiKey, assertInteger(selectedPhaseGroupId));
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedSet(),
      startggTournament: getCurrentTournament(),
    });
  });

  ipcMain.removeHandler('callSet');
  ipcMain.handle('callSet', async (event, originalSet: Set) => {
    if (!sggApiKey) {
      throw new Error('Please set start.gg API key');
    }

    try {
      await callSet(sggApiKey, originalSet.id);
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        e.message.startsWith('Set not found for id: preview')
      ) {
        const realSetId = await getRealSetId(sggApiKey, originalSet);
        if (realSetId) {
          await callSet(sggApiKey, realSetId);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
    await getPhaseGroup(sggApiKey, assertInteger(selectedPhaseGroupId));
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedSet(),
      startggTournament: getCurrentTournament(),
    });
  });

  ipcMain.removeHandler('startSet');
  ipcMain.handle('startSet', async (event, originalSet: Set) => {
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
    await getPhaseGroup(sggApiKey, assertInteger(selectedPhaseGroupId));
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedSet(),
      startggTournament: getCurrentTournament(),
    });
  });

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    async (
      event,
      set: StartggSet,
      originalSet: Set,
    ): Promise<Set | undefined> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      let updatedSet: Set | undefined;
      try {
        updatedSet = await reportSet(
          sggApiKey,
          set,
          assertInteger(selectedPhaseGroupId),
        );
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
                updatedSet = await reportSet(
                  sggApiKey,
                  set,
                  assertInteger(selectedPhaseGroupId),
                );
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
        assertInteger(selectedPhaseGroupId),
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
    async (event, set: StartggSet): Promise<Set | undefined> => {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      const updatedSet = await updateSet(sggApiKey, set);
      await getPhaseGroup(sggApiKey, assertInteger(selectedPhaseGroupId));
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedSet(),
        startggTournament: getCurrentTournament(),
      });
      return updatedSet;
    },
  );

  ipcMain.removeHandler('getPoolsByWave');
  ipcMain.handle('getPoolsByWave', async () => {
    if (mode === Mode.STARTGG) {
      if (!sggApiKey) {
        throw new Error('Please set start.gg API key');
      }

      return getPoolsByWave(sggApiKey);
    }
    if (mode === Mode.OFFLINE_MODE) {
      return getOfflineModePoolsByWave();
    }
    return [];
  });

  let challongeApiKey = store.has('challongeApiKey')
    ? (store.get('challongeApiKey') as string)
    : '';
  ipcMain.removeHandler('getChallongeKey');
  ipcMain.handle('getChallongeKey', () => challongeApiKey);

  ipcMain.removeHandler('setChallongeKey');
  ipcMain.handle('setChallongeKey', (event, newChallongeKey: string) => {
    store.set('challongeApiKey', newChallongeKey);
    challongeApiKey = newChallongeKey;
  });

  let parryggApiKey = store.has('parryggApiKey')
    ? (store.get('parryggApiKey') as string)
    : '';
  ipcMain.removeHandler('getParryggKey');
  ipcMain.handle('getParryggKey', () => parryggApiKey);

  ipcMain.removeHandler('setParryggKey');
  ipcMain.handle('setParryggKey', (event, newParryggKey: string) => {
    store.set('parryggApiKey', newParryggKey);
    parryggApiKey = newParryggKey;
  });

  ipcMain.removeHandler('getCurrentChallongeTournaments');
  ipcMain.handle('getCurrentChallongeTournaments', getCurrentTournaments);

  ipcMain.removeHandler('getSelectedChallongeTournament');
  ipcMain.handle('getSelectedChallongeTournament', getSelectedTournament);

  ipcMain.removeHandler('setSelectedChallongeTournament');
  ipcMain.handle('setSelectedChallongeTournament', (event, slug: string) => {
    setSelectedTournament(slug);
  });

  ipcMain.removeHandler('getChallongeTournament');
  ipcMain.handle('getChallongeTournament', async (event, slug: string) => {
    if (!challongeApiKey) {
      throw new Error('Please set Challonge API key.');
    }

    await getChallongeTournament(challongeApiKey, slug);
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedChallongeSet(),
      challongeTournaments: getCurrentTournaments(),
    });
  });

  ipcMain.removeHandler('startChallongeSet');
  ipcMain.handle(
    'startChallongeSet',
    async (event, slug: string, id: string) => {
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
    async (event, id: string, items: ChallongeMatchItem[]) => {
      if (!challongeApiKey) {
        throw new Error('Please set Challonge API key.');
      }
      const slug = getSelectedTournament()?.slug;
      if (!slug) {
        throw new Error('unreachable, no selected challonge tournament');
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
  ipcMain.handle('setSelectedParryggTournament', (event, slug: string) => {
    setSelectedParryggTournament(slug);
  });

  ipcMain.removeHandler('getSelectedParryggSet');
  ipcMain.handle('getSelectedParryggSet', getSelectedParryggSet);

  ipcMain.removeHandler('setSelectedParryggSetId');
  ipcMain.handle('setSelectedParryggSetId', (event, setId: string) => {
    setSelectedParryggSetId(setId);
  });

  ipcMain.removeHandler('getParryggTournament');
  ipcMain.handle(
    'getParryggTournament',
    async (event, slug: string, recursive?: boolean) => {
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
  ipcMain.handle('getParryggEvent', async (event, eventId: string) => {
    if (!parryggApiKey) {
      throw new Error('Please set parry.gg API key.');
    }

    await getParryggEvent(parryggApiKey, eventId);
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedParryggSet(),
      parryggTournament: getCurrentParryggTournament(),
    });
  });

  ipcMain.removeHandler('getParryggPhase');
  ipcMain.handle('getParryggPhase', async (event, phaseId: string) => {
    if (!parryggApiKey) {
      throw new Error('Please set parry.gg API key.');
    }

    await getParryggPhase(parryggApiKey, phaseId);
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedParryggSet(),
      parryggTournament: getCurrentParryggTournament(),
    });
  });

  ipcMain.removeHandler('getParryggBracket');
  ipcMain.handle('getParryggBracket', async (event, bracketId: string) => {
    if (!parryggApiKey) {
      throw new Error('Please set parry.gg API key.');
    }

    await getParryggBracket(parryggApiKey, bracketId);
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedParryggSet(),
      parryggTournament: getCurrentParryggTournament(),
    });
  });

  ipcMain.removeHandler('callParryggSet');
  ipcMain.handle('callParryggSet', async (event, setId: string) => {
    if (!parryggApiKey) {
      throw new Error('Please set parry.gg API key.');
    }

    await callParryggSet(parryggApiKey, setId);
    await getParryggBracket(parryggApiKey, assertString(selectedPhaseGroupId));
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedParryggSet(),
      parryggTournament: getCurrentParryggTournament(),
    });
  });

  ipcMain.removeHandler('startParryggSet');
  ipcMain.handle('startParryggSet', async (event, setId: string) => {
    if (!parryggApiKey) {
      throw new Error('Please set parry.gg API key.');
    }

    await startParryggSet(parryggApiKey, setId);
    await getParryggBracket(parryggApiKey, assertString(selectedPhaseGroupId));
    mainWindow.webContents.send('tournament', {
      selectedSet: getSelectedParryggSet(),
      parryggTournament: getCurrentParryggTournament(),
    });
  });

  ipcMain.removeHandler('reportParryggSet');
  ipcMain.handle(
    'reportParryggSet',
    async (
      event,
      setId: string,
      result: MatchResult.AsObject,
      games?: ParryggGame[],
    ) => {
      if (!parryggApiKey) {
        throw new Error('Please set parry.gg API key.');
      }
      const updatedSet = await reportParryggSet(
        parryggApiKey,
        setId,
        result,
        games,
      );
      await getParryggBracket(
        parryggApiKey,
        assertString(selectedPhaseGroupId),
      );
      mainWindow.webContents.send('tournament', {
        selectedSet: getSelectedParryggSet(),
        parryggTournament: getCurrentParryggTournament(),
      });
      return updatedSet;
    },
  );

  ipcMain.removeHandler('getOfflineModeStatus');
  ipcMain.handle('getOfflineModeStatus', getOfflineModeStatus);

  ipcMain.removeHandler('getOfflineModeHosts');
  ipcMain.handle('getOfflineModeHosts', getOfflineModeHosts);

  ipcMain.removeHandler('getCurrentOfflineModeTournament');
  ipcMain.handle(
    'getCurrentOfflineModeTournament',
    getCurrentOfflineModeTournament,
  );

  ipcMain.removeHandler('listenForOfflineMode');
  ipcMain.handle('listenForOfflineMode', listenForOfflineMode);

  ipcMain.removeHandler('connectToOfflineMode');
  ipcMain.handle('connectToOfflineMode', (event, addressOrHost: string) =>
    connectToOfflineMode(addressOrHost),
  );

  ipcMain.removeHandler('resetOfflineModeSet');
  ipcMain.handle('resetOfflineModeSet', (event, id: number) =>
    resetOfflineModeSet(id),
  );

  ipcMain.removeHandler('callOfflineModeSet');
  ipcMain.handle('callOfflineModeSet', (event, id: number) =>
    callOfflineModeSet(id),
  );

  ipcMain.removeHandler('startOfflineModeSet');
  ipcMain.handle('startOfflineModeSet', (event, id: number) =>
    startOfflineModeSet(id),
  );

  ipcMain.removeHandler('assignOfflineModeSetStation');
  ipcMain.handle(
    'assignOfflineModeSetStation',
    (event, id: number, stationId: number) =>
      assignOfflineModeSetStation(id, stationId),
  );

  ipcMain.removeHandler('assignOfflineModeSetStream');
  ipcMain.handle(
    'assignOfflineModeSetStream',
    (event, id: number, streamId: number) =>
      assignOfflineModeSetStream(id, streamId),
  );

  ipcMain.removeHandler('reportOfflineModeSet');
  ipcMain.handle(
    'reportOfflineModeSet',
    (
      event,
      id: number,
      winnerId: number,
      isDQ: boolean,
      gameData: StartggGame[],
    ) => reportOfflineModeSet(id, winnerId, isDQ, gameData),
  );

  ipcMain.removeHandler('getTournaments');
  ipcMain.handle('getTournaments', async () => {
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
  ipcMain.handle('getSelectedSet', () => {
    if (mode === Mode.STARTGG) {
      return getSelectedSet();
    }
    if (mode === Mode.CHALLONGE) {
      return getSelectedChallongeSet();
    }
    if (mode === Mode.PARRYGG) {
      return getSelectedParryggSet();
    }
    if (mode === Mode.OFFLINE_MODE) {
      return getSelectedOfflineModeSet();
    }
    return undefined;
  });

  ipcMain.removeHandler('setSelectedSetId');
  ipcMain.handle('setSelectedSetId', (event, selectedSetId: Id) => {
    if (!selectedSetId) {
      return;
    }
    if (mode === Mode.STARTGG) {
      setSelectedSetId(selectedSetId);
    } else if (mode === Mode.CHALLONGE) {
      setSelectedChallongeSetId(assertString(selectedSetId));
    } else if (mode === Mode.PARRYGG) {
      setSelectedParryggSetId(assertString(selectedSetId));
    } else if (mode === Mode.OFFLINE_MODE) {
      setSelectedOfflineModeSetId(assertInteger(selectedSetId));
    }
  });

  let manualNames = store.has('manualNames')
    ? (store.get('manualNames') as string[])
    : [];
  ipcMain.removeHandler('getManualNames');
  ipcMain.handle('getManualNames', () => manualNames);

  ipcMain.removeHandler('setManualNames');
  ipcMain.handle('setManualNames', (event, newManualNames: string[]) => {
    store.set('manualNames', newManualNames);
    manualNames = newManualNames;
  });

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
      stopListeningAndSend();
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
  ipcMain.handle('setFileNameFormat', (event, newFileNameFormat: string) => {
    if (!newFileNameFormat) {
      throw new Error('File name format cannot be empty.');
    }
    if (fileNameFormat !== newFileNameFormat) {
      store.set('fileNameFormat', newFileNameFormat);
      fileNameFormat = newFileNameFormat;
      setOwnFileNameFormat(fileNameFormat);
    }
  });

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
    (event, newFolderNameFormat: string) => {
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

  ipcMain.removeHandler('getHideCopyButton');
  ipcMain.handle('getHideCopyButton', () => store.get('hideCopyButton', true));

  ipcMain.removeHandler('setHideCopyButton');
  ipcMain.handle('setHideCopyButton', (event, hideCopyButton: boolean) => {
    store.set('hideCopyButton', hideCopyButton);
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
  ipcMain.handle('setCopySettings', (event, newCopySettings: CopySettings) => {
    store.set('copySettings', newCopySettings);
    copySettings = newCopySettings;
    setOwnCopySettings(copySettings);
  });

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
    (event, newReportSettings: ReportSettings) => {
      store.set('reportSettings', newReportSettings);
    },
  );

  let vlerkMode = store.has('vlerkMode')
    ? (store.get('vlerkMode') as boolean)
    : false;
  ipcMain.removeHandler('getVlerkMode');
  ipcMain.handle('getVlerkMode', () => vlerkMode);

  ipcMain.removeHandler('setVlerkMode');
  ipcMain.handle('setVlerkMode', (event, newVlerkMode: boolean) => {
    store.set('vlerkMode', newVlerkMode);
    vlerkMode = newVlerkMode;
  });

  let guidedMode = store.has('guidedMode')
    ? (store.get('guidedMode') as boolean)
    : true;
  ipcMain.removeHandler('getGuidedMode');
  ipcMain.handle('getGuidedMode', () => guidedMode);

  ipcMain.removeHandler('setGuidedMode');
  ipcMain.handle('setGuidedMode', (event, newGuidedMode: boolean) => {
    store.set('guidedMode', newGuidedMode);
    guidedMode = newGuidedMode;
  });

  let smuggleCostumeIndex = store.get('smuggleCostumeIndex', true);
  setOwnSmuggleCostumeIndex(smuggleCostumeIndex);
  ipcMain.removeHandler('getSmuggleCostumeIndex');
  ipcMain.handle('getSmuggleCostumeIndex', () => smuggleCostumeIndex);

  ipcMain.removeHandler('setSmuggleCostumeIndex');
  ipcMain.handle(
    'setSmuggleCostumeIndex',
    (event, newSmuggleCostumeIndex: boolean) => {
      store.set('smuggleCostumeIndex', newSmuggleCostumeIndex);
      smuggleCostumeIndex = newSmuggleCostumeIndex;
      setOwnSmuggleCostumeIndex(smuggleCostumeIndex);
    },
  );

  ipcMain.removeHandler('copyToClipboard');
  ipcMain.handle('copyToClipboard', (event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.removeHandler('getVersion');
  ipcMain.handle('getVersion', () => app.getVersion());

  ipcMain.removeHandler('getLatestVersion');
  ipcMain.handle('getLatestVersion', async () => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/jmlee337/replay-manager-for-slippi/releases/latest',
      );
      const json = await response.json();
      const latestVersion = json.tag_name;
      if (typeof latestVersion !== 'string') {
        return '';
      }
      return latestVersion;
    } catch {
      throw new Error('***You may not be connected to the internet***');
    }
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
      width: 880,
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

  app.on('will-quit', (event) => {
    detectUsb.stopListening();
    stopListening();
    deafenForOfflineMode();
    if (undoSrcFullPath) {
      event.preventDefault();
      (async () => {
        try {
          await rm(undoDstFullPath, { force: true, recursive: true });
        } catch {
          // just catch
        } finally {
          undoSrcFullPath = '';
          app.quit();
        }
      })();
      return;
    }
    if (isBroadcasting()) {
      event.preventDefault();
      (async () => {
        await stopBroadcasting();
        app.quit();
      })();
    }
  });
}
