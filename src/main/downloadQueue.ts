/* eslint-disable max-classes-per-file */
import path from 'path';
import { mkdir } from 'fs/promises';
import { EventEmitter } from 'events';
import {
  RequestFailure,
  DownloadSource,
  SlpDownloadStatus,
} from '../common/types';
import {
  DownloadError,
  UnreachableDownloadError,
  downloadFile,
  hasCompleteFile,
  toDownloadError,
} from './download';

const STATUS_THROTTLE_MS = 100;

export type BeamerFile = { name: string; size?: number; url: string };

export type BeamerDownloadRequest = {
  dest: string;
  name: string;
  url: string;
  size?: number;
  beamerId: string;
  beamerName: string;
};

type Job = {
  key: string;
  request: BeamerDownloadRequest;
  batch: symbol;
};

export const beamerDirWritten = new EventEmitter<{
  dirWritten: [dest: string];
}>();

const keyOf = (dest: string, name: string) => path.join(dest, name);

const noSend: (status: SlpDownloadStatus) => void = () => {};

type SchedulerHooks = {
  run: (job: Job, signal: AbortSignal) => Promise<void>;
  onStarted: (job: Job) => void;
  onDone: (job: Job) => void;
  onFailed: (job: Job, failure: DownloadError) => void;
  onCancelled: (job: Job) => void;
  onIdle: () => void;
};

class Scheduler {
  private queue: Job[] = [];

  private active: {
    job: Job;
    controller: AbortController;
    interrupted?: 'preempt' | 'cancel';
  } | null = null;

  private currentBeamer: string | null = null;

  private readonly hooks: SchedulerHooks;

  constructor(hooks: SchedulerHooks) {
    this.hooks = hooks;
  }

  add(job: Job) {
    this.queue.push(job);
    this.preemptForCurrent();
    this.pump();
  }

  setCurrentBeamer(beamerId: string) {
    this.currentBeamer = beamerId;
    this.preemptForCurrent();
  }

  cancelAll() {
    const dropped = this.queue.splice(0);
    dropped.forEach((job) => this.hooks.onCancelled(job));
    if (this.active && !this.active.interrupted) {
      this.active.interrupted = 'cancel';
      this.active.controller.abort();
    }
    this.pump();
  }

  dropWhere(predicate: (job: Job) => boolean): Job[] {
    const removed: Job[] = [];
    this.queue = this.queue.filter((job) => {
      if (predicate(job)) {
        removed.push(job);
        return false;
      }
      return true;
    });
    return removed;
  }

  isPending(key: string) {
    return this.isRunning(key) || this.queue.some((job) => job.key === key);
  }

  isRunning(key: string) {
    return this.active?.job.key === key;
  }

  isIdle() {
    return this.active === null && this.queue.length === 0;
  }

  runningJob(): Job | null {
    return this.active?.job ?? null;
  }

  inFlight(): Job[] {
    const running = this.active ? [this.active.job] : [];
    const current = this.queue.filter((job) => this.isCurrent(job));
    const rest = this.queue.filter((job) => !this.isCurrent(job));
    return [...running, ...current, ...rest];
  }

  private isCurrent(job: Job) {
    return job.request.beamerId === this.currentBeamer;
  }

  private preemptForCurrent() {
    if (
      this.active &&
      !this.active.interrupted &&
      !this.isCurrent(this.active.job) &&
      this.queue.some((job) => this.isCurrent(job))
    ) {
      this.active.interrupted = 'preempt';
      this.active.controller.abort();
    }
  }

  private pump() {
    if (this.active) {
      return;
    }
    const index = this.nextIndex();
    if (index < 0) {
      this.hooks.onIdle();
      return;
    }
    const job = this.queue.splice(index, 1)[0];
    const controller = new AbortController();
    this.active = { job, controller };
    this.hooks.onStarted(job);
    this.hooks
      .run(job, controller.signal)
      .then(() => this.settle(job))
      .catch((error) => this.fail(job, error));
  }

  private nextIndex(): number {
    if (this.queue.length === 0) {
      return -1;
    }
    const current = this.queue.findIndex((job) => this.isCurrent(job));
    return current >= 0 ? current : 0;
  }

