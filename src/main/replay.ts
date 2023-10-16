import { decode } from '@shelacek/ubjson';
import { mkdir, open, readdir } from 'fs/promises';
import { join } from 'path';
import iconv from 'iconv-lite';
import sanitize from 'sanitize-filename';
import { Player, Replay } from '../common/types';
import { isValidCharacter, legalStages } from '../common/constants';

const RAW_HEADER_START = Buffer.from([
  0x7b, 0x55, 0x03, 0x72, 0x61, 0x77, 0x5b, 0x24, 0x55, 0x23, 0x6c,
]);

export async function getReplaysInDir(dir: string) {
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
        const metadataOffset = rawHeader.subarray(11, 15).readUInt32BE() + 15;

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
            gameStartSize = payloads.subarray(i + 1, i + 3).readUInt16BE() + 1;
          } else if (payloads[i] === 0x39) {
            gameEndSize = payloads.subarray(i + 1, i + 3).readUint16BE() + 1;
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
          players[i] = {
            overrideWin: false,
            playerOverrides: { displayName: '', entrantId: 0 },
            playerType: gameStart[offset + 1],
            port: i + 1,
          } as Player;
          if (players[i].playerType === 1) {
            isValid = false;
          }
          if (players[i].playerType === 0 || players[i].playerType === 1) {
            players[i].costumeIndex = gameStart[offset + 3];
            players[i].externalCharacterId = gameStart[offset];
            if (!isValidCharacter(players[i].externalCharacterId)) {
              isValid = false;
            }
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
        if (
          gameEnd[0] !== 0x39 ||
          (gameEnd[1] !== 1 && gameEnd[1] !== 2 && gameEnd[1] !== 3)
        ) {
          for (let i = 0; i < 4; i += 1) {
            players[i].isWinner = false;
          }
          isValid = false;
        } else {
          for (let i = 0; i < 4; i += 1) {
            players[i].isWinner = gameEnd[i + 3] === 0;
          }
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
}

const narrowSpecialChars = new Map([
  [0x21, [0x81, 0x49]], // !
  [0x22, [0x81, 0x68]], // "
  [0x23, [0x81, 0x94]], // #
  [0x24, [0x81, 0x90]], // $
  [0x25, [0x81, 0x93]], // %
  [0x26, [0x81, 0x95]], // &
  [0x27, [0x81, 0x66]], // '
  [0x28, [0x81, 0x69]], // (
  [0x29, [0x81, 0x6a]], // )
  [0x2a, [0x81, 0x96]], // *
  [0x2b, [0x81, 0x7b]], // +
  [0x2c, [0x81, 0x43]], // ,
  [0x2d, [0x81, 0x7c]], // -
  [0x2e, [0x81, 0x44]], // .
  [0x2f, [0x81, 0x5e]], // /
  [0x3a, [0x81, 0x46]], // :
  [0x3b, [0x81, 0x47]], // ;
  [0x3c, [0x81, 0x83]], // <
  [0x3d, [0x81, 0x81]], // =
  [0x3e, [0x81, 0x84]], // >
  [0x3f, [0x81, 0x48]], // ?
  [0x40, [0x81, 0x97]], // @
  [0x5b, [0x81, 0x6d]], // [
  [0x5c, [0x81, 0x5f]], // \
  [0x5d, [0x81, 0x6e]], // ]
  [0x5e, [0x81, 0x4f]], // ^
  [0x5f, [0x81, 0x51]], // _
  [0x60, [0x81, 0x4d]], // `
  [0x7b, [0x81, 0x6f]], // {
  [0x7c, [0x81, 0x62]], // |
  [0x7d, [0x81, 0x70]], // }
  [0x7e, [0x81, 0x60]], // ~
]);

const START_AT_TAG = Buffer.from([
  0x55, 0x07, 0x73, 0x74, 0x61, 0x72, 0x74, 0x41, 0x74, 0x53, 0x55,
]);

export async function writeReplays(
  dir: string,
  fileNames: string[],
  replays: Replay[],
  startTimes: string[],
  subdir: string,
  writeDisplayNames: boolean,
) {
  if (fileNames.length > 0 && fileNames.length !== replays.length) {
    throw new Error(
      `${fileNames.length} file names, ${replays.length} replays`,
    );
  }
  if (startTimes.length > 0 && startTimes.length !== replays.length) {
    throw new Error(
      `${startTimes.length} start times, ${replays.length} replays`,
    );
  }

  const sanitizedFileNames = fileNames.map((fileName) => sanitize(fileName));
  const sanitizedSubdir = sanitize(subdir);

  const writeDir = join(dir, sanitizedSubdir);
  if (sanitizedSubdir) {
    await mkdir(writeDir);
  }

  const writeFilePromises = replays.map(async (replay, i) => {
    const readFile = await open(replay.filePath);

    const writeFileName = sanitizedFileNames.length
      ? sanitizedFileNames[i]
      : replay.fileName;
    const writeFile = await open(join(writeDir, writeFileName), 'w');

    try {
      // raw element
      const rawHeader = Buffer.alloc(15);
      const rawHeaderRes = await readFile.read(rawHeader, 0, 15, 0);
      if (rawHeaderRes.bytesRead !== 15) {
        throw Error('raw element header');
      }
      await writeFile.write(rawHeader);

      const rawElementLength = rawHeader.subarray(11, 15).readUInt32BE();
      const rawElement = Buffer.alloc(rawElementLength);
      const rawElementRes = await readFile.read(
        rawElement,
        0,
        rawElementLength,
        15,
      );
      if (rawElementRes.bytesRead !== rawElementLength) {
        throw Error('raw element');
      }

      // display names?
      if (writeDisplayNames) {
        const payloadsSize = rawElement[1] - 1;
        const gameStartOffset = payloadsSize + 2;

        replay.players.forEach((player, j) => {
          const { displayName } = player.playerOverrides;
          if (!displayName) {
            return;
          }

          const offset = j * 31 + 421 + gameStartOffset;
          const newDisplayNameBuffer = iconv.encode(displayName, 'Shift_JIS');
          const fixedDisplayNameArr: number[] = [];
          newDisplayNameBuffer.forEach((byte) => {
            const fixedByte = narrowSpecialChars.get(byte);
            if (fixedByte) {
              fixedDisplayNameArr.push(...fixedByte);
            } else {
              fixedDisplayNameArr.push(byte);
            }
          });
          Buffer.from(fixedDisplayNameArr).copy(rawElement, offset);
        });
      }
      await writeFile.write(rawElement);

      // metadata
      const metadataOffset = rawElementLength + 15;
      const metadataLength = (await readFile.stat()).size - metadataOffset;
      const metadata = Buffer.alloc(metadataLength);
      const metadataRes = await readFile.read(
        metadata,
        0,
        metadataLength,
        metadataOffset,
      );
      if (metadataRes.bytesRead !== metadataLength) {
        throw Error('metadata');
      }

      // startTimes?
      if (startTimes.length) {
        const startAtTagOffset = metadata.indexOf(START_AT_TAG);
        const startAtLength = metadata[startAtTagOffset + START_AT_TAG.length];
        if (startAtLength === 24) {
          const startAtOffset = startAtTagOffset + START_AT_TAG.length + 1;
          Buffer.from(startTimes[i]).copy(metadata, startAtOffset);
        }
      }
      return await writeFile.write(metadata);
    } finally {
      readFile.close();
      writeFile.close();
    }
  });
  await Promise.all(writeFilePromises);
}
