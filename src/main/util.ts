/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export function assertNumber(value: any) {
  if (Number.isInteger(value)) {
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
