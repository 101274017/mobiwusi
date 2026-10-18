import type { IncomingMessage } from 'node:http';
import { invalidRequest } from './errors.ts';

export function readIfMatch(request: IncomingMessage): number {
  const value = request.headers['if-match'];
  const match = typeof value === 'string' ? /^"([1-9][0-9]*)"$/.exec(value) : null;
  const version = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(version) || version < 1) throw invalidRequest('If-Match must contain a strong positive integer version');
  return version;
}
