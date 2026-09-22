import { createWriteStream } from 'fs';
import { rename, stat, unlink } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

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
  readonly retryable: boolean;

  readonly discardPartial: boolean;

  readonly unreachable: boolean;

  readonly retryAfterMs: number | undefined;

  constructor(
    message: string,
    {
      retryable = true,
      discardPartial = false,
      unreachable = false,
      retryAfterMs = undefined as number | undefined,
    } = {},
  ) {
    super(message);
    this.name = 'DownloadError';
    this.retryable = retryable;
    this.discardPartial = discardPartial;
    this.unreachable = unreachable;
    this.retryAfterMs = retryAfterMs;
  }
}

function toDownloadError(error: unknown) {
  return error instanceof DownloadError
    ? error
    : new DownloadError(error instanceof Error ? error.message : String(error));
}

function networkError(error: unknown) {
  const code = (error as any)?.cause?.code ?? (error as any)?.code;
  if (typeof code === 'string' && UNREACHABLE_CODES.has(code)) {
    return new DownloadError(`unreachable (${code})`, {
      unreachable: true,
    });
  }
  if (typeof code === 'string') {
    return new DownloadError(`the connection failed (${code})`);
  }
  return new DownloadError(
    error instanceof Error ? error.message : String(error),
  );
}

async function sizeOf(file: string) {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}

async function discard(file: string) {
  try {
    await unlink(file);
  } catch {
    // best effort - there may be no partial file at all
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
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
const STATUS_DISCARD_PARTIAL = new Set([404]);

function statusError(response: Response) {
  const { status } = response;
  const retryable = status >= 500 || status === 408 || status === 429;
  return new DownloadError(`HTTP ${status}`, {
    retryable,
    discardPartial: STATUS_DISCARD_PARTIAL.has(status),
    retryAfterMs: retryable
      ? parseRetryAfter(response.headers.get('retry-after'))
      : undefined,
  });
}

function expectedTotal(response: Response, from: number) {
  const contentRange = response.headers.get('content-range');
  const total = contentRange?.match(/\/(\d+)\s*$/)?.[1];
  if (total) {
    return Number(total);
  }
  const length = response.headers.get('content-length');
  if (length !== null && length !== '') {
    return from + Number(length);
  }
  return undefined;
}

function resumeHeader(from: number): Record<string, string> | undefined {
  if (from <= 0) {
    return undefined;
  }
  return { Range: `bytes=${from}-` };
}

async function downloadAttempt(url: string, part: string): Promise<number> {
  const from = await sizeOf(part);
  const controller = new AbortController();
  const abort = () => controller.abort();

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
        headers: resumeHeader(from),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DownloadError('timed out');
      }
      throw networkError(error);
    }

    if (from > 0 && response.status === 416) {
      throw new DownloadError('the partial file was stale', {
        discardPartial: true,
      });
    }

    const resumed = from > 0 && response.status === 206;
    const start = resumed ? from : 0;
    if (response.status !== (start > 0 ? 206 : 200)) {
      throw statusError(response);
    }
    if (!response.body) {
      throw new DownloadError('no response body');
    }

    const expected = expectedTotal(response, start);

    let written = start;
    watchdog(STALL_TIMEOUT_MS);
    const counted = Readable.fromWeb(
      response.body as import('node:stream/web').ReadableStream,
    ).map((chunk: Buffer) => {
      written += chunk.length;
      watchdog(STALL_TIMEOUT_MS);
      return chunk;
    });

    try {
      await pipeline(
        counted,
        createWriteStream(part, resumed ? { flags: 'a' } : {}),
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DownloadError('the connection stalled');
      }
      throw networkError(error);
    }

    if (expected != null && written !== expected) {
      throw new DownloadError(`truncated (${written} of ${expected} bytes)`, {
        discardPartial: written > expected,
      });
    }
    return written;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadFile(url: string, dest: string): Promise<void> {
  const part = `${dest}.part`;
  let tries = 1;
  let attempts = 0;
  let best = await sizeOf(part);

  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await downloadAttempt(url, part);
      // eslint-disable-next-line no-await-in-loop
      await rename(part, dest);
      return;
    } catch (error) {
      const failure = toDownloadError(error);
      if (failure.discardPartial) {
        // eslint-disable-next-line no-await-in-loop
        await discard(part);
        best = 0;
      }
      if (!failure.retryable) {
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
      const budget = failure.unreachable ? UNREACHABLE_ATTEMPTS : MAX_ATTEMPTS;
      if (attempts >= budget || tries >= MAX_TOTAL_ATTEMPTS) {
        throw failure;
      }

      tries += 1;

      const backoff =
        failure.retryAfterMs ??
        BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      // eslint-disable-next-line no-await-in-loop
      await sleep(backoff);
    }
  }
}
