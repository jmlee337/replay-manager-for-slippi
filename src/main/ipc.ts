import { decode } from '@shelacek/ubjson';
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import { open, readdir } from 'fs/promises';
import { join } from 'path';
import iconv from 'iconv-lite';
import Store from 'electron-store';
import { Player, Replay } from '../common/types';
import { legalStages } from '../common/constants';
import { getTournament } from './startgg';

const RAW_HEADER_START = Buffer.from([
  0x7b, 0x55, 0x03, 0x72, 0x61, 0x77, 0x5b, 0x24, 0x55, 0x23, 0x6c,
]);

export default function setupIPCs(): void {
  ipcMain.handle('chooseDir', async () =>
    dialog.showOpenDialog({ properties: ['openDirectory', 'showHiddenFiles'] }),
  );
  ipcMain.handle(
    'getReplaysInDir',
    async (event: IpcMainInvokeEvent, dir: string) => {
      const filenames = await readdir(dir);

      const objs = filenames
        .filter((fileName) => fileName.endsWith('.slp'))
        .map(async (fileName): Promise<Replay | null> => {
          const filePath = join(dir, fileName);

          let fileHandle;
          try {
            fileHandle = await open(filePath);
          } catch (e: any) {
            return null;
          }

          try {
            // raw header
            const rawHeader = Buffer.alloc(15);
            const rawHeaderRes = await fileHandle.read(rawHeader, 0, 15, 0);
            if (rawHeaderRes.bytesRead !== 15) {
              return null;
            }
            if (!rawHeader.subarray(0, 11).equals(RAW_HEADER_START)) {
              return null;
            }
            const metadataOffset =
              rawHeader.subarray(11, 15).readUInt32BE() + 15;

            // event payloads header
            const payloadsHeader = Buffer.alloc(2);
            const payloadsHeaderRes = await fileHandle.read(
              payloadsHeader,
              0,
              2,
              15,
            );
            if (payloadsHeaderRes.bytesRead !== 2) {
              return null;
            }
            if (payloadsHeader[0] !== 0x35) {
              return null;
            }

            // event payloads
            const payloadsSize = payloadsHeader[1] - 1;
            const payloads = Buffer.alloc(payloadsSize);
            const payloadsRes = await fileHandle.read(
              payloads,
              0,
              payloadsSize,
              17,
            );
            if (payloadsRes.bytesRead !== payloadsSize) {
              return null;
            }
            let gameStartSize = 0;
            let gameEndSize = 0;
            for (let i = 0; i < payloadsSize; i += 3) {
              if (payloads[i] === 0x36) {
                gameStartSize =
                  payloads.subarray(i + 1, i + 3).readUInt16BE() + 1;
              } else if (payloads[i] === 0x39) {
                gameEndSize =
                  payloads.subarray(i + 1, i + 3).readUint16BE() + 1;
              }
            }
            if (gameStartSize === 0 || gameEndSize === 0) {
              return null;
            }
            const gameEndOffset = metadataOffset - gameEndSize;

            // game start
            const gameStart = Buffer.alloc(gameStartSize);
            const gameStartRes = await fileHandle.read(
              gameStart,
              0,
              gameStartSize,
              17 + payloadsSize,
            );
            if (gameStartRes.bytesRead !== gameStartSize) {
              return null;
            }
            if (gameStart[0] !== 0x36) {
              return null;
            }

            const version = gameStart.readUint32BE(1);
            if (version < 0x030d0000) {
              // Display Names/Connect Codes added in 3.9.0
              // Player Placements added in 3.13.0
              // TODO support older files
              return null;
            }

            const isTeams = gameStart[13] === 1;
            const stageId = gameStart.subarray(19, 21).readUint16BE();
            let isValid = true;
            if (!legalStages.has(stageId)) {
              isValid = false;
            }

            const players: Player[] = new Array<Player>(4);
            for (let i = 0; i < 4; i += 1) {
              const offset = i * 36 + 101;
              players[i] = {} as Player;
              players[i].playerType = gameStart[offset + 1];
              if (players[i].playerType === 1) {
                isValid = false;
              }
              players[i].port = i + 1;
              if (players[i].playerType === 0 || players[i].playerType === 1) {
                players[i].costumeIndex = gameStart[offset + 3];
                players[i].externalCharacterId = gameStart[offset];
                if (players[i].externalCharacterId > 0x19) {
                  isValid = false;
                }
                players[i].teamId = gameStart[offset + 9];
              }
            }

            for (let i = 0; i < 4; i += 1) {
              const offset = i * 16 + 353;
              const nametag = iconv
                .decode(gameStart.subarray(offset, offset + 16), 'Shift_JIS')
                .split('\0')
                .shift();
              if (nametag) {
                players[i].nametag = nametag;
              }
            }

            for (let i = 0; i < 4; i += 1) {
              const offset = i * 31 + 421;
              const displayName = iconv
                .decode(gameStart.subarray(offset, offset + 31), 'Shift_JIS')
                .split('\0')
                .shift();
              if (displayName) {
                players[i].displayName = displayName;
              }
            }

            for (let i = 0; i < 4; i += 1) {
              const offset = i * 10 + 545;
              const connectCode = iconv
                .decode(gameStart.subarray(offset, offset + 10), 'Shift_JIS')
                .split('\0')
                .shift();
              if (connectCode) {
                players[i].connectCode = connectCode;
              }
            }

            // game end
            const gameEnd = Buffer.alloc(gameEndSize);
            const gameEndRes = await fileHandle.read(
              gameEnd,
              0,
              gameEndSize,
              gameEndOffset,
            );
            if (gameEndRes.bytesRead !== gameEndSize) {
              return null;
            }
            if (gameEnd[0] !== 0x39) {
              // TODO maybe support replays with not game end event
              return null;
            }
            if (gameEnd[1] === 1 || gameEnd[1] === 2) {
              for (let i = 0; i < 4; i += 1) {
                players[i].isWinner = gameEnd[i + 3] === 0;
              }
            } else {
              isValid = false;
            }

            // metadata
            const fileSize = (await fileHandle.stat()).size;
            const metadataLength = fileSize - metadataOffset;
            if (metadataLength <= 0) {
              return null;
            }

            const metadata = Buffer.alloc(metadataLength);
            const metadataReadRes = await fileHandle.read(
              metadata,
              0,
              metadataLength,
              metadataOffset,
            );
            if (metadataReadRes.bytesRead !== metadataLength) {
              return null;
            }

            const concatBuffer = Buffer.from(new Uint8Array([0x7b]));
            const metadataUbjson = Buffer.concat([concatBuffer, metadata]);
            const obj = decode(metadataUbjson);
            const { lastFrame } = obj.metadata;
            if (lastFrame < 3596) {
              isValid = false;
            }

            return {
              fileName,
              filePath,
              isTeams,
              isValid,
              lastFrame,
              players,
              selected: false,
              stageId,
              startAt: obj.metadata.startAt,
            };
          } catch (e: any) {
            return null;
          } finally {
            fileHandle.close();
          }
        });
      return (await Promise.all(objs)).filter((obj) => obj);
    },
  );

  const store = new Store();
  let startggKey = store.get('startggKey') as string;
  ipcMain.handle('getTournament', (event: IpcMainInvokeEvent, slug: string) => {
    if (!startggKey) {
      throw Error('start.gg api key not set.');
    }

    return getTournament(startggKey, slug);
  });
  ipcMain.handle('getStartggKey', () => store.get('startggKey') as string);
  ipcMain.handle(
    'setStartggKey',
    (event: IpcMainInvokeEvent, newStartggKey: string) => {
      store.set('startggKey', newStartggKey);
      startggKey = newStartggKey;
    },
  );
}
