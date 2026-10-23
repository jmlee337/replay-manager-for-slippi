/** @jest-environment node */
import { mkdtemp, rm, access } from 'fs/promises';
import os from 'os';
import path from 'path';
import LuckyQueue from './queue';
import { LuckyClient, LuckyError } from './client';

const files = (version = 1) => [
  {
    name: 'context.json',
    bytes: Buffer.from(JSON.stringify({ startgg: { set: { id: 123 } } })),
  },
  { name: 'game.slp', bytes: Buffer.alloc(24, version) },
];
let root: string;
let api: jest.Mock;
let put: jest.Mock;
let queue: LuckyQueue;
let serverStatus: string;
let serverVersion: number;
beforeEach(async () => {
  serverStatus = 'collecting';
  serverVersion = 1;
  root = await mkdtemp(path.join(os.tmpdir(), 'lucky-queue-test-'));
  api = jest.fn(
    async (route: string, method: string, body: any, id: string) => {
      if (route === 'uploads')
        return {
          uploadId: id,
          tournamentUploadId: 'batch',
          status: 'awaiting_upload',
          files: body.files.map((f: any) => ({
            ...f,
            url: 'https://test.amazonaws.com/object',
            headers: {},
          })),
        };
      if (route.startsWith('uploads/'))
        return { handoffAccepted: true, status: 'staged' };
      if (route.endsWith('/reopen')) {
        serverStatus = 'collecting';
        serverVersion += 1;
        return { status: serverStatus, collectionVersion: serverVersion };
      }
      if (method === 'POST') {
        serverStatus = 'submitted';
        return { status: 'submitted' };
      }
      return {
        status: serverStatus,
        collectionVersion: serverVersion,
        contributions: [{ keyPrefix: 'l7u_abc', uploadedSets: 1 }],
        totalUploadedSets: 1,
        inFlightUploads: 0,
        autoFinishIdleHours: 6,
        finalizedBy: 'manual',
        pollAfterSeconds: 15,
        imports: [],
      };
    },
  );
  put = jest.fn(async () => {});
  queue = new LuckyQueue(
    root,
    { api, put } as unknown as LuckyClient,
    () => true,
  );
  await queue.init();
  await queue.enable(true);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
it('persists handoffs, replaces changed content, and finalizes only on request', async () => {
  await queue.enqueue('weekly', '123', files());
  await expect(queue.finish('batch')).rejects.toThrow();
  await queue.tick();
  expect(queue.state.jobs[0].status).toBe('staged');
  await expect(
    access(path.join(root, queue.state.jobs[0].id)),
  ).rejects.toThrow();
  expect(
    api.mock.calls.some(([route]) => route === 'tournaments/batch/complete'),
  ).toBe(false);
  await queue.enqueue('weekly', '123', files());
  expect(queue.state.jobs).toHaveLength(1);
  await queue.enqueue('weekly', '123', files(2));
  await expect(queue.finish('batch')).rejects.toThrow('Wait for every set');
  await queue.tick();
  expect(queue.state.jobs.map((j) => j.status)).toEqual([
    'superseded',
    'staged',
  ]);
  await queue.finish('batch');
  expect(queue.state.batches[0].finalized).toBe(true);
  await queue.enqueue('weekly', '123', files(3));
  expect(queue.state.jobs[2].status).toBe('pending');
});
it('resumes a lost completion response with the same idempotency key after restart', async () => {
  await queue.enqueue('weekly', '123', files());
  const initial = api.getMockImplementation()!;
  let failed = false;
  api.mockImplementation(async (...args: any[]) => {
    if (args[0].startsWith('uploads/') && !failed) {
      failed = true;
      throw new LuckyError('offline', true);
    }
    return initial(...args);
  });
  await queue.tick();
  expect(queue.state.jobs[0].status).toBe('pending');
  const { id } = queue.state.jobs[0];
  const resumed = new LuckyQueue(
    root,
    { api, put } as unknown as LuckyClient,
    () => true,
  );
  await resumed.init();
  await resumed.retry(id);
  await resumed.tick();
  expect(
    api.mock.calls
      .filter(([route]) => route === 'uploads')
      .map((call) => call[3]),
  ).toEqual([id, id]);
  expect(resumed.state.jobs[0].status).toBe('staged');
});
it('keeps blocked older revisions ahead of newer corrections', async () => {
  await queue.enqueue('weekly', '123', files());
  put.mockRejectedValueOnce(new LuckyError('missing'));
  await queue.tick();
  expect(queue.state.jobs[0].status).toBe('blocked');
  await queue.enqueue('weekly', '123', files(2));
  await queue.tick();
  expect(api.mock.calls.filter(([route]) => route === 'uploads')).toHaveLength(
    1,
  );
  await queue.retry(queue.state.jobs[0].id);
  await queue.tick();
  await queue.tick();
  expect(queue.state.jobs.map((j) => j.status)).toEqual([
    'superseded',
    'staged',
  ]);
});
it('refreshes expired sessions and respects server retry delays', async () => {
  await queue.enqueue('weekly', '123', files());
  api.mockRejectedValueOnce(
    new LuckyError('expired', false, 0, 'upload_expired'),
  );
  await queue.tick();
  expect(queue.state.jobs[0].idempotencyKey).toBeTruthy();
  api.mockRejectedValueOnce(new LuckyError('rate limited', true, 900000));
  await queue.retry(queue.state.jobs[0].id);
  await queue.tick();
  expect(queue.state.jobs[0].retryAt - Date.now()).toBeGreaterThan(899000);
});
it('retains an ambiguous finish for idempotent recovery and blocks new revisions', async () => {
  await queue.enqueue('weekly', '123', files());
  await queue.tick();
  api.mockResolvedValueOnce({
    status: 'collecting',
    collectionVersion: 1,
    imports: [],
  });
  api.mockRejectedValueOnce(new LuckyError('network', true));
  await expect(queue.finish('batch')).rejects.toThrow('network');
  await expect(queue.enqueue('weekly', '123', files(2))).rejects.toThrow(
    'collection change',
  );
  queue.state.batches[0].pollAt = 0;
  await queue.tick();
  expect(queue.state.batches[0].finalized).toBe(true);
});
it('rejects traversal and mismatched context without adding a job', async () => {
  await expect(queue.enqueue('weekly', '124', files())).rejects.toThrow(
    'does not match',
  );
  await expect(
    queue.enqueue('weekly', '123', [
      ...files(),
      { name: '../bad.slp', bytes: Buffer.alloc(1) },
    ]),
  ).rejects.toThrow('Invalid');
  expect(queue.state.jobs).toHaveLength(0);
});

it('discards a blocked revision so a correction can upload', async () => {
  await queue.enqueue('weekly', '123', files());
  put.mockRejectedValueOnce(new LuckyError('missing'));
  await queue.tick();
  await queue.enqueue('weekly', '123', files(2));
  await queue.cancel(queue.state.jobs[0].id);
  await queue.tick();
  expect(queue.state.jobs.map((j) => j.status)).toEqual([
    'cancelled',
    'staged',
  ]);
  expect(
    api.mock.calls.some(
      ([route, method]) => route.startsWith('uploads/') && method === 'DELETE',
    ),
  ).toBe(true);
});

it('follows remote finish and reopen while collecting and after completion', async () => {
  await queue.enqueue('weekly', '123', files());
  await queue.tick();
  const batch = queue.state.batches[0];
  expect(batch.finalized).toBe(false);
  serverStatus = 'submitted';
  batch.pollAt = 0;
  await queue.tick();
  expect(batch.finalized).toBe(true);
  serverStatus = 'collecting';
  serverVersion = 2;
  batch.pollAt = 0;
  await queue.tick();
  expect(batch.finalized).toBe(false);
  expect(batch.progress?.collectionVersion).toBe(2);
  expect(batch.pollAt).toBeLessThan(Date.now() + 16000);
  serverStatus = 'submitted';
  batch.pollAt = 0;
  await queue.tick();
  expect(batch.finalized).toBe(true);
});
it('reopens collection with the observed version and resumes finalized-blocked uploads', async () => {
  await queue.enqueue('weekly', '123', files());
  await queue.tick();
  await queue.finish('batch');
  await queue.enqueue('weekly', '123', files(2));
  const job = queue.state.jobs[1];
  job.status = 'blocked';
  job.blockedReason = 'tournament_finalized';
  await queue.reopen('batch');
  expect(api).toHaveBeenCalledWith('tournaments/batch/reopen', 'POST', {
    collectionVersion: 1,
  });
  expect(queue.state.batches[0].finalized).toBe(false);
  expect(job.status).toBe('pending');
});
it('keeps the original version on ambiguous finish retries after remote reopening', async () => {
  await queue.enqueue('weekly', '123', files());
  await queue.tick();
  api.mockResolvedValueOnce({ status: 'collecting', collectionVersion: 1 });
  api.mockRejectedValueOnce(new LuckyError('network', true));
  await expect(queue.finish('batch')).rejects.toThrow('network');
  serverVersion = 2;
  serverStatus = 'collecting';
  api.mockRejectedValueOnce(
    new LuckyError('collection_changed', false, 0, 'collection_changed'),
  );
  queue.state.batches[0].pollAt = 0;
  await queue.tick();
  expect(api).toHaveBeenLastCalledWith('tournaments/batch/complete', 'POST', {
    collectionVersion: 1,
  });
  expect(queue.state.batches[0].finishing).toBe(false);
  queue.state.batches[0].pollAt = 0;
  await queue.tick();
  expect(queue.state.batches[0].finalized).toBe(false);
});

it('polls server state even while a file transfer is busy', async () => {
  await queue.enqueue('weekly', '123', files());
  await queue.tick();
  serverStatus = 'submitted';
  queue.state.batches[0].pollAt = 0;
  queue.busy = true;
  await queue.poll();
  expect(queue.state.batches[0].finalized).toBe(true);
  expect(queue.busy).toBe(true);
});
it('marks a local accepted revision replaced when another key uploads a newer set', async () => {
  await queue.enqueue('weekly', '123', files());
  await queue.tick();
  api.mockResolvedValueOnce({
    status: 'collecting',
    collectionVersion: 1,
    sets: [{ setId: '123', uploadId: 'other-key-upload', status: 'staged' }],
    imports: [],
  });
  queue.state.batches[0].pollAt = 0;
  await queue.poll();
  expect(queue.state.jobs[0].status).toBe('superseded');
});
