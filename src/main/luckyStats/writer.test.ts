/** @jest-environment node */
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { writeReplays } from '../replay';
import { Context, CopyHostOrClient, Output, Replay } from '../../common/types';
import type { SourceFile } from './queue';

jest.mock('../host', () => ({ writeZip: jest.fn(async () => {}) }));
it.each(
  [Output.FOLDER, Output.ZIP, Output.FILES].flatMap(
    (output) =>
      [
        [output, false],
        [output, true],
      ] as const,
  ),
)(
  'hands finalized bytes to the upload queue for output %s (Parry: %s)',
  async (output, parry) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'lucky-writer-'));
    try {
      // Storage/writer fixture only, deliberately not a playable game.
      const input = Buffer.alloc(16);
      input.writeUInt32BE(1, 11);
      input[15] = 0x39;
      const source = path.join(root, 'source.slp');
      await writeFile(source, input);
      const context = {
        startgg: {
          set: parry
            ? { id: null, internalId: '01a0bc51-736d-761d-b6ed-042418c5cd14' }
            : { id: 123 },
        },
      } as Context;
      const callback = jest.fn(async (files: SourceFile[]) => {
        const game = files.find((f) => f.name === 'game.slp')!;
        const actual =
          'bytes' in game ? game.bytes : await readFile(game.source);
        expect(actual).toEqual(input);
        const metadata = files.find((f) => f.name === 'context.json')!;
        const json =
          'bytes' in metadata
            ? metadata.bytes
            : await readFile(metadata.source);
        expect(JSON.parse(json.toString())).toEqual(context);
      });
      await writeReplays(
        root,
        { address: '' } as CopyHostOrClient,
        ['game.slp'],
        output,
        [
          {
            filePath: source,
            fileName: 'source.slp',
            lastFrame: 100,
          } as Replay,
        ],
        [],
        output === Output.FILES ? '' : 'set',
        false,
        context,
        callback,
      );
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
