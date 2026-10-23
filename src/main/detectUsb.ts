// Ported from https://github.com/sudhakar3697/node-detect-usb/blob/54f9b58eaccf19417034623927c806ad36878b29/index.js
/* eslint-disable max-classes-per-file */
import fs from 'fs';
import { EventEmitter } from 'events';
import { list } from 'drivelist';
import { access } from 'fs/promises';
import { usb } from 'usb';

class Utils {
  static async isReadable(mediaDrive: string) {
    try {
      // eslint-disable-next-line no-bitwise
      await access(mediaDrive, fs.constants.F_OK | fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

export type MountData = {
  key: string;
  isAccessible: boolean;
};

class USBEventsController extends EventEmitter<{
  ready: [MountData[]];
  insert: [MountData];
  eject: [string];
  error: [unknown];
}> {
  usbList: Map<string, MountData>;

  timeout: NodeJS.Timeout | undefined;

  boundConnectListener: (event: any) => Promise<void>;

  boundDisconnectListener: (event: any) => Promise<void>;

  constructor() {
    super();
    this.usbList = new Map<string, MountData>();
    this.boundConnectListener = this.connectListener.bind(this);
    this.boundDisconnectListener = this.disconnectListener.bind(this);
  }

  async connectListener(event: any) {
    try {
      const { configuration } = event.device;
      if (configuration) {
        const { interfaces } = configuration;
        if (Array.isArray(interfaces)) {
          if (
            interfaces.some((iFace) => {
              const { alternate } = iFace;
              // Slippi Nintendont compatible mass storage
              return (
                alternate.interfaceClass === 8 &&
                alternate.interfaceSubclass === 6 &&
                alternate.interfaceProtocol === 80
              );
            })
          ) {
            clearTimeout(this.timeout);
            const findNewDrive = async () => {
              const drives = await list();
              // eslint-disable-next-line no-restricted-syntax
              for await (const drive of drives) {
                if (drive.isUSB) {
                  // eslint-disable-next-line no-restricted-syntax
                  for await (const i of drive.mountpoints) {
                    if (i) {
                      if (!this.usbList.has(i.path)) {
                        const mountData: MountData = {
                          key: i.path,
                          isAccessible: await Utils.isReadable(i.path),
                        };
                        this.emit('insert', mountData);
                        this.usbList.set(i.path, mountData);
                        clearTimeout(this.timeout);
                        return true;
                      }
                    }
                  }
                }
              }
              return false;
            };
            if (await findNewDrive()) {
              return;
            }
            this.timeout = setInterval(async () => {
              await findNewDrive();
            }, 1000);
          }
        }
      }
    } catch {
      // just catch
    }
  }

  async disconnectListener() {
    const newUsbList: string[] = [];
    let removalList = [];
    const drives = await list();
    // eslint-disable-next-line no-restricted-syntax
    for await (const drive of drives) {
      if (drive.isUSB) {
        // eslint-disable-next-line no-restricted-syntax
        for await (const i of drive.mountpoints) {
          if (i) {
            newUsbList.push(i.path);
          }
        }
      }
    }
    removalList = Array.from(this.usbList.keys()).filter(
      (x) => !newUsbList.includes(x),
    );
    removalList.forEach((i) => {
      this.usbList.delete(i);
      this.emit('eject', i);
    });
  }

  async startListening() {
    try {
      const initialDrives = await list();
      // eslint-disable-next-line no-restricted-syntax
      for await (const drive of initialDrives) {
        if (drive.isUSB) {
          // eslint-disable-next-line no-restricted-syntax
          for await (const i of drive.mountpoints) {
            if (i) {
              this.usbList.set(i.path, {
                key: i.path,
                isAccessible: await Utils.isReadable(i.path),
              });
            }
          }
        }
      }

      this.emit('ready', Array.from(this.usbList.values()));

      usb.addEventListener('connect', this.boundConnectListener);
      usb.addEventListener('disconnect', this.boundDisconnectListener);
    } catch (err) {
      this.emit('error', err);
    }
    return Array.from(this.usbList.values());
  }

  // eslint-disable-next-line class-methods-use-this
  stopListening() {
    usb.removeEventListener('connect', this.boundConnectListener);
    usb.removeEventListener('disconnect', this.boundDisconnectListener);
  }
}

const detectUsb = new USBEventsController();
export { detectUsb };
