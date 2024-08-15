import { decode } from '@shelacek/ubjson';
import {
  mkdir,
  open,
  readFile as fsReadFile,
  readdir,
  rm,
  access,
  FileHandle,
} from 'fs/promises';
import { join } from 'path';
import iconv from 'iconv-lite';
import sanitize from 'sanitize-filename';
import { ZipFile } from 'yazl';
import { createWriteStream } from 'fs';
import {
  ListChecks,
  SlippiGame,
  getCoordListFromGame,
  isBoxController,
  isSlpMinVersion,
} from 'slp-enforcer';
import { app } from 'electron';
import { parse } from 'date-fns';
import {
  Context,
  EnforcePlayerFailure,
  EnforceResult,
  InvalidReplay,
  Output,
  Player,
  Replay,
} from '../common/types';
import {
  frameMsDivisor,
  isValidCharacter,
  legalStages,
} from '../common/constants';

// https://github.com/project-slippi/slippi-launcher/blob/ae8bb69e235b6e46b24bc966aeaa80f45030c6f9/src/replays/file_system_replay_provider/load_file.ts#L91-L101
// ty vince
function filenameToDateAndTime(fileName: string) {
  const timeReg = /\d{8}T\d{6}/g;
  const filenameTime = fileName.match(timeReg);

  if (filenameTime == null) {
    return undefined;
  }

  const time = parse(filenameTime[0], "yyyyMMdd'T'HHmmss", new Date());
  return time;
}

const RAW_HEADER_START = Buffer.from([
  0x7b, 0x55, 0x03, 0x72, 0x61, 0x77, 0x5b, 0x24, 0x55, 0x23, 0x6c,
]);

async function getLastFrame(
  start: number,
  end: number,
  fileHandle: FileHandle,
  payloadSizes: Map<number, number>,
) {
  let lastFrame = -124;
  let offset = start;
  while (offset < end) {
    const eventCode = Buffer.alloc(1);
    // eslint-disable-next-line no-await-in-loop
    const eventCodeReadRes = await fileHandle.read(eventCode, 0, 1, offset);
    if (eventCodeReadRes.bytesRead !== 1) {
      break;
    }
    const eventLength = payloadSizes.get(eventCode[0]);
    if (!eventLength) {
      break;
    }
    // Frame Bookend -> Latest Finalized Frame available from 3.7.0.
    // We enforce version >= 3.13.0 so this should always be available.
    if (eventCode[0] === 0x3c) {
      const frameNumberBuf = Buffer.alloc(4);
      // eslint-disable-next-line no-await-in-loop
      const frameNumberReadRes = await fileHandle.read(
        frameNumberBuf,
        0,
        4,
        offset + 5,
      );
      if (frameNumberReadRes.bytesRead !== 4) {
        break;
      }
      lastFrame = frameNumberBuf.readUint32BE();
    }
    offset = offset + 1 + eventLength;
  }
  return lastFrame;
}

