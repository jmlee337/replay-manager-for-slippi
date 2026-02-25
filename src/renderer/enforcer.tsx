import { init, SlpGame, PlayerAnalysis, GameSettings } from 'slp-enforcer';
import { EnforcePlayerFailure } from '../common/types';

window.onload = async () => {
  await init();
  window.electron.onEnforcer(async (event, replays, replayLoadCount) => {
    try {
      window.electron.sendEnforcerResults(
        (
          await Promise.all(
            replays.map(async (replay) => {
              let slpGame: SlpGame | undefined;
              try {
                slpGame = new SlpGame(replay.array);
                const playerFailures: EnforcePlayerFailure[] = [];
                if (slpGame.isSlpMinVersion()) {
                  return { fileName: replay.fileName, playerFailures };
                }

                const validPorts = new Set(
                  (slpGame.getGameSettings() as GameSettings).players
                    .filter((player) => player.playerType === 0)
                    .map((player) => player.playerIndex + 1),
                );
                for (let port = 1; port < 5; port += 1) {
                  if (validPorts.has(port)) {
                    const playerFailure: EnforcePlayerFailure = {
                      checkNames: [],
                      port,
                    };
                    const playerAnalysis: PlayerAnalysis =
                      slpGame.analyzePlayer(port - 1);
                    if (playerAnalysis.crouch_uptilt?.result) {
                      playerFailure.checkNames.push('Fast Crouch Uptilt');
                    }
                    if (playerAnalysis.disallowed_cstick?.result) {
                      playerFailure.checkNames.push(
                        'Disallowed Analog C-Stick Values',
                      );
                    }
                    if (playerAnalysis.goomwave?.result) {
                      playerFailure.checkNames.push('GoomWave Clamping');
                    }
                    if (playerAnalysis.sdi?.result) {
                      playerFailure.checkNames.push('Illegal SDI');
                    }
                    if (playerAnalysis.travel_time?.result) {
                      playerFailure.checkNames.push('Box Travel Time');
                    }
                    if (playerAnalysis.uptilt_rounding?.result) {
                      playerFailure.checkNames.push('Uptilt Rounding');
                    }
                    if (
                      playerAnalysis.input_fuzzing &&
                      !playerAnalysis.input_fuzzing.pass
                    ) {
                      playerFailure.checkNames.push('Input Fuzzing');
                    }
                    if (playerFailure.checkNames.length > 0) {
                      // suppress known box sdi false positive
                      if (
                        playerFailure.checkNames.length > 1 ||
                        playerFailure.checkNames[0] !== 'Illegal SDI' ||
                        playerAnalysis.controller_type === 'Analog'
                      ) {
                        playerFailures.push(playerFailure);
                      }
                    }
                  }
                }
                return { fileName: replay.fileName, playerFailures };
              } finally {
                slpGame?.free();
              }
            }),
          )
        ).filter(({ playerFailures }) => playerFailures.length > 0),
        replayLoadCount,
      );
    } catch (e: any) {
      window.electron.sendEnforcerError(e, replayLoadCount);
    }
  });
};
