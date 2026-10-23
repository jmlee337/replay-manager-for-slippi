/* Sequential file transfers and hashing bound memory and preserve revision order. */
/* eslint-disable no-await-in-loop, no-restricted-syntax */
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'fs/promises';
import path from 'path';
import { contextSetId } from './context';
import { LuckyBatch, LuckyJob, LuckySnapshot } from '../../common/luckyStats';
import { LuckyClient, LuckyError } from './client';

export type SourceFile =
  | { name: string; source: string }
  | { name: string; bytes: Buffer };
type State = { enabled: boolean; jobs: LuckyJob[]; batches: LuckyBatch[] };
export default class LuckyQueue {
  state: State = { enabled: false, jobs: [], batches: [] };

  busy = false;

  preparing = 0;

  private enqueueChain: Promise<void> = Promise.resolve();

  private saving: Promise<void> = Promise.resolve();

  private finishing = new Set<string>();

  private polling = false;

  private refreshIds = new Map<string, number>();

  // TypeScript parameter properties initialize persisted queue dependencies.
  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(
    readonly root: string,
    readonly client: LuckyClient,
    private connected: () => boolean,
  ) {
    // Dependencies are initialized by TypeScript parameter properties.
  }

  async init() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    try {
      this.state = JSON.parse(
        await readFile(path.join(this.root, 'queue.json'), 'utf8'),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error(
          'Could not read the Lucky Stats queue. Existing files were preserved.',
        );
    }
    this.state.jobs.forEach((job) => {
      if (job.status === 'uploading') job.status = 'pending';
    });
    // A lost finish response is retried with the same tournament ID.
    this.state.batches.forEach((batch) => {
      batch.pollAt = 0;
    });
  }

  snapshot(): LuckySnapshot {
    return { connected: this.connected(), ...structuredClone(this.state) };
  }

  async save() {
    const json = JSON.stringify(this.state);
    this.saving = this.saving
      .catch(() => {})
      .then(async () => {
        await writeFile(path.join(this.root, 'queue.tmp'), json, {
          mode: 0o600,
        });
        await rename(
          path.join(this.root, 'queue.tmp'),
          path.join(this.root, 'queue.json'),
        );
        return undefined;
      });
    return this.saving;
  }

  async enable(enabled: boolean) {
    this.state.enabled = enabled;
    await this.save();
  }

  enqueue(tournament: string, setId: string, files: SourceFile[]) {
    this.preparing += 1;
    const task = this.enqueueChain.then(() =>
      this.stage(tournament, setId, files),
    );
    this.enqueueChain = task.catch(() => {});
    return task.finally(() => {
      this.preparing -= 1;
    });
  }

