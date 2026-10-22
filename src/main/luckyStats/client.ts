import { createReadStream } from 'fs';
import { request } from 'https';

import LuckyError from './error';

export { default as LuckyError } from './error';

export type ApprovedFile = {
  path: string;
  url: string;
  headers: Record<string, string>;
};
export class LuckyClient {
  // TypeScript parameter properties initialize the transport dependencies.
  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(
    private key: () => string,
    private base = 'https://luckystats.gg/api/integrations/v1',
    private parryKey: () => string = () => '',
  ) {
    // Dependencies are initialized by TypeScript parameter properties.
  }

  async api(
    route: string,
    method?: string,
    body?: unknown,
    idempotency?: string,
  ): Promise<any> {
    let response: Response;
    try {
      response = await fetch(`${this.base}/${route}`, {
        method: method || 'GET',
        headers: {
          Authorization: `Bearer ${this.key()}`,
          'X-App-Id': 'replay-reporter',
          'Content-Type': 'application/json',
          ...(this.parryKey() ? { 'X-Parry-API-Key': this.parryKey() } : {}),
          ...(idempotency ? { 'Idempotency-Key': idempotency } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(60000),
        redirect: 'error',
      });
    } catch {
      throw new LuckyError(
        'Could not reach Lucky Stats. Retrying automatically.',
        true,
      );
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code =
        typeof data.error === 'string' && /^[a-z_]+$/.test(data.error)
          ? data.error
          : 'request_failed';
      const retry = response.status === 429 || response.status >= 500;
      const header = response.headers.get('Retry-After');
      const seconds =
        Number(header) ||
        Math.max(0, (Date.parse(header || '') - Date.now()) / 1000) ||
        0;
      throw new LuckyError(
        `Lucky Stats: ${code} (${response.status}).`,
        retry,
        seconds * 1000,
        code,
      );
    }
    return data;
  }

  // Kept on the transport interface so queue tests can replace storage independently.
  // eslint-disable-next-line class-methods-use-this
  async put(
    file: ApprovedFile,
    source: string,
    progress: (bytes: number) => void,
  ) {
    const url = new URL(file.url);
    if (
      url.protocol !== 'https:' ||
      !/(^|\.)amazonaws\.com$/.test(url.hostname)
    )
      throw new LuckyError('Unexpected upload storage address.');
    await new Promise<void>((resolve, reject) => {
      const input = createReadStream(source);
      let bytes = 0;
      // Only the signed storage headers are sent; never the Lucky Stats key.
      const req = request(
        url,
        { method: 'PUT', headers: file.headers },
        (response) => {
          response.resume();
          if (
            ((response.statusCode || 0) >= 200 &&
              (response.statusCode || 0) < 300) ||
            response.statusCode === 412
          )
            resolve();
          else
            reject(
              new LuckyError(
                'Storage transfer failed. Retrying automatically.',
                true,
              ),
            );
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error('Transfer timed out')),
        300000,
      );
      req.on('close', () => {
        clearTimeout(timer);
        input.destroy();
      });
      req.on('error', () =>
        reject(
          new LuckyError(
            'Storage transfer interrupted. Retrying automatically.',
            true,
          ),
        ),
      );
      input.on('error', () => {
        req.destroy();
        reject(new LuckyError('Queued game data could not be read.'));
      });
      input.on('data', (chunk) => {
        bytes += chunk.length;
        progress(bytes);
      });
      input.pipe(req);
    });
  }
}
