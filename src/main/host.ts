import { app, BrowserWindow } from 'electron';
import { createSocket, Socket } from 'dgram';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { WebSocketServer, WebSocket, MessageEvent } from 'ws';
import { FileHandle, mkdir, open, readdir, rm, writeFile } from 'fs/promises';
import path from 'node:path';
import { ZipFile } from 'yazl';
import { createWriteStream } from 'fs';
import { IncomingMessage } from 'http';
import {
  Context,
  CopyHost,
  CopyClient,
  Output,
  WebSocketServerStatus,
} from '../common/types';

const PORT = 52455;

type HostMessage =
  | {
      type: 'name';
      name: string;
    }
  | {
      type: 'format';
      fileNameFormat: string;
      folderNameFormat: string;
    };

type HostRequest = {
  ordinal: number;
} & (
  | {
      request: 'computerName';
      name: string;
    }
  | {
      request: 'initSubdir';
      subdir: string;
      output: Output;
    }
  | {
      request: 'writeContext';
      subdir: string;
      context: Context;
    }
  | {
      request: 'openReplay';
      subdir: string;
      fileName: string;
    }
  | {
      request: 'writeReplayData';
      fd: number;
      data: number[];
    }
  | {
      request: 'closeReplay';
      fd: number;
    }
  | {
      request: 'zipSubdir';
      subdir: string;
    }
);

type HostResponse = {
  ordinal: number;
  error: string;
};

function getComputerName() {
  switch (process.platform) {
    case 'win32':
      return execSync('hostname').toString().trim() || os.hostname();
    case 'darwin':
      return (
        execSync('scutil --get ComputerName').toString().trim() || os.hostname()
      );
    case 'linux':
      return (
        execSync('hostnamectl --pretty').toString().trim() || os.hostname()
      );
    default:
      return os.hostname();
  }
}

let mainWindow: BrowserWindow | null = null;
export function setMainWindow(newMainWindow: BrowserWindow) {
  mainWindow = newMainWindow;
}

const addressToName = new Map<string, string>();
let listenSocket: Socket | null = null;
export function startListening(): Promise<string> {
  if (listenSocket) {
    return Promise.resolve(getComputerName());
  }

  addressToName.clear();
  listenSocket = createSocket('udp4');
  listenSocket.on('message', (msg, rinfo) => {
    const name = msg.toString();
    addressToName.set(rinfo.address, name);
    mainWindow?.webContents.send(
      'copyHosts',
      Array.from(addressToName).map(
        ([hostAddress, hostName]): CopyHost => ({
          address: hostAddress,
          name: hostName,
          fileNameFormat: '',
          folderNameFormat: '',
        }),
      ),
    );
  });
  return new Promise((resolve, reject) => {
    if (!listenSocket) {
      reject();
      return;
    }

    listenSocket.on('error', (e) => {
      reject(e);
    });
    listenSocket.on('listening', () => {
      if (!listenSocket) {
        reject();
        return;
      }

      resolve(getComputerName());
    });
    listenSocket.bind(PORT);
  });
}

export function stopListening() {
  return new Promise<void>((resolve) => {
    if (!listenSocket) {
      resolve();
      return;
    }

    listenSocket.close(() => {
      listenSocket = null;
      resolve();
    });
  });
}

let address = '';
let name = '';
let hostFileNameFormat = '';
let hostFolderNameFormat = '';
let webSocket: WebSocket | null = null;
function sendCopyHost() {
  const copyHost: CopyHost = {
    address,
    name,
    fileNameFormat: hostFileNameFormat,
    folderNameFormat: hostFolderNameFormat,
  };
  mainWindow?.webContents.send('copyHost', copyHost);
}

export function connectToHost(newAddress: string) {
  const newName = addressToName.get(newAddress) ?? '';

  if (webSocket) {
    webSocket.onclose = () => {};
    webSocket.close();
    address = '';
    name = '';
    hostFileNameFormat = '';
    hostFolderNameFormat = '';
  }

  webSocket = new WebSocket(`ws://${newAddress}:${PORT}`, {
    handshakeTimeout: 1000,
  });
  webSocket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') {
      return;
    }

    const message = JSON.parse(event.data) as HostMessage;
    if (message.type === 'name') {
      name = message.name;
      sendCopyHost();
    } else if (message.type === 'format') {
      hostFileNameFormat = message.fileNameFormat;
      hostFolderNameFormat = message.folderNameFormat;
      sendCopyHost();
    }
  });
  webSocket.onclose = () => {
    address = '';
    name = '';
    hostFileNameFormat = '';
    hostFolderNameFormat = '';
    sendCopyHost();
    webSocket = null;
  };
  return new Promise<void>((resolve, reject) => {
    if (!webSocket) {
      reject();
      return;
    }

    webSocket.onopen = () => {
      address = newAddress;
      name = newName;
      mainWindow?.webContents.send('copyHost', { address, name });

      const request: HostRequest = {
        ordinal: 0,
        request: 'computerName',
        name: getComputerName(),
      };
      webSocket?.send(JSON.stringify(request));
      resolve();
    };
    webSocket.onerror = (event) => {
      reject(event.error);
    };
  });
}

