import os from 'os';
import { URL } from 'url';
import path from 'path';
import { execSync } from 'child_process';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

let computerName = '';
export function getComputerName() {
  if (computerName) {
    return computerName;
  }

  switch (process.platform) {
    case 'win32':
      computerName = execSync('hostname').toString().trim() || os.hostname();
      return computerName;
    case 'darwin':
      computerName =
        execSync('scutil --get ComputerName').toString().trim() ||
        os.hostname();
      return computerName;
    case 'linux':
      computerName =
        execSync('hostnamectl --pretty').toString().trim() || os.hostname();
      return computerName;
    default:
      computerName = os.hostname();
      return computerName;
  }
}
