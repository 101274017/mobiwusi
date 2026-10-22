/**
 * Browser-safe identifier helper.
 *
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS or localhost). The deployed
 * trial host is served over plain HTTP, where the whole Web Crypto `randomUUID` entry point is
 * missing even though `crypto.getRandomValues()` is still available. Message and request IDs are
 * not secrets, so fall back to a getRandomValues-based UUID v4 and, only if even that is
 * unavailable, to a timestamp+random string. Uniqueness still comes from a CSPRNG whenever the
 * platform offers one.
 */

export function createWebId(): string {
  const cryptoApi = globalThis.crypto;
  try {
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  } catch {
    // fall through to getRandomValues
  }
  const bytes = new Uint8Array(16);
  try {
    if (typeof cryptoApi?.getRandomValues === 'function') {
      cryptoApi.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    }
  } catch {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