export function disconnectFromHost() {
  if (webSocket) {
    webSocket.close();
  }
}

export function getHost(): CopyHost {
  return {
    address,
    name,
    fileNameFormat: hostFileNameFormat,
    folderNameFormat: hostFolderNameFormat,
  };
}

let nextRequestOrdinal = 1;
export function initSubdir(subdir: string, output: Output) {
  return new Promise<void>((resolve, reject) => {
    if (!webSocket) {
      reject(new Error('no webSocket'));
      return;
    }

    const requestOrdinal = nextRequestOrdinal;
    nextRequestOrdinal += 1;

    const listener = (event: MessageEvent) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const { ordinal, error } = JSON.parse(event.data) as HostResponse;
      if (ordinal === requestOrdinal) {
        webSocket?.removeEventListener('message', listener);
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      }
    };
    webSocket.addEventListener('message', listener);

    const request: HostRequest = {
      ordinal: requestOrdinal,
      request: 'initSubdir',
      subdir,
      output,
    };
    webSocket.send(JSON.stringify(request));
  });
}

export function writeContext(subdir: string, context: Context) {
  return new Promise<void>((resolve, reject) => {
    if (!webSocket) {
      reject();
      return;
    }

    const requestOrdinal = nextRequestOrdinal;
    nextRequestOrdinal += 1;

    const listener = (event: MessageEvent) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const { ordinal, error } = JSON.parse(event.data) as HostResponse;
      if (ordinal === requestOrdinal) {
        webSocket?.removeEventListener('message', listener);
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      }
    };
    webSocket.addEventListener('message', listener);

    const request: HostRequest = {
      ordinal: requestOrdinal,
      request: 'writeContext',
      subdir,
      context,
    };
    webSocket.send(JSON.stringify(request));
  });
}

export function openReplay(subdir: string, fileName: string) {
  return new Promise<number>((resolve, reject) => {
    if (!webSocket) {
      reject();
      return;
    }

    const requestOrdinal = nextRequestOrdinal;
    nextRequestOrdinal += 1;

    const listener = (event: MessageEvent) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const { ordinal, error, fd } = JSON.parse(event.data) as HostResponse & {
        fd: number;
      };
      if (ordinal === requestOrdinal) {
        webSocket?.removeEventListener('message', listener);
        if (error) {
          reject(new Error(error));
        } else if (Number.isInteger(fd)) {
          resolve(fd);
        }
      }
    };
    webSocket.addEventListener('message', listener);

    const request: HostRequest = {
      ordinal: requestOrdinal,
      request: 'openReplay',
      subdir,
      fileName,
    };
    webSocket.send(JSON.stringify(request));
  });
}

export function writeReplayData(fd: number, data: Buffer) {
  return new Promise<number>((resolve, reject) => {
    if (!webSocket) {
      reject();
      return;
    }

    const requestOrdinal = nextRequestOrdinal;
    nextRequestOrdinal += 1;

    const listener = (event: MessageEvent) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const { ordinal, error, bytesWritten } = JSON.parse(
        event.data,
      ) as HostResponse & { bytesWritten: number };
      if (ordinal === requestOrdinal) {
        webSocket?.removeEventListener('message', listener);
        if (error) {
          reject(new Error(error));
        } else if (Number.isInteger(bytesWritten)) {
          resolve(bytesWritten);
        }
      }
    };
    webSocket.addEventListener('message', listener);

    const request: HostRequest = {
      ordinal: requestOrdinal,
      request: 'writeReplayData',
      fd,
      data: data.toJSON().data,
    };
    webSocket.send(JSON.stringify(request));
  });
}

