import { app, dialog, ipcMain, safeStorage } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import LuckyQueue, { SourceFile } from './queue';
import { LuckyClient } from './client';

let queue: LuckyQueue;
let key = '';
let error: string | undefined;
let initialized: Promise<void> | undefined;
const store = new Store<{ encryptedKey: string; keyFingerprint: string }>({
  name: 'lucky-stats',
});
function secureStorage() {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === 'linux' &&
      safeStorage.getSelectedStorageBackend() === 'basic_text')
  )
    throw new Error(
      'An OS credential store is required to connect Lucky Stats.',
    );
}
export function initLuckyStats() {
  initialized ??= (async () => {
    const encrypted = store.get('encryptedKey');
    if (encrypted) {
      try {
        secureStorage();
        key = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      } catch {
        error =
          'Could not unlock the upload key. Unlock your OS credential store and restart the app.';
      }
    }
    queue = new LuckyQueue(
      path.join(app.getPath('userData'), 'lucky-stats-uploads'),
      new LuckyClient(() => key),
      () => Boolean(key),
    );
    await queue.init();
    setInterval(() => {
      queue.tick().catch(() => {
        error = 'Could not save upload progress. Check available disk space.';
      });
    }, 1000).unref();
  })();
  const handlers: Record<string, (...args: any[]) => unknown> = {
    luckyStatus: async () => {
      await initialized;
      return { ...queue.snapshot(), error };
    },
    luckyConnect: async (value: string) => {
      await initialized;
      if (typeof value !== 'string' || !/^l7u_[0-9a-f]{64}$/.test(value.trim()))
        throw new Error('Enter a Lucky Stats upload key.');
      const next = value.trim();
      const fingerprint = createHash('sha256').update(next).digest('hex');
      if (
        queue.state.jobs.length &&
        fingerprint !== store.get('keyFingerprint') &&
        next !== key
      )
        throw new Error(
          'This queue belongs to its original upload key. Finish uploads using that key before changing accounts.',
        );
      secureStorage();
      const connection = await new LuckyClient(() => next).api('connection');
      if (connection.workflow !== 'per_set_until_tournament_finished')
        throw new Error('The upload API does not support per-set uploads.');
      store.set(
        'encryptedKey',
        safeStorage.encryptString(next).toString('base64'),
      );
      store.set('keyFingerprint', fingerprint);
      key = next;
      error = undefined;
    },
    luckyDisconnect: async () => {
      await initialized;
      if (queue.busy || queue.preparing)
        throw new Error(
          'Wait for the current transfer or status check to finish, then disconnect.',
        );
      await queue.enable(false);
      store.delete('encryptedKey');
      key = '';
    },
    luckyEnable: async (enabled: boolean) => {
      await initialized;
      if (typeof enabled !== 'boolean' || !key)
        throw new Error('Connect Lucky Stats first.');
      await queue.enable(enabled);
    },
    luckyAddFolder: async () => {
      await initialized;
      if (!key) throw new Error('Connect Lucky Stats first.');
      const result = await dialog.showOpenDialog({
        title: 'Choose a finalized set folder',
        properties: ['openDirectory'],
      });
      if (result.canceled) return;
      const dir = result.filePaths[0];
      const context = JSON.parse(
        await readFile(path.join(dir, 'context.json'), 'utf8'),
      );
      const slug = String(context?.startgg?.event?.slug || '').match(
        /^tournament\/([^/]+)\/event\//,
      )?.[1];
      if (!slug)
        throw new Error('The context must include a Start.gg event slug.');
      const entries = await readdir(dir, { withFileTypes: true });
      const files = entries
        .filter(
          (f) =>
            f.isFile() &&
            (f.name === 'context.json' ||
              f.name.toLowerCase().endsWith('.slp')),
        )
        .map((f) => ({ name: f.name, source: path.join(dir, f.name) }));
      await queue.enqueue(slug, String(context?.startgg?.set?.id || ''), files);
    },
    luckyCancel: async (id: string) => {
      await initialized;
      await queue.cancel(id);
    },
    luckyRetry: async (id: string) => {
      await initialized;
      await queue.retry(id);
    },
    luckyFinish: async (id: string) => {
      await initialized;
      await queue.finish(id);
    },
  };
  Object.entries(handlers).forEach(([channel, handler]) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (_event, ...args) => handler(...args));
  });
}
export async function enqueueLuckySet(
  tournament: string,
  setId: string,
  files: SourceFile[],
) {
  await initialized;
  if (!queue?.state.enabled || !key) return;
  try {
    await queue.enqueue(tournament, setId, files);
    error = undefined;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not queue game data.';
    throw e;
  }
}
export async function luckyEnabled() {
  await initialized;
  return Boolean(key && queue?.state.enabled);
}