  private settle(job: Job) {
    if (this.active?.job !== job) {
      return;
    }
    this.active = null;
    this.hooks.onDone(job);
    this.pump();
  }

  private fail(job: Job, error: unknown) {
    if (this.active?.job !== job) {
      return;
    }
    const { interrupted } = this.active;
    this.active = null;
    if (interrupted === 'preempt') {
      this.queue.push(job);
    } else if (interrupted === 'cancel') {
      this.hooks.onCancelled(job);
    } else {
      this.hooks.onFailed(job, toDownloadError(error));
    }
    this.pump();
  }
}

// user visible unit - based on "whats happening at once", not source
class Wave {
  totalFiles = 0;

  doneFiles = 0;

  totalBytes = 0;

  doneBytes = 0;

  unknownSizes = 0;

  activeWritten = 0;

  activeAttempt = 1;

  readonly failures = new Map<string, RequestFailure>();

  cancelled = false;

  add(size: number | undefined) {
    this.totalFiles += 1;
    if (size != null) {
      this.totalBytes += Math.max(size, 0);
    } else {
      this.unknownSizes += 1;
    }
  }

  start(resumedFrom: number) {
    this.activeWritten = resumedFrom;
    this.activeAttempt = 1;
  }

  setWritten(written: number) {
    this.activeWritten = written;
  }

  setAttempt(attempt: number) {
    this.activeAttempt = attempt;
  }

  succeeded(key: string, size: number | undefined) {
    this.doneFiles += 1;
    this.doneBytes += Math.max(size ?? 0, 0);
    this.failures.delete(key);
    this.clearActive();
  }

  failed(key: string, failure: RequestFailure) {
    this.doneFiles += 1;
    this.failures.set(key, failure);
    this.clearActive();
  }

  cancel() {
    this.cancelled = true;
    this.clearActive();
  }

  progress(): number {
    if (this.unknownSizes === 0 && this.totalBytes > 0) {
      return ((this.doneBytes + this.activeWritten) / this.totalBytes) * 100;
    }
    if (this.totalFiles > 0) {
      return (this.doneFiles / this.totalFiles) * 100;
    }
    return 0;
  }

  terminalStatus(): SlpDownloadStatus | null {
    if (this.cancelled) {
      return {
        status: 'cancelled',
        filesDone: this.doneFiles,
        totalFiles: this.totalFiles,
      };
    }
    if (this.failures.size > 0) {
      return {
        status: 'error',
        failedFiles: Array.from(this.failures.values()),
      };
    }
    if (this.totalFiles > 0) {
      return { status: 'success' };
    }
    return null;
  }

  reset() {
    this.totalFiles = 0;
    this.doneFiles = 0;
    this.totalBytes = 0;
    this.doneBytes = 0;
    this.unknownSizes = 0;
    this.failures.clear();
    this.cancelled = false;
    this.clearActive();
  }

  private clearActive() {
    this.activeWritten = 0;
    this.activeAttempt = 1;
  }
}

class Downloads {
  private readonly wave = new Wave();

  private readonly scheduler = new Scheduler({
    run: (job, signal) => this.runDownload(job.request, signal),
    onStarted: () => this.sendStatus(true),
    onDone: (job) => this.onDone(job),
    onFailed: (job, failure) => this.onFailed(job, failure),
    onCancelled: () => this.wave.cancel(),
    onIdle: () => this.finishWave(),
  });

  private send: (status: SlpDownloadStatus) => void = noSend;

  private lastSentAt = 0;

  init(send: (status: SlpDownloadStatus) => void) {
    this.send = send;
  }

  isPending(dest: string, name: string) {
    return this.scheduler.isPending(keyOf(dest, name));
  }

  cancel() {
    this.scheduler.cancelAll();
  }

  pull(
    dest: string,
    files: BeamerFile[],
    beamerId: string,
    beamerName: string,
  ): Promise<void> {
    this.scheduler.setCurrentBeamer(beamerId);
    return this.enqueue(dest, files, beamerId, beamerName);
  }

  backgroundPull(request: BeamerDownloadRequest): Promise<void> {
    return this.enqueue(
      request.dest,
      [{ name: request.name, url: request.url, size: request.size }],
      request.beamerId,
      request.beamerName,
    );
  }

