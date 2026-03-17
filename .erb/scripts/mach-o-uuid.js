const { exec } = require('child_process');
const { PythonShell } = require('python-shell');

exports.default = async function machOUuid(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin' || context.arch !== 4) {
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

  try {
    await new Promise((resolve, reject) => {
      exec(`codesign --deep -s - ${appPath}`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } catch (e) {
    console.log(e);
  }
};
