export function assertNumber(value: any) {
  if (value === undefined || Number.isInteger(value)) {
    return value;
  }
  throw new TypeError(`Expected a number, got ${value}`);
}

export function assertString(value: any) {
  if (value === undefined || typeof value === 'string') {
    return value;
  }
  throw new TypeError(`Expected a string, got ${value}`);
}
