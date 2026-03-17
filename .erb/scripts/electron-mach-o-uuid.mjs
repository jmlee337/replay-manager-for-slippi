import electron from 'electron';
import { PythonShell } from 'python-shell';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { platform } from 'os';

if (platform() === 'darwin') {
  try {
    const results = await PythonShell.run(
      `${dirname(fileURLToPath(import.meta.url))}/mach-o-uuid.py`,
      {
        args: [electron],
      },
    );
    console.log(results.join('\n'));
  } catch (e) {
    console.log(e);
  }
}
