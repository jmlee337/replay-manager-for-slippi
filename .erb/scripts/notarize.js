const { notarize } = require('@electron/notarize');
const { PythonShell } = require('python-shell');
const { build } = require('../../package.json');

exports.default = async function notarizeMacos(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  const executablePath = `${appPath}/Contents/MacOS/${appName}`;
  try {
    const results = await PythonShell.run(`${__dirname}/mach-o-uuid.py`, {
      args: [executablePath],
    });
    console.log(results.join('\n'));
  } catch (e) {
    console.log(e);
  }

  if (process.env.CI !== 'true') {
    console.warn('Skipping notarizing step. Packaging is not running in CI');
    return;
  }

  if (
    !('APPLE_ID' in process.env && 'APPLE_APP_SPECIFIC_PASSWORD' in process.env)
  ) {
    console.warn(
      'Skipping notarizing step. APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD env variables must be set',
    );
    return;
  }

  await notarize({
    appBundleId: build.appId,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
  });
};
