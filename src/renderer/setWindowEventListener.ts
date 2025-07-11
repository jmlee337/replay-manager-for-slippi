const typeToCallback = new Map<string, () => void>();

export function setWindowEventListener(type: string, callback: () => void) {
  const previousCallback = typeToCallback.get(type);
  if (previousCallback) {
    window.removeEventListener(type, previousCallback);
  }
  window.addEventListener(type, callback);
  typeToCallback.set(type, callback);
}

export enum WindowEvent {
  CTRLF = 'ctrl+f',
  CTRLS = 'ctrl+s',
}