  private async enqueue(
    dest: string,
    files: BeamerFile[],
    beamerId: string,
    beamerName: string,
  ): Promise<void> {
    const present = await Promise.all(
      files.map((file) => hasCompleteFile(dest, file)),
    );
    const missing = files.filter(
      (file, i) =>
        !present[i] && !this.scheduler.isPending(keyOf(dest, file.name)),
    );
    if (missing.length === 0) {
      return;
    }

    const batch = Symbol('batch');
    missing.forEach((file) => {
      this.wave.add(file.size);
      this.scheduler.add({
        key: keyOf(dest, file.name),
        request: {
          dest,
          name: file.name,
          url: file.url,
          size: file.size,
          beamerId,
          beamerName,
        },
        batch,
      });
    });
    this.sendStatus(true);
  }

  private async runDownload(
    request: BeamerDownloadRequest,
    signal: AbortSignal,
  ): Promise<void> {
    await mkdir(request.dest, { recursive: true });
    if (await hasCompleteFile(request.dest, request)) {
      return;
    }
    await downloadFile(request.url, path.join(request.dest, request.name), {
      beamerResume: true,
      encoding: 'gzip',
      expectedSize: request.size,
      signal,
      onStart: (written) => {
        this.wave.start(written);
        this.sendStatus(true);
      },
      onChunk: (written) => {
        this.wave.setWritten(written);
        this.sendStatus();
      },
      onAttempt: (attempt) => {
        this.wave.setAttempt(attempt);
        this.sendStatus();
      },
    });
  }

  private onDone(job: Job) {
    this.wave.succeeded(job.key, job.request.size);
    beamerDirWritten.emit('dirWritten', job.request.dest);
    this.sendStatus(true);
  }

  private onFailed(job: Job, failure: DownloadError) {
    this.failFile(job, failure.message);
    if (failure instanceof UnreachableDownloadError) {
      this.scheduler
        .dropWhere((sibling) => sibling.batch === job.batch)
        .forEach((sibling) => this.failFile(sibling, failure.message));
    }
    this.sendStatus(true);
  }

  private failFile(job: Job, reason: string) {
    this.wave.failed(job.key, {
      label: job.request.beamerName,
      fileName: job.request.name,
      reason,
    });
  }

  private finishWave() {
    if (!this.scheduler.isIdle()) {
      return;
    }
    const terminal = this.wave.terminalStatus();
    if (terminal) {
      this.send(terminal);
    }
    this.wave.reset();
  }

  private sendStatus(force = false) {
    const now = Date.now();
    if (!force && now - this.lastSentAt < STATUS_THROTTLE_MS) {
      return;
    }
    if (this.scheduler.isIdle()) {
      return;
    }
    this.lastSentAt = now;

    const sources: DownloadSource[] = [];
    const seen = new Set<string>();
    this.scheduler.inFlight().forEach((job) => {
      const { beamerId, beamerName } = job.request;
      if (!seen.has(beamerId)) {
        seen.add(beamerId);
        sources.push({ beamerId, label: beamerName });
      }
    });

    const running = this.scheduler.runningJob();
    this.send({
      status: 'downloading',
      progress: this.wave.progress(),
      currentFile: running?.request.name ?? '',
      sources,
      filesDone: this.wave.doneFiles,
      totalFiles: this.wave.totalFiles,
      failedCount: this.wave.failures.size,
      attempt:
        this.wave.activeAttempt > 1 ? this.wave.activeAttempt : undefined,
    });
  }
}

const downloads = new Downloads();

export function initDownloadQueue(
  sendStatus: (status: SlpDownloadStatus) => void,
) {
  downloads.init(sendStatus);
}

export const isBeamerDownloadPending = (dest: string, name: string) =>
  downloads.isPending(dest, name);

export function cancelBeamerDownload() {
  downloads.cancel();
}

export const enqueueBeamerPull = (
  dest: string,
  files: BeamerFile[],
  beamerId: string,
  beamerName: string,
): Promise<void> => downloads.pull(dest, files, beamerId, beamerName);

export const enqueueBeamerBackgroundPull = (
  request: BeamerDownloadRequest,
): Promise<void> => downloads.backgroundPull(request);