export function closeReplay(fd: number) {
  return new Promise<void>((resolve, reject) => {
    if (!webSocket) {
      reject();
      return;
    }

    const requestOrdinal = nextRequestOrdinal;
    nextRequestOrdinal += 1;

    const listener = (event: MessageEvent) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const { ordinal, error } = JSON.parse(event.data) as HostResponse;
      if (ordinal === requestOrdinal) {
        webSocket?.removeEventListener('message', listener);
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      }
    };
    webSocket.addEventListener('message', listener);

    const request: HostRequest = {
      ordinal: requestOrdinal,
      request: 'closeReplay',
      fd,
    };
    webSocket.send(JSON.stringify(request));
  });
}

export function zipSubdir(subdir: string) {
  return new Promise<void>((resolve, reject) => {
    if (!webSocket) {
      reject();
      return;
    }

    const requestOrdinal = nextRequestOrdinal;
    nextRequestOrdinal += 1;

    const listener = (event: MessageEvent) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const { ordinal, error } = JSON.parse(event.data) as HostResponse;
      if (ordinal === requestOrdinal) {
        webSocket?.removeEventListener('message', listener);
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      }
    };
    webSocket.addEventListener('message', listener);

    const request: HostRequest = {
      ordinal: requestOrdinal,
      request: 'zipSubdir',
      subdir,
    };
    webSocket.send(JSON.stringify(request));
  });
}

let copyDir = '';
export function setCopyDir(newCopyDir: string) {
  copyDir = newCopyDir;
}

let webSocketServerStatus = WebSocketServerStatus.STOPPED;
let webSocketServerStatusError = '';
export function getHostServerStatus() {
  return {
    status: webSocketServerStatus,
    error: webSocketServerStatusError,
  };
}

const clientAddressToNameAndWebSocket = new Map<
  string,
  { name: string; webSocket: WebSocket }
>();
function sendCopyClients() {
  mainWindow?.webContents.send(
    'copyClients',
    Array.from(clientAddressToNameAndWebSocket).map(
      ([clientAddress, { name: clientName }]): CopyClient => ({
        address: clientAddress,
        name: clientName,
      }),
    ),
  );
}
export function getCopyClients() {
  return Array.from(clientAddressToNameAndWebSocket).map(
    ([clientAddress, { name: clientName }]): CopyClient => ({
      address: clientAddress,
      name: clientName,
    }),
  );
}
export function kickCopyClient(clientAddress: string) {
  const nameAndWebSocket = clientAddressToNameAndWebSocket.get(clientAddress);
  if (!nameAndWebSocket) {
    throw new Error('no such client');
  }

  nameAndWebSocket.webSocket.close();
}

let ownFileNameFormat = '';
let ownFolderNameFormat = '';
function sendFormat(socket: WebSocket) {
  const formatHostMessage: HostMessage = {
    type: 'format',
    fileNameFormat: ownFileNameFormat,
    folderNameFormat: ownFolderNameFormat,
  };
  socket.send(JSON.stringify(formatHostMessage));
}
export function setOwnFolderNameFormat(folderNameFormat: string) {
  ownFolderNameFormat = folderNameFormat;
  Array.from(clientAddressToNameAndWebSocket.values()).forEach(
    (nameAndWebSocket) => {
      sendFormat(nameAndWebSocket.webSocket);
    },
  );
}
export function setOwnFileNameFormat(fileNameFormat: string) {
  ownFileNameFormat = fileNameFormat;
  Array.from(clientAddressToNameAndWebSocket.values()).forEach(
    (nameAndWebSocket) => {
      sendFormat(nameAndWebSocket.webSocket);
    },
  );
}

