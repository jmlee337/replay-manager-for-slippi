/* eslint-disable max-classes-per-file */
import { createWriteStream } from 'fs';
import { rename, stat, unlink } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';

const CONNECT_TIMEOUT_MS = 4000;
const STALL_TIMEOUT_MS = 4000;
const MAX_ATTEMPTS = 5;
const MAX_TOTAL_ATTEMPTS = 20;
const UNREACHABLE_ATTEMPTS = 2;
const UNREACHABLE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EAI_AGAIN',
]);
const BACKOFF_MS = [1000, 2000, 4000, 4000];

export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadError';
  }
}

export class RetryableDownloadError extends DownloadError {
  readonly retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableDownloadError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class UnreachableDownloadError extends RetryableDownloadError {
  constructor(message: string) {
    super(message);
    this.name = 'UnreachableDownloadError';
  }
}

export class StalePartialDownloadError extends RetryableDownloadError {
  constructor(message: string) {
    super(message);
    this.name = 'StalePartialDownloadError';
  }
}

export class NotFoundDownloadError extends DownloadError {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundDownloadError';
  }
}

export function toDownloadError(error: unknown) {
  return error instanceof DownloadError
    ? error
    : new RetryableDownloadError(
        error instanceof Error ? error.message : String(error),
      );
}

function errorCode(error: unknown) {
  const source =
    error instanceof Error && error.cause instanceof Error
      ? error.cause
      : error;
  return source instanceof Error &&
    'code' in source &&
    typeof source.code === 'string'
    ? source.code
    : undefined;
}

function networkError(error: unknown) {
  const code = errorCode(error);
  if (code && UNREACHABLE_CODES.has(code)) {
    return new UnreachableDownloadError(`unreachable (${code})`);
  }
  if (code) {
    return new RetryableDownloadError(`the connection failed (${code})`);
  }
  return new RetryableDownloadError(
    error instanceof Error ? error.message : String(error),
  );
}

export type DownloadOptions = {
  expectedSize?: number;
  onChunk?: (written: number) => void;
  onAttempt?: (attempt: number) => void;
  onStart?: (written: number) => void;
  signal?: AbortSignal;
  beamerResume?: boolean;
  encoding: 'gzip' | 'identity';
};

async function sizeOf(file: string) {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}

export async function hasCompleteFile(
  dest: string,
  file: { name: string; size?: number },
) {
  try {
    const stats = await stat(path.join(dest, file.name));
    return stats.isFile() && (file.size == null || stats.size === file.size);
  } catch {
    return false;
  }
}

async function discard(file: string) {
  try {
    await unlink(file);
  } catch {
    // best effort - there may be no partial file at all
  }
}

// abortable :)
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let timer: NodeJS.Timeout;
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

// see RFC 7231 Retry-After
function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) {
    return undefined;
  }
  return Math.max(0, date - Date.now());
}

function statusError(response: Response) {
  const { status } = response;
  const message = `HTTP ${status}`;
  if (status === 404) {
    return new NotFoundDownloadError(message);
  }
  if (status >= 500 || status === 408 || status === 429) {
    return new RetryableDownloadError(
      message,
      parseRetryAfter(response.headers.get('retry-after')),
    );
  }
  return new DownloadError(message);
}

function expectedTotal(
  response: Response,
  from: number,
  fromIndex: number | undefined,
) {
  const contentRange = response.headers.get('content-range');
  const total = contentRange?.match(/\/(\d+)\s*$/)?.[1];
  if (total) {
    return Number(total);
  }
  const length = response.headers.get('content-length');
  if (length !== null && length !== '') {
    return from + Number(length);
  }
  return fromIndex;
}

function resumeHeader(
  beamer: boolean,
  from: number,
): Record<string, string> | undefined {
  if (from <= 0) {
    return undefined;
  }
  return beamer
    ? { 'X-Replay-From': String(from) }
    : { Range: `bytes=${from}-` };
}

async function downloadAttempt(
  url: string,
  part: string,
  options: DownloadOptions,
): Promise<number> {
  const from = await sizeOf(part);
  const beamer = options.beamerResume === true;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });

  let timer: NodeJS.Timeout | undefined;
  const watchdog = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(abort, ms);
  };

  try {
    watchdog(CONNECT_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept-Encoding': options.encoding,
          ...resumeHeader(beamer, from),
        },
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw new DownloadError('cancelled');
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RetryableDownloadError('timed out');
      }
      throw networkError(error);
    }

    if (from > 0 && response.status === 416) {
      throw new StalePartialDownloadError('the partial file was stale');
    }

    const resumed =
      from > 0 &&
      (beamer
        ? Number(response.headers.get('x-replay-from')) === from
        : response.status === 206);
    const start = resumed ? from : 0;
    if (response.status !== (!beamer && start > 0 ? 206 : 200)) {
      throw statusError(response);
    }
    if (!response.body) {
      throw new RetryableDownloadError('no response body');
    }

    const expected = expectedTotal(response, start, options.expectedSize);

    let written = start;
    watchdog(STALL_TIMEOUT_MS);
    const counted = Readable.fromWeb(
      response.body as import('node:stream/web').ReadableStream,
    ).map((chunk: Buffer) => {
      written += chunk.length;
      watchdog(STALL_TIMEOUT_MS);
      options.onChunk?.(written);
      return chunk;
    });

    try {
      await pipeline(
        counted,
        createWriteStream(part, resumed ? { flags: 'a' } : {}),
      );
    } catch (error) {
      if (options.signal?.aborted) {
        throw new DownloadError('cancelled');
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RetryableDownloadError('the connection stalled');
      }
      throw networkError(error);
    }

    if (expected != null && written !== expected) {
      const message = `truncated (${written} of ${expected} bytes)`;
      throw written > expected
        ? new StalePartialDownloadError(message)
        : new RetryableDownloadError(message);
    }
    return written;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function downloadFile(
  url: string,
  dest: string,
  options: DownloadOptions,
): Promise<void> {
  const part = `${dest}.part`;
  let tries = 1;
  let attempts = 0;
  const started = await sizeOf(part);
  options.onStart?.(started);
  let best = started;

  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await downloadAttempt(url, part, options);
      // eslint-disable-next-line no-await-in-loop
      await rename(part, dest);
      return;
    } catch (error) {
      const failure = toDownloadError(error);
      if (
        failure instanceof StalePartialDownloadError ||
        failure instanceof NotFoundDownloadError
      ) {
        // eslint-disable-next-line no-await-in-loop
        await discard(part);
        best = 0;
      }
      if (!(failure instanceof RetryableDownloadError)) {
        throw failure;
      }

      // eslint-disable-next-line no-await-in-loop
      const written = await sizeOf(part);
      if (written !== best) {
        best = written;
        attempts = 0;
      } else {
        attempts += 1;
      }
      const budget =
        failure instanceof UnreachableDownloadError
          ? UNREACHABLE_ATTEMPTS
          : MAX_ATTEMPTS;
      if (attempts >= budget || tries >= MAX_TOTAL_ATTEMPTS) {
        throw failure;
      }

      tries += 1;
      options.onAttempt?.(tries);

      const backoff =
        failure.retryAfterMs ??
        BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      // eslint-disable-next-line no-await-in-loop
      await sleep(backoff, options.signal);
      if (options.signal?.aborted) {
        throw new DownloadError('cancelled');
      }
    }
  }
}
