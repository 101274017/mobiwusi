import type { DeviceDto, Mode, Scope } from '@nuanban/contracts';

export interface AccountRecord {
  account_id: string;
  profile_label: string;
  mode: Mode;
  version: number;
}

export interface DeviceRecord {
  device_id: string;
  account_id: string;
  platform: DeviceDto['platform'];
  status: DeviceDto['status'];
  device_secret: string;
  last_seen_at: string | null;
}

export interface ChallengeRecord {
  challenge_id: string;
  device_id: string;
  account_id: string;
  nonce: string;
  expires_at: string;
  used_at: string | null;
}

export interface SessionRecord {
  access_token_hash: string;
  refresh_token_hash: string;
  account_id: string;
  device_id: string;
  access_expires_at: string;
  refresh_expires_at: string;
  revoked_at: string | null;
}

export interface InvitationRecord {
  invitation_id: string;
  subject_id: string;
  helper_id: string;
  requested_scopes: Scope[];
  expires_at: string;
  status: 'pending' | 'accepted' | 'revoked';
  accepted_relation_id: string | null;
}

export interface ConsentRecord {
  consent_id: string;
  subject_id: string;
  purpose: 'account_claim' | 'learning_share' | 'assistance' | 'screen_analysis' | 'generation';
  scopes: Scope[];
  notice_version: string;
  created_at: string;
  withdrawn_at: string | null;
}

export interface RelationRecord {
  relation_id: string;
  subject_id: string;
  helper_id: string;
  label: string;
  scopes: Scope[];
  consent_id: string;
  status: 'active' | 'revoked';
  grant_revision: number;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  revoked_at: string | null;
}

export interface AccountRepository {
  get(accountId: string): AccountRecord | undefined;
  save(account: AccountRecord): void;
}

export interface DeviceRepository {
  get(deviceId: string): DeviceRecord | undefined;
  listByAccount(accountId: string): DeviceRecord[];
  save(device: DeviceRecord): void;
}

export interface ChallengeRepository {
  get(challengeId: string): ChallengeRecord | undefined;
  save(challenge: ChallengeRecord): void;
}

export interface SessionRepository {
  getByAccessHash(accessTokenHash: string): SessionRecord | undefined;
  getByRefreshHash(refreshTokenHash: string): SessionRecord | undefined;
  listByDevice(deviceId: string): SessionRecord[];
  save(session: SessionRecord): void;
}

export interface InvitationRepository {
  get(invitationId: string): InvitationRecord | undefined;
  findPending(subjectId: string, helperId: string, scopes: Scope[]): InvitationRecord | undefined;
  save(invitation: InvitationRecord): void;
}

export interface ConsentRepository {
  get(consentId: string): ConsentRecord | undefined;
  findActive(subjectId: string, purpose: ConsentRecord['purpose'], noticeVersion: string, scopes: Scope[]): ConsentRecord | undefined;
  save(consent: ConsentRecord): void;
}

export interface RelationRepository {
  get(relationId: string): RelationRecord | undefined;
  find(subjectId: string, helperId: string): RelationRecord | undefined;
  listByParticipant(accountId: string): RelationRecord[];
  save(relation: RelationRecord): void;
}

export interface ServerRepositories {
  readonly accounts: AccountRepository;
  readonly devices: DeviceRepository;
  readonly challenges: ChallengeRepository;
  readonly sessions: SessionRepository;
  readonly invitations: InvitationRepository;
  readonly consents: ConsentRepository;
  readonly relations: RelationRepository;
}

function sameScopes(left: Scope[], right: Scope[]): boolean {
  return left.length === right.length && left.every(scope => right.includes(scope));
}

export class InMemoryRepositories implements ServerRepositories {
  readonly storage = 'memory' as const;
  readonly isProductionDatabase = false as const;

  readonly accounts: AccountRepository = {
    get: accountId => this.accountMap.get(accountId),
    save: account => this.accountMap.set(account.account_id, account),
  };

  readonly devices: DeviceRepository = {
    get: deviceId => this.deviceMap.get(deviceId),
    listByAccount: accountId => [...this.deviceMap.values()].filter(device => device.account_id === accountId),
    save: device => this.deviceMap.set(device.device_id, device),
  };

  readonly challenges: ChallengeRepository = {
    get: challengeId => this.challengeMap.get(challengeId),
    save: challenge => this.challengeMap.set(challenge.challenge_id, challenge),
  };

  readonly sessions: SessionRepository = {
    getByAccessHash: hash => [...this.sessionMap.values()].find(session => session.access_token_hash === hash),
    getByRefreshHash: hash => [...this.sessionMap.values()].find(session => session.refresh_token_hash === hash),
    listByDevice: deviceId => [...this.sessionMap.values()].filter(session => session.device_id === deviceId),
    save: session => this.sessionMap.set(session.access_token_hash, session),
  };

  readonly invitations: InvitationRepository = {
    get: invitationId => this.invitationMap.get(invitationId),
    findPending: (subjectId, helperId, scopes) => [...this.invitationMap.values()].find(invitation => invitation.status === 'pending' && invitation.subject_id === subjectId && invitation.helper_id === helperId && sameScopes(invitation.requested_scopes, scopes)),
    save: invitation => this.invitationMap.set(invitation.invitation_id, invitation),
  };

  readonly consents: ConsentRepository = {
    get: consentId => this.consentMap.get(consentId),
    findActive: (subjectId, purpose, noticeVersion, scopes) => [...this.consentMap.values()].find(consent => consent.withdrawn_at === null && consent.subject_id === subjectId && consent.purpose === purpose && consent.notice_version === noticeVersion && sameScopes(consent.scopes, scopes)),
    save: consent => this.consentMap.set(consent.consent_id, consent),
  };

  readonly relations: RelationRepository = {
    get: relationId => this.relationMap.get(relationId),
    find: (subjectId, helperId) => {
      const matches = [...this.relationMap.values()].filter(relation => relation.subject_id === subjectId && relation.helper_id === helperId);
      return matches.find(relation => relation.status === 'active') ?? matches.at(-1);
    },
    listByParticipant: accountId => [...this.relationMap.values()].filter(relation => relation.subject_id === accountId || relation.helper_id === accountId),
    save: relation => this.relationMap.set(relation.relation_id, relation),
  };

  private readonly accountMap = new Map<string, AccountRecord>();
  private readonly deviceMap = new Map<string, DeviceRecord>();
  private readonly challengeMap = new Map<string, ChallengeRecord>();
  private readonly sessionMap = new Map<string, SessionRecord>();
  private readonly invitationMap = new Map<string, InvitationRecord>();
  private readonly consentMap = new Map<string, ConsentRecord>();
  private readonly relationMap = new Map<string, RelationRecord>();
}

export function createInMemoryRepositories(): InMemoryRepositories {
  return new InMemoryRepositories();
}