let broadcastSocket: Socket | null = null;
let webSocketServer: WebSocketServer | null = null;
const subdirToWriteDir = new Map<string, string>();
const fdToFileHandle = new Map<number, FileHandle>();
export function startHostServer(): Promise<string> {
  if (!copyDir) {
    throw new Error('must set copy dir');
  }
  if (webSocketServer) {
    return Promise.resolve(getComputerName());
  }

  clientAddressToNameAndWebSocket.clear();
  sendCopyClients();
  webSocketServer = new WebSocketServer({
    port: PORT,
    verifyClient: ({ req }: { req: IncomingMessage }) =>
      !!broadcastSocket &&
      req.socket.remoteAddress &&
      !clientAddressToNameAndWebSocket.has(req.socket.remoteAddress),
  });
  webSocketServer.on('error', (error) => {
    webSocketServerStatusError = error.message;
  });
  webSocketServer.on('close', () => {
    webSocketServerStatus = WebSocketServerStatus.STOPPED;
    mainWindow?.webContents.send(
      'hostServerStatus',
      webSocketServerStatus,
      webSocketServerStatusError,
    );
    webSocketServer = null;
  });
  webSocketServer.on('connection', (newWebSocket, request) => {
    const { remoteAddress } = request.socket;
    if (!remoteAddress) {
      newWebSocket.close();
      return;
    }
    clientAddressToNameAndWebSocket.set(remoteAddress, {
      name: '',
      webSocket: newWebSocket,
    });
    sendCopyClients();
    newWebSocket.onclose = () => {
      clientAddressToNameAndWebSocket.delete(remoteAddress);
      sendCopyClients();
    };
    newWebSocket.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const hostRequest = JSON.parse(event.data) as HostRequest;
        if (!Number.isInteger(hostRequest.ordinal)) {
          const response: HostResponse = {
            ordinal: hostRequest.ordinal,
            error: 'must specify ordinal',
          };
          newWebSocket.send(JSON.stringify(response));
          return;
        }

        if (hostRequest.request === 'computerName') {
          const nameAndWebSocket =
            clientAddressToNameAndWebSocket.get(remoteAddress);
          if (nameAndWebSocket) {
            nameAndWebSocket.name = hostRequest.name;
            sendCopyClients();
          }
        } else {
          if (!clientAddressToNameAndWebSocket.get(remoteAddress)?.name) {
            const response: HostResponse = {
              ordinal: hostRequest.ordinal,
              error: 'must first call computerName',
            };
            newWebSocket.send(JSON.stringify(response));
            return;
          }

          if (hostRequest.request === 'initSubdir') {
            const writeDir = path.join(
              hostRequest.output === Output.ZIP ? app.getPath('temp') : copyDir,
              hostRequest.subdir,
            );
            try {
              await mkdir(writeDir, { recursive: true });
              subdirToWriteDir.set(hostRequest.subdir, writeDir);
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: '',
              };
              newWebSocket.send(JSON.stringify(response));
            } catch (e: unknown) {
              if (e instanceof Error) {
                const response: HostResponse = {
                  ordinal: hostRequest.ordinal,
                  error: e.message,
                };
                newWebSocket.send(JSON.stringify(response));
              }
            }
          } else if (hostRequest.request === 'writeContext') {
            const writeDir = subdirToWriteDir.get(hostRequest.subdir);
            if (!writeDir) {
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: 'invalid subdir',
              };
              newWebSocket.send(JSON.stringify(response));
              return;
            }
            try {
              const filePath = path.join(writeDir, 'context.json');
              await writeFile(filePath, JSON.stringify(hostRequest.context));
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: '',
              };
              newWebSocket.send(JSON.stringify(response));
            } catch (e: unknown) {
              if (e instanceof Error) {
                const response: HostResponse = {
                  ordinal: hostRequest.ordinal,
                  error: e.message,
                };
                newWebSocket.send(JSON.stringify(response));
              }
            }
          } else if (hostRequest.request === 'openReplay') {
            const writeDir = subdirToWriteDir.get(hostRequest.subdir);
            if (!writeDir) {
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: 'invalid subdir',
              };
              newWebSocket.send(JSON.stringify(response));
              return;
            }
            try {
              const filePath = path.join(writeDir, hostRequest.fileName);
              const fileHandle = await open(filePath, 'w');
              fdToFileHandle.set(fileHandle.fd, fileHandle);
              const response: HostResponse & { fd: number } = {
                ordinal: hostRequest.ordinal,
                error: '',
                fd: fileHandle.fd,
              };
              newWebSocket.send(JSON.stringify(response));
            } catch (e: unknown) {
              if (e instanceof Error) {
                const response: HostResponse = {
                  ordinal: hostRequest.ordinal,
                  error: e.message,
                };
                newWebSocket.send(JSON.stringify(response));
              }
            }
          } else if (hostRequest.request === 'writeReplayData') {
            const fileHandle = fdToFileHandle.get(hostRequest.fd);
            if (!fileHandle) {
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: 'invalid fd',
              };
              newWebSocket.send(JSON.stringify(response));
              return;
            }

            try {
              const writeResponse = await fileHandle.write(
                Buffer.from(hostRequest.data),
              );
              const response: HostResponse & { bytesWritten: number } = {
                ordinal: hostRequest.ordinal,
                error: '',
                bytesWritten: writeResponse.bytesWritten,
              };
              newWebSocket.send(JSON.stringify(response));
            } catch (e: unknown) {
              if (e instanceof Error) {
                const response: HostResponse = {
                  ordinal: hostRequest.ordinal,
                  error: e.message,
                };
                newWebSocket.send(JSON.stringify(response));
              }
            }
          } else if (hostRequest.request === 'closeReplay') {
            const fileHandle = fdToFileHandle.get(hostRequest.fd);
            if (!fileHandle) {
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: 'invalid fd',
              };
              newWebSocket.send(JSON.stringify(response));
              return;
            }

            try {
              await fileHandle.close();
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: '',
              };
              newWebSocket.send(JSON.stringify(response));
            } catch (e: unknown) {
              if (e instanceof Error) {
                const response: HostResponse = {
                  ordinal: hostRequest.ordinal,
                  error: e.message,
                };
                newWebSocket.send(JSON.stringify(response));
              }
            }
          } else if (hostRequest.request === 'zipSubdir') {
            const writeDir = subdirToWriteDir.get(hostRequest.subdir);
            if (!writeDir || !writeDir.startsWith(app.getPath('temp'))) {
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: 'invalid subdir',
              };
              newWebSocket.send(JSON.stringify(response));
              return;
            }

            try {
              const fileNames = await readdir(writeDir);
              const zipFile = new ZipFile();
              const zipFilePromise = new Promise((resolve) => {
                zipFile.outputStream
                  .pipe(
                    createWriteStream(
                      `${path.join(copyDir, hostRequest.subdir)}.zip`,
                    ),
                  )
                  .on('close', resolve);
              });
              fileNames.forEach((fileName) => {
                zipFile.addFile(path.join(writeDir, fileName), fileName);
              });
              zipFile.end();
              await zipFilePromise;
              await rm(writeDir, { recursive: true });
              const response: HostResponse = {
                ordinal: hostRequest.ordinal,
                error: '',
              };
              newWebSocket.send(JSON.stringify(response));
            } catch (e: unknown) {
              if (e instanceof Error) {
                const response: HostResponse = {
                  ordinal: hostRequest.ordinal,
                  error: e.message,
                };
                newWebSocket.send(JSON.stringify(response));
              }
            }
          } else {
            newWebSocket.send(
              JSON.stringify({
                ordinal: (hostRequest as HostRequest).ordinal,
                error: `unknown request: ${
                  (hostRequest as HostRequest).request
                }`,
              }),
            );
          }
        }
      }
    };
    const nameHostMessage: HostMessage = {
      type: 'name',
      name: getComputerName(),
    };
    newWebSocket.send(JSON.stringify(nameHostMessage));
    sendFormat(newWebSocket);
  });
  return new Promise((resolve, reject) => {
    if (!webSocketServer) {
      reject();
      return;
    }

    webSocketServer.on('listening', () => {
      webSocketServerStatus = WebSocketServerStatus.STARTED;
      mainWindow?.webContents.send(
        'hostServerStatus',
        webSocketServerStatus,
        '',
      );
      resolve(getComputerName());
    });
  });
}

