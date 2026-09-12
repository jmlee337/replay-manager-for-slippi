// Ported from https://github.com/sudhakar3697/node-detect-usb/blob/54f9b58eaccf19417034623927c806ad36878b29/index.js
/* eslint-disable max-classes-per-file */
import fs from 'fs';
import nodePath from 'path';
import { EventEmitter } from 'events';
import usbDetect from 'usb-detection';
import { list } from 'drivelist';
import { access } from 'fs/promises';

class Utils {
  static async isReadable(mediaDrive: string) {
    try {
      // eslint-disable-next-line no-bitwise
      access(mediaDrive, fs.constants.F_OK | fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  static getUSBLabel(mountPath: string) {
    return nodePath.basename(mountPath);
  }
}

export type MountData = {
  key: string;
  name: string;
  devicepath: string;
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

  constructor() {
    super();
    this.usbList = new Map();
  }

  async startListening() {
    try {
      usbDetect.startMonitoring();

      const initialDrives = await list();
      // eslint-disable-next-line no-restricted-syntax
      for await (const drive of initialDrives) {
        if (drive.isUSB) {
          // eslint-disable-next-line no-restricted-syntax
          for await (const i of drive.mountpoints) {
            if (i) {
              this.usbList.set(i.path, {
                key: i.path,
                name: Utils.getUSBLabel(i.path),
                devicepath: drive.device,
                isAccessible: await Utils.isReadable(i.path),
              });
            }
          }
        }
      }

      this.emit('ready', Array.from(this.usbList.values()));

      // Detect insert
      usbDetect.on('add', async () => {
        clearInterval(this.timeout);
        this.timeout = setInterval(async () => {
          const drives = await list();
          // eslint-disable-next-line no-restricted-syntax
          for await (const drive of drives) {
            if (drive.isUSB) {
              // eslint-disable-next-line no-restricted-syntax
              for await (const i of drive.mountpoints) {
                if (i) {
                  if (!this.usbList.has(i.path)) {
                    const mountData = {
                      key: i.path,
                      name: Utils.getUSBLabel(i.path),
                      devicepath: drive.device,
                      isAccessible: await Utils.isReadable(i.path),
                    };
                    this.emit('insert', mountData);
                    this.usbList.set(i.path, mountData);
                    clearInterval(this.timeout);
                  }
                }
              }
            }
          }
        }, 1000);
      });

      // Detect remove
      usbDetect.on('remove', async () => {
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
      });
    } catch (err) {
      this.emit('error', err);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  stopListening() {
    usbDetect.stopMonitoring();
  }
}

const detectUsb = new USBEventsController();
export { detectUsb };
