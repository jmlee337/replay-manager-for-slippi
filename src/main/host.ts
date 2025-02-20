import { BrowserWindow } from 'electron';
import { createSocket, Socket } from 'dgram';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { WebSocketServer, WebSocket, MessageEvent } from 'ws';
import { appendFile, writeFile } from 'fs/promises';
import path from 'node:path';
import { IncomingMessage } from 'http';
import { CopyHost, CopyClient, WebSocketServerStatus } from '../common/types';

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
      request: 'writeZip';
      subdir: string;
    }
  | {
      request: 'appendEnforcerResult';
      result: string;
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
export async function writeZip(subdir: string, buffer: Buffer) {
  const requestOrdinal = nextRequestOrdinal;
  nextRequestOrdinal += 1;

  await new Promise<void>((resolve, reject) => {
    if (!webSocket) {
      reject(new Error('no webSocket'));
      return;
    }

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
      request: 'writeZip',
      subdir,
    };
    webSocket.send(JSON.stringify(request));
  });
  await new Promise<void>((resolve, reject) => {
    if (!webSocket) {
      reject(new Error('no webSocket'));
      return;
    }

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
    webSocket.send(buffer);
  });
}

export async function appendEnforcerResult(result: string) {
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
      request: 'appendEnforcerResult',
      result,
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
const clientAddressToExpectedZip = new Map<
  string,
  { ordinal: number; subdir: string }
>();
export function startHostServer(): Promise<string> {
  if (!copyDir) {
    throw new Error('must set copy dir');
  }
  if (webSocketServer) {
    return Promise.resolve(getComputerName());
  }

  clientAddressToNameAndWebSocket.clear();
  clientAddressToExpectedZip.clear();
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
        } else if (hostRequest.request === 'writeZip') {
          clientAddressToExpectedZip.set(remoteAddress, {
            ordinal: hostRequest.ordinal,
            subdir: hostRequest.subdir,
          });
          const response: HostResponse = {
            ordinal: hostRequest.ordinal,
            error: '',
          };
          newWebSocket.send(JSON.stringify(response));
        } else if (hostRequest.request === 'appendEnforcerResult') {
          try {
            await appendFile(
              path.join(copyDir, 'enforcer.csv'),
              hostRequest.result,
            );
            const response: HostResponse = {
              ordinal: hostRequest.ordinal,
              error: '',
            };
            newWebSocket.send(JSON.stringify(response));
          } catch (e: unknown) {
            const response: HostResponse = {
              ordinal: hostRequest.ordinal,
              error: e instanceof Error ? e.message : 'unknown',
            };
            newWebSocket.send(JSON.stringify(response));
          }
        }
      } else if (event.data instanceof Buffer) {
        const expectedZip = clientAddressToExpectedZip.get(remoteAddress);
        if (expectedZip) {
          try {
            await writeFile(
              `${path.join(copyDir, expectedZip.subdir)}.zip`,
              event.data,
            );
            const response: HostResponse = {
              ordinal: expectedZip.ordinal,
              error: '',
            };
            newWebSocket.send(JSON.stringify(response));
            clientAddressToExpectedZip.delete(remoteAddress);
          } catch (e: unknown) {
            if (e instanceof Error) {
              const response: HostResponse = {
                ordinal: expectedZip.ordinal,
                error: e.message,
              };
              newWebSocket.send(JSON.stringify(response));
            }
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
    broadcastSocket.on('listening', () => {
      if (!broadcastSocket) {
        reject();
        return;
      }

      broadcastSocket.setBroadcast(true);
      const selfName = getComputerName();
      const broadcast = () => {
        if (broadcastSocket) {
          broadcastSocket.send(selfName, PORT, '255.255.255.255');
          timeout = setTimeout(() => {
            broadcast();
          }, 1000);
        }
      };
      broadcast();
      const checkSocket = createSocket('udp4');
      checkSocket.connect(53, '8.8.8.8', () => {
        const resolveAddress = checkSocket.address().address;
        checkSocket.close();
        resolve(resolveAddress);
      });
    });
    broadcastSocket.bind();
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