export function stopHostServer() {
  Array.from(clientAddressToNameAndWebSocket.values()).forEach(
    ({ webSocket: clientWebSocket }) => {
      clientWebSocket.close();
    },
  );

  return new Promise<void>((resolve) => {
    if (!webSocketServer) {
      resolve();
      return;
    }

    webSocketServer.close(() => {
      webSocketServer = null;
      resolve();
    });
  });
}

let timeout: NodeJS.Timeout | null = null;
export function startBroadcasting() {
  if (broadcastSocket) {
    return Promise.resolve(broadcastSocket.address().address);
  }
  if (!webSocketServer) {
    return Promise.reject(new Error('must start hostServer first'));
  }

  return new Promise<string>((resolve, reject) => {
    broadcastSocket = createSocket('udp4');
    broadcastSocket.on('error', (e) => {
      reject(e);
    });
    broadcastSocket.on('connect', () => {
      if (!broadcastSocket) {
        reject();
        return;
      }

      broadcastSocket.setBroadcast(true);
      const selfName = getComputerName();
      const broadcast = () => {
        if (broadcastSocket) {
          broadcastSocket.send(selfName);
          timeout = setTimeout(() => {
            broadcast();
          }, 1000);
        }
      };
      broadcast();
      resolve(broadcastSocket.address().address);
    });
    broadcastSocket.connect(PORT, '255.255.255.255');
  });
}

export function stopBroadcasting() {
  if (timeout) {
    clearTimeout(timeout);
  }

  return new Promise<void>((resolve) => {
    if (!broadcastSocket) {
      resolve();
      return;
    }
    broadcastSocket.close(() => {
      broadcastSocket = null;
      resolve();
    });
  });
}
