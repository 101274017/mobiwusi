import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { DeviceChallengeResponse, DeviceDto, Mode, SessionDto } from '@nuanban/contracts';
import { authenticationExpired, authenticationFailed, DomainError, permissionDenied } from './errors.ts';
import type { AccountRecord, ChallengeRecord, DeviceRecord, ServerRepositories, SessionRecord } from './repositories.ts';

export type Clock = () => number;

export interface AuthOptions {
  now?: Clock;
  challengeTtlMs?: number;
  accessTtlMs?: number;
  refreshTtlMs?: number;
}

export interface CreateAccountInput {
  account_id?: string;
  profile_label?: string;
  mode?: Mode;
}

export interface BindDeviceInput {
  account_id: string;
  device_id?: string;
  platform?: DeviceDto['platform'];
  device_secret?: string;
}

export interface AuthenticatedSession {
  account_id: string;
  device_id: string;
  session: SessionRecord;
}

const defaultClock: Clock = () => Date.now();

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function secureEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function instant(now: Clock, offsetMs = 0): string {
  return new Date(now() + offsetMs).toISOString();
}

export function signDeviceChallenge(deviceSecret: string, challenge: string): string {
  return hmac(deviceSecret, challenge);
}

export class AuthService {
  private readonly now: Clock;
  private readonly challengeTtlMs: number;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  constructor(private readonly repositories: ServerRepositories, options: AuthOptions = {}) {
    this.now = options.now ?? defaultClock;
    this.challengeTtlMs = options.challengeTtlMs ?? 2 * 60 * 1000;
    this.accessTtlMs = options.accessTtlMs ?? 15 * 60 * 1000;
    this.refreshTtlMs = options.refreshTtlMs ?? 30 * 24 * 60 * 60 * 1000;
  }

  createAccount(input: CreateAccountInput = {}): AccountRecord {
    const account: AccountRecord = {
      account_id: input.account_id ?? randomUUID(),
      profile_label: input.profile_label ?? 'Synthetic account',
      mode: input.mode ?? 'accessible',
      version: 1,
    };
    if (this.repositories.accounts.get(account.account_id)) throw new DomainError(409, 'VERSION_CONFLICT', 'Account already exists');
    this.repositories.accounts.save(account);
    return account;
  }

  bindDevice(input: BindDeviceInput): DeviceRecord {
    if (!this.repositories.accounts.get(input.account_id)) throw authenticationFailed('Account binding is not available');
    const device: DeviceRecord = {
      device_id: input.device_id ?? randomUUID(),
      account_id: input.account_id,
      platform: input.platform ?? 'windows',
      status: 'bound',
      device_secret: input.device_secret ?? randomBytes(32).toString('hex'),
      last_seen_at: null,
    };
    if (this.repositories.devices.get(device.device_id)) throw new DomainError(409, 'VERSION_CONFLICT', 'Device already exists');
    this.repositories.devices.save(device);
    return device;
  }

  issueDeviceChallenge(bindingId: string): DeviceChallengeResponse {
    const device = this.repositories.devices.get(bindingId);
    if (!device || device.status !== 'bound' || !this.repositories.accounts.get(device.account_id)) throw authenticationFailed('Active device binding is required');
    const challenge: ChallengeRecord = {
      challenge_id: randomUUID(),
      device_id: device.device_id,
      account_id: device.account_id,
      nonce: randomBytes(32).toString('base64url'),
      expires_at: instant(this.now, this.challengeTtlMs),
      used_at: null,
    };
    this.repositories.challenges.save(challenge);
    return { challenge_id: challenge.challenge_id, challenge: challenge.nonce, expires_at: challenge.expires_at };
  }

  exchangeDeviceChallenge(challengeId: string, signature: string): { session: SessionDto } {
    const challenge = this.repositories.challenges.get(challengeId);
    if (!challenge) throw authenticationFailed('Unknown device challenge');
    if (challenge.used_at !== null) throw authenticationFailed('Device challenge was already used');
    challenge.used_at = instant(this.now);
    this.repositories.challenges.save(challenge);
    if (Date.parse(challenge.expires_at) <= this.now()) throw authenticationExpired('Device challenge expired');
    const device = this.repositories.devices.get(challenge.device_id);
    if (!device || device.status !== 'bound' || device.account_id !== challenge.account_id) throw authenticationFailed('Device binding is not active');
    if (!secureEqual(signDeviceChallenge(device.device_secret, challenge.nonce), signature)) throw authenticationFailed('Invalid device signature');
    device.last_seen_at = instant(this.now);
    this.repositories.devices.save(device);
    return { session: this.createSession(device.account_id, device.device_id) };
  }

  refreshSession(refreshToken: string): { session: SessionDto } {
    const current = this.repositories.sessions.getByRefreshHash(hashToken(refreshToken));
    if (!current || current.revoked_at !== null) throw authenticationExpired('Refresh token is not active');
    if (Date.parse(current.refresh_expires_at) <= this.now()) {
      current.revoked_at = instant(this.now);
      this.repositories.sessions.save(current);
      throw authenticationExpired('Refresh token expired');
    }
    const device = this.repositories.devices.get(current.device_id);
    if (!device || device.status !== 'bound' || device.account_id !== current.account_id) {
      current.revoked_at = instant(this.now);
      this.repositories.sessions.save(current);
      throw authenticationExpired('Device binding is not active');
    }
    current.revoked_at = instant(this.now);
    this.repositories.sessions.save(current);
    return { session: this.createSession(current.account_id, current.device_id) };
  }

  authenticateAccessToken(accessToken: string): AuthenticatedSession {
    const session = this.repositories.sessions.getByAccessHash(hashToken(accessToken));
    if (!session || session.revoked_at !== null) throw authenticationFailed();
    if (Date.parse(session.access_expires_at) <= this.now()) throw authenticationExpired();
    const device = this.repositories.devices.get(session.device_id);
    if (!device || device.status !== 'bound' || device.account_id !== session.account_id) throw authenticationExpired();
    return { account_id: session.account_id, device_id: session.device_id, session };
  }

  revokeDevice(actorAccountId: string, deviceId: string): { revoked: true } {
    const device = this.repositories.devices.get(deviceId);
    if (!device || device.account_id !== actorAccountId) throw permissionDenied('Only the device owner can revoke this device');
    if (device.status === 'revoked') return { revoked: true };
    device.status = 'revoked';
    this.repositories.devices.save(device);
    const revokedAt = instant(this.now);
    for (const session of this.repositories.sessions.listByDevice(deviceId)) {
      if (session.revoked_at === null) {
        session.revoked_at = revokedAt;
        this.repositories.sessions.save(session);
      }
    }
    return { revoked: true };
  }

  private createSession(accountId: string, deviceId: string): SessionDto {
    const accessToken = `nb_access_${randomBytes(32).toString('base64url')}`;
    const refreshToken = `nb_refresh_${randomBytes(48).toString('base64url')}`;
    const session: SessionRecord = {
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      account_id: accountId,
      device_id: deviceId,
      access_expires_at: instant(this.now, this.accessTtlMs),
      refresh_expires_at: instant(this.now, this.refreshTtlMs),
      revoked_at: null,
    };
    this.repositories.sessions.save(session);
    return { access_token: accessToken, refresh_token: refreshToken, expires_in: Math.floor(this.accessTtlMs / 1000), account_id: accountId };
  }
}