  private async stage(tournament: string, setId: string, files: SourceFile[]) {
    const id = randomUUID();
    const dir = path.join(this.root, id);
    try {
      const slug = tournament.startsWith('parry:')
        ? tournament.toLowerCase()
        : `tournament/${tournament.replace(/^tournament\//, '').toLowerCase()}`;
      if (
        !(slug.startsWith('parry:')
          ? /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
              setId,
            )
          : /^[1-9][0-9]{0,19}$/.test(setId))
      )
        throw new Error('A confirmed set ID is required.');
      if (
        this.finishing.has(slug) ||
        this.state.batches.some(
          (b) => b.tournament === slug && (b.finishing || b.reopening),
        )
      )
        throw new Error('Wait for the collection change to finish.');
      if (files.length > 2000 || !files.some((f) => f.name === 'context.json'))
        throw new Error('The set needs game data and context.json.');
      await mkdir(dir, { mode: 0o700 });
      const manifest: LuckyJob['files'] = [];
      for (const file of [...files].sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        if (
          path.basename(file.name) !== file.name ||
          !/^(context\.json|.+\.slp)$/i.test(file.name) ||
          manifest.some((f) => f.path === `set/${file.name}`)
        )
          throw new Error('Invalid or duplicate game data filename.');
        const destination = path.join(dir, file.name);
        if ('bytes' in file)
          await writeFile(destination, file.bytes, { mode: 0o600 });
        else await copyFile(file.source, destination);
        const digest = createHash('sha256');
        for await (const bytes of createReadStream(destination))
          digest.update(bytes);
        manifest.push({
          path: `set/${file.name}`,
          size: (await stat(destination)).size,
          sha256: digest.digest('hex'),
        });
      }
      if (
        manifest.length < 2 ||
        manifest.reduce((sum, f) => sum + f.size, 0) > 4 * 1024 ** 3 ||
        manifest.find((f) => f.path === 'set/context.json')!.size > 1024 ** 2
      )
        throw new Error('This set exceeds the upload limits.');
      const context = JSON.parse(
        await readFile(path.join(dir, 'context.json'), 'utf8'),
      );
      if (contextSetId(context) !== setId)
        throw new Error('Set context does not match the set ID.');
      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ slug, setId, manifest }))
        .digest('hex');
      // Compare only the newest revision: an A → B → A correction must upload A again.
      const latest = [...this.state.jobs]
        .reverse()
        .find(
          (j) =>
            j.tournament === slug &&
            j.setId === setId &&
            j.status !== 'cancelled',
        );
      if (latest?.fingerprint === fingerprint) {
        await rm(dir, { recursive: true });
        return;
      }
      this.state.jobs.push({
        id,
        tournament: slug,
        setId,
        fingerprint,
        files: manifest,
        status: 'pending',
        sentBytes: 0,
        attempts: 0,
        retryAt: 0,
      });
      await this.save();
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
  }

  async cancel(id: string) {
    const job = this.state.jobs.find((j) => j.id === id);
    if (!job || !['pending', 'blocked'].includes(job.status) || this.busy)
      throw new Error(
        'Wait for the current transfer before discarding a pending upload.',
      );
    this.busy = true;
    try {
      if (job.uploadId)
        await this.client.api(`uploads/${job.uploadId}`, 'DELETE');
      job.status = 'cancelled';
      job.error = undefined;
      await this.save();
      await rm(path.join(this.root, job.id), { recursive: true, force: true });
    } finally {
      this.busy = false;
    }
  }

  async retry(id: string) {
    const job = this.state.jobs.find((j) => j.id === id);
    if (!job || !['blocked', 'pending'].includes(job.status)) return;
    job.status = 'pending';
    job.retryAt = 0;
    job.error = undefined;
    await this.save();
  }

  async tick() {
    if (this.busy || !this.connected()) return;
    this.busy = true;
    try {
      const job = this.state.enabled
        ? this.state.jobs.find(
            (j, index) =>
              j.status === 'pending' &&
              j.retryAt <= Date.now() &&
              !this.state.jobs
                .slice(0, index)
                .some(
                  (older) =>
                    older.tournament === j.tournament &&
                    older.setId === j.setId &&
                    !['staged', 'superseded', 'cancelled'].includes(
                      older.status,
                    ),
                ),
          )
        : undefined;
      if (job) await this.upload(job);
      await this.poll();
    } finally {
      this.busy = false;
    }
  }

  async poll() {
    if (this.polling || !this.connected()) return;
    this.polling = true;
    try {
      const batch = this.state.batches.find((b) => b.pollAt <= Date.now());
      if (batch) {
        try {
          if (batch.finishing) await this.finish(batch.id);
          if (batch.reopening) await this.reopen(batch.id);
          await this.refreshBatch(batch);
          batch.error = undefined;
          batch.pollAt = Date.now() + 15000;
        } catch (e) {
          batch.error =
            e instanceof Error
              ? e.message
              : 'Could not read processing status.';
          batch.pollAt =
            Date.now() +
            Math.max(30000, e instanceof LuckyError ? e.retryAfter : 0);
        }
        await this.save();
      }
    } finally {
      this.polling = false;
    }
  }

  private async upload(job: LuckyJob) {
    try {
      job.status = 'uploading';
      job.error = undefined;
      job.sentBytes = 0;
      await this.save();
      const approval = await this.client.api(
        'uploads',
        'POST',
        { tournament: job.tournament, setId: job.setId, files: job.files },
        job.idempotencyKey || job.id,
      );
      job.uploadId = approval.uploadId;
      job.tournamentUploadId = approval.tournamentUploadId;
      if (!this.state.batches.some((b) => b.id === approval.tournamentUploadId))
        this.state.batches.push({
          id: approval.tournamentUploadId,
          tournament: job.tournament,
          finalized: false,
          pollAt: 0,
        });
      await this.save();
      if (approval.status === 'awaiting_upload') {
        let done = 0;
        for (const file of approval.files) {
          const entry = job.files.find((f) => f.path === file.path);
          if (!entry)
            throw new LuckyError('Unexpected file in upload approval.');
          const offset = done;
          await this.client.put(
            file,
            path.join(this.root, job.id, path.basename(file.path)),
            (bytes) => {
              job.sentBytes = offset + bytes;
            },
          );
          done += entry.size;
        }
      }
      const receipt = await this.client.api(
        `uploads/${job.uploadId}/complete`,
        'POST',
      );
      if (
        !receipt.handoffAccepted ||
        !['staged', 'queued', 'superseded'].includes(receipt.status)
      )
        throw new LuckyError('The server has not confirmed this set.', true);
      job.status = receipt.status === 'superseded' ? 'superseded' : 'staged';
      job.sentBytes = job.files.reduce((sum, f) => sum + f.size, 0);
      if (job.status === 'staged')
        this.state.jobs.forEach((other) => {
          if (
            other.id !== job.id &&
            other.tournament === job.tournament &&
            other.setId === job.setId &&
            other.status === 'staged'
          )
            other.status = 'superseded';
        });
      await this.save();
      // Only delete our private copy after a durable server receipt and local journal.
      await rm(path.join(this.root, job.id), {
        recursive: true,
        force: true,
      }).catch(() => {});
    } catch (e) {
      if (
        e instanceof LuckyError &&
        e.code === 'tournament_finalized' &&
        e.details
      ) {
        job.tournamentUploadId = e.details.tournamentUploadId;
        if (
          !this.state.batches.some(
            (b) => b.id === e.details!.tournamentUploadId,
          )
        )
          this.state.batches.push({
            id: e.details.tournamentUploadId,
            tournament: job.tournament,
            finalized: true,
            pollAt: 0,
          });
      }
      job.blockedReason = e instanceof LuckyError ? e.code : undefined;
      if (e instanceof LuckyError && e.code === 'upload_expired') {
        job.idempotencyKey = randomUUID();
        job.uploadId = undefined;
        e.retryable = true;
      }
      job.attempts += 1;
      job.error = e instanceof Error ? e.message : 'Upload failed.';
      job.status =
        e instanceof LuckyError && e.retryable ? 'pending' : 'blocked';
      job.retryAt =
        Date.now() +
        Math.max(
          e instanceof LuckyError ? e.retryAfter : 0,
          Math.min(300000, 2000 * 2 ** Math.min(job.attempts, 7)) +
            Math.random() * 1000,
        );
      await this.save();
    }
  }

  private async refreshBatch(batch: LuckyBatch) {
    const requestId = (this.refreshIds.get(batch.id) || 0) + 1;
    this.refreshIds.set(batch.id, requestId);
    const progress = await this.client.api(`tournaments/${batch.id}`);
    if (this.refreshIds.get(batch.id) !== requestId) return;
    const oldVersion = batch.progress?.collectionVersion || 0;
    if (
      progress.collectionVersion < oldVersion ||
      (progress.collectionVersion === oldVersion &&
        batch.finalized &&
        progress.status === 'collecting')
    )
      return;
    batch.progress = progress;
    batch.finalized = progress.status === 'submitted';
    this.state.jobs.forEach((job) => {
      const latest = batch.progress?.sets?.find(
        (set) => set.setId === job.setId,
      );
      if (
        job.tournament === batch.tournament &&
        job.status === 'staged' &&
        latest &&
        latest.uploadId !== job.uploadId
      )
        job.status = 'superseded';
    });
    if (!batch.finalized) {
      this.state.jobs.forEach((job) => {
        if (
          job.tournament === batch.tournament &&
          job.status === 'blocked' &&
          job.blockedReason === 'tournament_finalized'
        ) {
          job.status = 'pending';
          job.error = undefined;
          job.blockedReason = undefined;
          job.retryAt = 0;
        }
      });
    }
  }

  async reopen(id: string) {
    const batch = this.state.batches.find((b) => b.id === id);
    if (!batch) throw new Error('Tournament upload not found.');
    if (
      this.finishing.has(batch.tournament) ||
      batch.finishing ||
      this.preparing
    )
      throw new Error('Wait for the current collection change to finish.');
    this.finishing.add(batch.tournament);
    try {
      if (!batch.reopening) {
        await this.refreshBatch(batch);
        batch.reopeningVersion = batch.progress!.collectionVersion;
      }
      batch.reopening = true;
      await this.save();
      await this.client.api(`tournaments/${id}/reopen`, 'POST', {
        collectionVersion: batch.reopeningVersion,
      });
      batch.reopening = false;
      batch.reopeningVersion = undefined;
      await this.refreshBatch(batch);
      batch.error = undefined;
      batch.pollAt = 0;
      await this.save();
    } catch (error) {
      if (!(error instanceof LuckyError && error.retryable)) {
        batch.reopening = false;
        batch.reopeningVersion = undefined;
      }
      batch.error =
        error instanceof Error ? error.message : 'Could not reopen uploads.';
      batch.pollAt = Date.now() + 30000;
      await this.save();
      throw error;
    } finally {
      this.finishing.delete(batch.tournament);
    }
  }

  async finish(id: string) {
    const batch = this.state.batches.find((b) => b.id === id);
    if (!batch) throw new Error('Tournament upload not found.');
    if (this.finishing.has(batch.tournament) || batch.reopening)
      throw new Error('Tournament finalization is already running.');
    if (
      this.preparing ||
      this.state.jobs.some(
        (j) =>
          j.tournament === batch.tournament &&
          !['staged', 'superseded', 'cancelled'].includes(j.status),
      )
    )
      throw new Error(
        'Wait for every set upload to be confirmed before finishing.',
      );
    this.finishing.add(batch.tournament);
    try {
      if (!batch.finishing) {
        await this.refreshBatch(batch);
        batch.finishingVersion = batch.progress!.collectionVersion;
      }
      batch.finishing = true;
      await this.save();
      await this.client.api(`tournaments/${id}/complete`, 'POST', {
        collectionVersion: batch.finishingVersion,
      });
      batch.finalized = true;
      batch.finishing = false;
      batch.finishingVersion = undefined;
      await this.refreshBatch(batch);
      batch.error = undefined;
      batch.pollAt = 0;
      await this.save();
    } catch (e) {
      // Keep an ambiguous network response locked; tick retries the idempotent finish.
      if (!(e instanceof LuckyError && e.retryable)) {
        batch.finishing = false;
        batch.finishingVersion = undefined;
      }
      batch.error =
        e instanceof Error ? e.message : 'Could not finalize tournament.';
      batch.pollAt = Date.now() + 30000;
      await this.save();
      throw e;
    } finally {
      this.finishing.delete(batch.tournament);
    }
  }
}
