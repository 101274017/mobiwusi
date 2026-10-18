import { describe, expect, it } from 'vitest';
import { AuthService, signDeviceChallenge } from '../../apps/server/src/auth.ts';
import { createInMemoryRepositories } from '../../apps/server/src/repositories.ts';

function setup() {
  let now = Date.parse('2026-10-17T00:00:00.000Z');
  const repositories = createInMemoryRepositories();
  const auth = new AuthService(repositories, { now: () => now, challengeTtlMs: 1_000, accessTtlMs: 500, refreshTtlMs: 5_000 });
  const account = auth.createAccount({ account_id: 'account-a' });
  const device = auth.bindDevice({ account_id: account.account_id, device_id: 'device-a', device_secret: 'synthetic-test-secret' });
  return { auth, repositories, account, device, advance: (milliseconds: number) => { now += milliseconds; } };
}

describe('AuthService', () => {
  it('consumes each device challenge exactly once', () => {
    const { auth, device } = setup();
    const challenge = auth.issueDeviceChallenge(device.device_id);
    const signature = signDeviceChallenge(device.device_secret, challenge.challenge);
    expect(auth.exchangeDeviceChallenge(challenge.challenge_id, signature).session.account_id).toBe('account-a');
    expect(() => auth.exchangeDeviceChallenge(challenge.challenge_id, signature)).toThrow('already used');
  });

  it('rejects an expired challenge and consumes it', () => {
    const { auth, device, advance } = setup();
    const challenge = auth.issueDeviceChallenge(device.device_id);
    advance(1_000);
    expect(() => auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge))).toThrow('expired');
    advance(-1_000);
    expect(() => auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge))).toThrow('already used');
  });

  it('rotates refresh tokens and rejects reuse of the old token', () => {
    const { auth, device } = setup();
    const challenge = auth.issueDeviceChallenge(device.device_id);
    const session = auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge)).session;
    const rotated = auth.refreshSession(session.refresh_token).session;
    expect(rotated.account_id).toBe(session.account_id);
    expect(rotated.refresh_token).not.toBe(session.refresh_token);
    expect(() => auth.refreshSession(session.refresh_token)).toThrow('not active');
  });

  it('refuses expired and revoked sessions', () => {
    const { auth, device, advance } = setup();
    const challenge = auth.issueDeviceChallenge(device.device_id);
    const session = auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge)).session;
    advance(500);
    expect(() => auth.authenticateAccessToken(session.access_token)).toThrow('expired');
    expect(auth.revokeDevice('account-a', device.device_id)).toEqual({ revoked: true });
    expect(() => auth.refreshSession(session.refresh_token)).toThrow('not active');
  });

  it('rejects device revocation by another account', () => {
    const { auth, device } = setup();
    auth.createAccount({ account_id: 'account-b' });
    expect(() => auth.revokeDevice('account-b', device.device_id)).toThrow('owner');
    expect(device.status).toBe('bound');
  });
});

