import { Id } from './types';

export function assertInteger(value: Id): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  throw new TypeError(`Expected a number, got ${value}`);
}

export function assertString(value: Id): string {
  if (typeof value === 'string') {
    return value;
  }
  throw new TypeError(`Expected a string, got ${value}`);
}
