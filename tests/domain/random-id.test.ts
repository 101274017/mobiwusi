import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebId } from '../../apps/web/src/random-id';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createWebId', () => {
  it('uses crypto.randomUUID when the context exposes it', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() });
    expect(createWebId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('falls back to a UUID v4 built from crypto.getRandomValues on plain HTTP', () => {
    let counter = 0;
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = (counter + index) & 0xff;
      counter += bytes.length;
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    const first = createWebId();
    const second = createWebId();
    expect(getRandomValues).toHaveBeenCalledTimes(2);
    expect(first).toMatch(uuidV4);
    expect(second).toMatch(uuidV4);
    expect(first).not.toBe(second);
  });

  it('still returns a unique identifier when no Web Crypto is available', () => {
    vi.stubGlobal('crypto', undefined);
    const first = createWebId();
    const second = createWebId();
    expect(first).toMatch(uuidV4);
    expect(second).toMatch(uuidV4);
    expect(first).not.toBe(second);
  });
});