export async function getReplaysInDir(
  dir: string,
): Promise<{ replays: Replay[]; invalidReplays: InvalidReplay[] }> {
  const filenames = await readdir(dir);

  const objs = filenames
    .filter((fileName) => fileName.endsWith('.slp'))
    .map(async (fileName): Promise<Replay | InvalidReplay> => {
      const filePath = join(dir, fileName);

      let fileHandle;
      try {
        fileHandle = await open(filePath);
      } catch (e: any) {
        const invalidReason = e instanceof Error ? e.message : e;
        return { fileName, invalidReason };
      }

      try {
        // raw header
        const rawHeader = Buffer.alloc(15);
        const rawHeaderRes = await fileHandle.read(rawHeader, 0, 15, 0);
        if (rawHeaderRes.bytesRead !== 15) {
          return { fileName, invalidReason: 'File corrupted.' };
        }
        if (!rawHeader.subarray(0, 11).equals(RAW_HEADER_START)) {
          return { fileName, invalidReason: 'File corrupted.' };
        }
        const replayLength = rawHeader.subarray(11, 15).readUInt32BE();
        const metadataOffset = replayLength + 15;

        // event payloads header
        const payloadsHeader = Buffer.alloc(2);
        const payloadsHeaderRes = await fileHandle.read(
          payloadsHeader,
          0,
          2,
          15,
        );
        if (payloadsHeaderRes.bytesRead !== 2) {
          return { fileName, invalidReason: 'File corrupted.' };
        }
        if (payloadsHeader[0] !== 0x35) {
          return { fileName, invalidReason: 'File corrupted.' };
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
          return { fileName, invalidReason: 'File corrupted.' };
        }
        const payloadSizes = new Map<number, number>();
        let gameStartSize = 0;
        let gameEndSize = 0;
        for (let i = 0; i < payloadsSize; i += 3) {
          const payloadSize = payloads.subarray(i + 1, i + 3).readUInt16BE();
          payloadSizes.set(payloads[i], payloadSize);
          if (payloads[i] === 0x36) {
            gameStartSize = payloadSize + 1;
          } else if (payloads[i] === 0x39) {
            gameEndSize = payloadSize + 1;
          }
        }
        if (gameStartSize === 0 || gameEndSize === 0) {
          return { fileName, invalidReason: 'File corrupted.' };
        }

        // game start
        const gameStart = Buffer.alloc(gameStartSize);
        const gameStartRes = await fileHandle.read(
          gameStart,
          0,
          gameStartSize,
          17 + payloadsSize,
        );
        if (gameStartRes.bytesRead !== gameStartSize) {
          return { fileName, invalidReason: 'File corrupted.' };
        }
        if (gameStart[0] !== 0x36) {
          return { fileName, invalidReason: 'File corrupted.' };
        }

        const version = gameStart.readUint32BE(1);
        if (version < 0x030d0000) {
          // Display Names/Connect Codes added in 3.9.0
          // Player Placements added in 3.13.0
          return {
            fileName,
            invalidReason: 'Replay version too old. Update Slippi Nintendont.',
          };
        }

        const isTeams = gameStart[13] === 1;
        const stageId = gameStart.subarray(19, 21).readUint16BE();
        const gameTimerSeconds = gameStart.subarray(21, 25).readUint32BE();
        const invalidReasons: string[] = [];
        if (!legalStages.has(stageId)) {
          invalidReasons.push('Illegal stage.');
        }
        if (gameTimerSeconds > 480) {
          invalidReasons.push('Game timer > 8 minutes.');
        }

        const teamSizes = new Map<number, number>();
        let numPlayers = 0;
        let hasCPUPlayers = false;
        let hasIllegalCharacters = false;
        let nonStandardStockCount = false;
        const players: Player[] = new Array<Player>(4);
        for (let i = 0; i < 4; i += 1) {
          const offset = i * 36 + 101;
          const teamId = isTeams ? gameStart[offset + 9] : -1;
          players[i] = {
            isWinner: false,
            playerOverrides: { displayName: '', entrantId: 0 },
            playerType: gameStart[offset + 1],
            port: i + 1,
            teamId,
          } as Player;
          if (players[i].playerType === 0 || players[i].playerType === 1) {
            numPlayers += 1;
            players[i].costumeIndex = gameStart[offset + 3];
            players[i].externalCharacterId = gameStart[offset];
            if (isTeams) {
              const currTeamSize = teamSizes.get(teamId) || 0;
              teamSizes.set(teamId, currTeamSize + 1);
            }
            if (players[i].playerType === 1) {
              hasCPUPlayers = true;
            }
            if (!isValidCharacter(players[i].externalCharacterId)) {
              hasIllegalCharacters = true;
            }
            if (gameStart[offset + 2] !== 4) {
              nonStandardStockCount = true;
            }
          }
        }

        if (hasCPUPlayers) {
          invalidReasons.push('Has CPU Player(s).');
        }
        if (hasIllegalCharacters) {
          invalidReasons.push('Has illegal character(s).');
        }
        if (nonStandardStockCount) {
          invalidReasons.push('Non standard starting stock count.');
        }
        if (numPlayers !== 2 && numPlayers !== 4) {
          invalidReasons.push('Not singles or doubles.');
        } else if (numPlayers === 4) {
          if (isTeams) {
            const teamSizesArr = Array.from(teamSizes.values());
            if (
              teamSizesArr.length !== 2 ||
              teamSizesArr[0] !== teamSizesArr[1]
            ) {
              invalidReasons.push('Not singles or doubles.');
            }
          } else {
            invalidReasons.push('Not singles or doubles.');
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

        const fileSize = (await fileHandle.stat()).size;
        if (replayLength > 0) {
          // game end
          const gameEndOffset = metadataOffset - gameEndSize;
          const gameEnd = Buffer.alloc(gameEndSize);
          const gameEndRes = await fileHandle.read(
            gameEnd,
            0,
            gameEndSize,
            gameEndOffset,
          );
          if (gameEndRes.bytesRead !== gameEndSize || gameEnd[0] !== 0x39) {
            invalidReasons.push('Game end event not found.');
            const lastFrame = await getLastFrame(
              17 + payloadsSize + gameStartSize, // start
              replayLength + 15, // end
              fileHandle,
              payloadSizes,
            );
            return {
              fileName,
              filePath,
              invalidReasons,
              isTeams,
              lastFrame,
              players,
              selected: false,
              stageId,
              startAt: filenameToDateAndTime(fileName),
              timeout: lastFrame === gameTimerSeconds * 60,
            };
          }
          if (gameEnd[1] !== 1 && gameEnd[1] !== 2 && gameEnd[1] !== 3) {
            invalidReasons.push('No contest.');
          } else {
            for (let i = 0; i < 4; i += 1) {
              players[i].isWinner = gameEnd[i + 3] === 0;
            }
          }

          // metadata
          const metadataLength = fileSize - metadataOffset;
          if (metadataLength <= 0) {
            invalidReasons.push('Metadata not present.');
            const lastFrame = await getLastFrame(
              17 + payloadsSize + gameStartSize, // start
              replayLength + 15, // end
              fileHandle,
              payloadSizes,
            );
            return {
              fileName,
              filePath,
              invalidReasons,
              isTeams,
              lastFrame,
              players,
              selected: false,
              stageId,
              startAt: filenameToDateAndTime(fileName),
              timeout: lastFrame === gameTimerSeconds * 60 && gameEnd[1] === 1,
            };
          }

          const metadata = Buffer.alloc(metadataLength);
          const metadataReadRes = await fileHandle.read(
            metadata,
            0,
            metadataLength,
            metadataOffset,
          );
          if (metadataReadRes.bytesRead !== metadataLength) {
            invalidReasons.push('Metadata corrupted.');
            const lastFrame = await getLastFrame(
              17 + payloadsSize + gameStartSize, // start
              replayLength + 15, // end
              fileHandle,
              payloadSizes,
            );
            return {
              fileName,
              filePath,
              invalidReasons,
              isTeams,
              lastFrame,
              players,
              selected: false,
              stageId,
              startAt: filenameToDateAndTime(fileName),
              timeout: lastFrame === gameTimerSeconds * 60 && gameEnd[1] === 1,
            };
          }

          const concatBuffer = Buffer.from(new Uint8Array([0x7b]));
          const metadataUbjson = Buffer.concat([concatBuffer, metadata]);
          const obj = decode(metadataUbjson);
          let { lastFrame } = obj.metadata;
          if (!Number.isInteger(lastFrame)) {
            lastFrame = getLastFrame(
              17 + payloadsSize + gameStartSize, // start
              replayLength + 15, // end
              fileHandle,
              payloadSizes,
            );
          } else if (lastFrame <= 3476 /* 3600 - 124 */) {
            invalidReasons.push('Game duration less than 1 minute.');
          } else if (lastFrame === 3600 && gameEnd[1] === 1) {
            invalidReasons.push('1 minute timed game.');
          }
          let startAt: Date | undefined = new Date(obj.metadata.startAt);
          if (!startAt || Number.isNaN(startAt.getTime())) {
            startAt = filenameToDateAndTime(fileName);
          }
          return {
            fileName,
            filePath,
            invalidReasons,
            isTeams,
            lastFrame,
            players,
            selected: false,
            stageId,
            startAt,
            timeout: lastFrame === gameTimerSeconds * 60 && gameEnd[1] === 1,
          };
        }

        // if we reach this point, the file is incomplete.
        // try to derive lastFrame and startAt
        invalidReasons.push('Incomplete file.');
        const lastFrame = await getLastFrame(
          17 + payloadsSize + gameStartSize, // start
          fileSize, // end
          fileHandle,
          payloadSizes,
        );
        return {
          fileName,
          filePath,
          invalidReasons,
          isTeams,
          lastFrame,
          players,
          selected: false,
          stageId,
          startAt: filenameToDateAndTime(fileName),
          timeout: lastFrame === gameTimerSeconds * 60,
        };
      } catch (e: any) {
        const invalidReason = e instanceof Error ? e.message : e;
        return { fileName, invalidReason };
      } finally {
        fileHandle.close();
      }
    });

  const replays = (
    (await Promise.all(objs)).filter(
      (replayOrInvalidReplay) =>
        !(<InvalidReplay>replayOrInvalidReplay).invalidReason,
    ) as Replay[]
  ).sort((replayA, replayB) => {
    if (replayA.startAt && replayB.startAt) {
      const diff = replayA.startAt.getTime() - replayB.startAt.getTime();
      if (diff) {
        return diff;
      }
    }
    if (replayA.startAt) {
      return -1;
    }
    if (replayB.startAt) {
      return 1;
    }
    return replayA.fileName.localeCompare(replayB.fileName);
  });
  if (replays.length > 1 && replays[0].startAt) {
    for (let i = 0; i < replays.length - 1; i += 1) {
      if (replays[i + 1].startAt === undefined) {
        const durationMs = Math.ceil(
          (replays[i].lastFrame + 124) / frameMsDivisor,
        );
        replays[i + 1].startAt = new Date(
          replays[i].startAt!.getTime() + durationMs,
        );
      }
    }
  }

  const invalidReplays = (
    (await Promise.all(objs)).filter(
      (replayOrInvalidReplay) =>
        (<InvalidReplay>replayOrInvalidReplay).invalidReason,
    ) as InvalidReplay[]
  ).sort((invalidReplayA, invalidReplayB) =>
    invalidReplayA.fileName.localeCompare(invalidReplayB.fileName),
  );
  return { replays, invalidReplays };
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

const METADATA = Buffer.from([
  0x55, 0x08, 0x6d, 0x65, 0x74, 0x61, 0x64, 0x61, 0x74, 0x61, 0x7b,
]);

const START_AT_PREFIX = Buffer.from([
  0x55, 0x07, 0x73, 0x74, 0x61, 0x72, 0x74, 0x41, 0x74, 0x53, 0x55,
]);

const LAST_FRAME_PREFIX = Buffer.from([
  0x55, 0x09, 0x6c, 0x61, 0x73, 0x74, 0x46, 0x72, 0x61, 0x6d, 0x65, 0x6c,
]);

const PLAYED_ON = Buffer.from([
  0x55, 0x08, 0x70, 0x6c, 0x61, 0x79, 0x65, 0x64, 0x4f, 0x6e, 0x53, 0x55, 0x0a,
  0x6e, 0x69, 0x6e, 0x74, 0x65, 0x6e, 0x64, 0x6f, 0x6e, 0x74, 0x7d, 0x7d,
]);

export async function writeReplays(
  dir: string,
  fileNames: string[],
  output: Output,
  replays: Replay[],
  startTimes: string[],
  subdir: string,
  writeDisplayNames: boolean,
  context: Context | undefined,
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

  const writeDir =
    output === Output.ZIP
      ? join(app.getPath('temp'), sanitizedSubdir)
      : join(dir, sanitizedSubdir);
  const writeFilePromises: Promise<{
    writeFilePath: string;
    writeFileName: string;
  }>[] = [];
  if (sanitizedSubdir) {
    if (output === Output.ZIP) {
      const tempDir = app.getPath('temp');
      await access(tempDir).catch(() => mkdir(tempDir));
    }
    await mkdir(writeDir);
    if (context) {
      const contextFilePath = join(writeDir, 'context.json');
      const contextFile = await open(contextFilePath, 'w');
      await contextFile.writeFile(JSON.stringify(context));
      await contextFile.close();
      writeFilePromises.push(
        Promise.resolve({
          writeFilePath: contextFilePath,
          writeFileName: 'context.json',
        }),
      );
    }
  } else if (output === Output.FOLDER || output === Output.ZIP) {
    throw new Error('subdir');
  }

  const replayFilePromises = replays.map(async (replay, i) => {
    const readFile = await open(replay.filePath);

    const writeFileName = sanitizedFileNames.length
      ? sanitizedFileNames[i]
      : replay.fileName;
    const writeFilePath = join(writeDir, writeFileName);
    const writeFile = await open(writeFilePath, 'w');

    try {
      // raw element
      const rawHeader = Buffer.alloc(15);
      const rawHeaderRes = await readFile.read(rawHeader, 0, 15, 0);
      if (rawHeaderRes.bytesRead !== 15) {
        throw new Error('raw element header read');
      }

      const fileSize = (await readFile.stat()).size;
      const rawElementLength = rawHeader.subarray(11, 15).readUInt32BE();
      const rawElementReadLength =
        rawElementLength > 0 ? rawElementLength : fileSize - 15;
      if (rawElementLength === 0) {
        const actualRawElementLength = Buffer.alloc(4);
        actualRawElementLength.writeUint32BE(rawElementReadLength);
        actualRawElementLength.copy(rawHeader, 11);
      }

      const rawHeaderWrite = await writeFile.write(rawHeader);
      if (rawHeaderWrite.bytesWritten !== 15) {
        throw new Error('raw element header write');
      }

      const rawElement = Buffer.alloc(rawElementReadLength);
      const rawElementRes = await readFile.read(
        rawElement,
        0,
        rawElementReadLength,
        15,
      );
      if (rawElementRes.bytesRead !== rawElementReadLength) {
        throw new Error('raw element read');
      }

      if (writeDisplayNames) {
        const payloadsSize = rawElement[1] - 1;
        const gameStartOffset = payloadsSize + 2;

        replay.players.forEach((player, j) => {
          const { displayName } = player.playerOverrides;
          if (!displayName) {
            return;
          }

          const offset = j * 31 + 421 + gameStartOffset;
          const newDisplayNameBuffer = iconv.encode(
            displayName.slice(0, 15),
            'Shift_JIS',
          );
          const fixedDisplayNameArr: number[] = [];
          newDisplayNameBuffer.forEach((byte) => {
            const fixedByte = narrowSpecialChars.get(byte);
            if (fixedByte) {
              fixedDisplayNameArr.push(...fixedByte);
            } else {
              fixedDisplayNameArr.push(byte);
            }
          });
          if (fixedDisplayNameArr.length < 31) {
            const oldLength = fixedDisplayNameArr.length;
            fixedDisplayNameArr.length = 31;
            fixedDisplayNameArr.fill(0, oldLength);
          }
          Buffer.from(fixedDisplayNameArr).copy(rawElement, offset);
        });
      }
      const rawElementWrite = await writeFile.write(rawElement);
      if (rawElementWrite.bytesWritten !== rawElementReadLength) {
        throw new Error('raw element write');
      }

      // metadata
      if (rawElementLength > 0) {
        const metadataOffset = rawElementLength + 15;
        const metadataLength = fileSize - metadataOffset;
        const metadata = Buffer.alloc(metadataLength);
        const metadataRes = await readFile.read(
          metadata,
          0,
          metadataLength,
          metadataOffset,
        );
        if (metadataRes.bytesRead !== metadataLength) {
          throw new Error('metadata read');
        }

        // startTimes?
        if (startTimes.length) {
          const startAtTagOffset = metadata.indexOf(START_AT_TAG);
          const startAtLengthOffset = startAtTagOffset + START_AT_TAG.length;
          const startAtLength = metadata[startAtLengthOffset];
          const newStartAtLength = startTimes[i].length;
          const diff = newStartAtLength - startAtLength;
          const newMetadata = Buffer.alloc(metadataLength + diff);
          metadata.copy(newMetadata, 0, 0, startAtLengthOffset);
          newMetadata[startAtLengthOffset] = newStartAtLength;
          Buffer.from(startTimes[i]).copy(newMetadata, startAtLengthOffset + 1);
          metadata.copy(
            newMetadata,
            startAtLengthOffset + newStartAtLength + 1,
            startAtLengthOffset + startAtLength + 1,
          );
          const newMetadataWrite = await writeFile.write(newMetadata);
          if (newMetadataWrite.bytesWritten !== newMetadata.length) {
            throw new Error('metadata write (with start time override)');
          }
        } else {
          const metadataWrite = await writeFile.write(metadata);
          if (metadataWrite.bytesWritten !== metadataLength) {
            throw new Error('metadata write');
          }
        }
      } else {
        // create the metadata element
        const bufs = [METADATA];
        let startAt = replay.startAt?.toISOString();
        if (startTimes.length && startTimes[i]) {
          startAt = startTimes[i];
        }
        if (startAt) {
          const startAtBuf = Buffer.alloc(startAt.length + 1);
          startAtBuf.writeUint8(startAt.length, 0);
          startAtBuf.write(startAt, 1);
          bufs.push(START_AT_PREFIX);
          bufs.push(startAtBuf);
        }
        if (replay.lastFrame) {
          const lastFrameBuf = Buffer.alloc(4);
          lastFrameBuf.writeUint32BE(replay.lastFrame);
          bufs.push(LAST_FRAME_PREFIX);
          bufs.push(lastFrameBuf);
        }
        bufs.push(PLAYED_ON);
        const bufsLength = bufs.reduce((acc, buf) => acc + buf.length, 0);
        const metadata = Buffer.concat(bufs, bufsLength);
        const metadataWrite = await writeFile.write(metadata);
        if (metadataWrite.bytesWritten !== metadata.length) {
          throw new Error(
            startTimes.length
              ? 'metadata creation (with start time override)'
              : 'metadata creation',
          );
        }
      }

      return { writeFilePath, writeFileName };
    } finally {
      readFile.close();
      writeFile.close();
    }
  });
  writeFilePromises.push(...replayFilePromises);

  const writeFiles = await Promise.all(writeFilePromises);
  if (output === Output.ZIP && sanitizedSubdir) {
    const zipFile = new ZipFile();
    const zipFilePromise = new Promise((resolve) => {
      zipFile.outputStream
        .pipe(createWriteStream(`${join(dir, sanitizedSubdir)}.zip`))
        .on('close', resolve);
    });
    writeFiles.forEach((writeFile) => {
      zipFile.addFile(writeFile.writeFilePath, writeFile.writeFileName);
    });
    zipFile.end();
    await zipFilePromise;
    await rm(writeDir, { recursive: true });
  }
}

export async function enforceReplays(
  replays: Replay[],
): Promise<EnforceResult[]> {
  const checks = ListChecks();
  return Promise.all(
    replays.map(async (replay) => {
      const buffer = await fsReadFile(replay.filePath);
      const game = new SlippiGame(buffer.buffer);

      const playerFailures: EnforcePlayerFailure[] = [];
      const ret = { playerFailures, fileName: replay.fileName };
      if (isSlpMinVersion(game)) {
        return ret;
      }

      const validPorts = new Set(
        game
          .getSettings()
          ?.players.filter((player) => player.type === 0)
          .map((player) => player.port),
      );
      for (let port = 1; port < 5; port += 1) {
        if (validPorts.has(port)) {
          const replayPlayer = replay.players.find(
            (player) => player.port === port,
          );
          const playerFailure: EnforcePlayerFailure = {
            checkNames: [],
            displayName:
              replayPlayer?.playerOverrides?.displayName ||
              replayPlayer?.displayName,
            port,
          };
          for (let i = 0; i < checks.length; i += 1) {
            const checkName = checks[i].name;
            const isMainStick =
              checkName !== 'Disallowed Analog C-Stick Values';
            const coords = getCoordListFromGame(game, port - 1, isMainStick);
            if (
              isBoxController(
                isMainStick
                  ? coords
                  : getCoordListFromGame(game, port - 1, true),
              )
            ) {
              if (checks[i].checkFunction(game, port - 1, coords)) {
                playerFailure.checkNames.push(checkName);
              }
            }
          }
          if (playerFailure.checkNames.length > 0) {
            playerFailures.push(playerFailure);
          }
        }
      }
      return ret;
    }),
  );
}
