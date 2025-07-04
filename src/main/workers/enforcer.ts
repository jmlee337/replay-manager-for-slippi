import { readFile } from 'fs/promises';
import {
  getCoordListFromGame,
  isSlpMinVersion,
  ListChecks,
  SlippiGame,
} from 'slp-enforcer';
import { expose } from 'threads';
import { EnforcePlayerFailure } from '../../common/types';

const enforcer = {
  enforce(replays: { fileName: string; filePath: string }[]) {
    const checks = ListChecks();
    return Promise.all(
      replays.map(async (replay) => {
        const game = new SlippiGame((await readFile(replay.filePath)).buffer);

        const playerFailures: EnforcePlayerFailure[] = [];
        if (isSlpMinVersion(game)) {
          return { fileName: replay.fileName, playerFailures };
        }

        const validPorts = new Set(
          game
            .getSettings()
            ?.players.filter((player) => player.type === 0)
            .map((player) => player.port),
        );
        for (let port = 1; port < 5; port += 1) {
          if (validPorts.has(port)) {
            const playerFailure: EnforcePlayerFailure = {
              checkNames: [],
              port,
            };
            const mainStickCoords = getCoordListFromGame(game, port - 1, true);
            const cStickCoords = getCoordListFromGame(game, port - 1, false);
            for (let i = 0; i < checks.length; i += 1) {
              const checkName = checks[i].name;
              if (checkName !== 'Control Stick Visualization') {
                const checkResult = checks[i].checkFunction(
                  game,
                  port - 1,
                  checkName !== 'Disallowed Analog C-Stick Values'
                    ? mainStickCoords
                    : cStickCoords,
                );
                if (checkResult.result) {
                  playerFailure.checkNames.push(checkName);
                }
              }
            }
            if (playerFailure.checkNames.length > 0) {
              playerFailures.push(playerFailure);
            }
          }
        }
        return { fileName: replay.fileName, playerFailures };
      }),
    );
  },
};

export type Enforcer = typeof enforcer;
expose(enforcer);
