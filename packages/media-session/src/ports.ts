export type MediaKind = 'screen' | 'audio';
export type MediaSessionState = 'inviting' | 'accepted' | 'connecting' | 'active' | 'reconnecting' | 'ended';
export type MediaEndReason = 'user_stop' | 'risk' | 'consent_revoked' | 'permission_revoked' | 'disconnected' | 'expired' | 'allocation_failed';

export interface MediaCreateRequest {
  sessionId: string;
  ownerId: string;
  helperId: string;
  relationId: string;
  consentId: string;
  requestedMedia: readonly MediaKind[];
  grantRevision: number;
  expiresAt: number;
}
export interface MediaLease {
  leaseId: string;
  sessionId: string;
  generation: number;
  grantRevision: number;
  issuedAt: number;
  expiresAt: number;
  status: 'active' | 'revoked' | 'released';
  allocationId: string;
}
export interface MediaSession {
  sessionId: string;
  ownerId: string;
  helperId: string;
  relationId: string;
  consentId: string;
  requestedMedia: MediaKind[];
  grantRevision: number;
  generation: number;
  state: MediaSessionState;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  lease: MediaLease | null;
  endReason: MediaEndReason | null;
  cleanupPending?: boolean;
}
export interface MediaJoinRequest {
  actorId: string;
  deviceId: string;
  consentId: string;
  grantRevision: number;
}
export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
}
export interface MediaJoinResponse {
  sessionId: string;
  leaseId: string;
  signalTicket: string;
  turnCredentials: TurnCredentials;
  expiresAt: number;
  relayOnly: true;
  generation: number;
  allocationId: string;
}
export interface MediaAllocationRequest {
  sessionId: string;
  leaseId: string;
  generation: number;
  requestedMedia: readonly MediaKind[];
  expiresAt: number;
  signal: AbortSignal;
}
export interface MediaAllocation {
  allocationId: string;
  sessionId: string;
  leaseId: string;
  generation: number;
  expiresAt: number;
}
export interface MediaAllocationPort {
  allocate(request: MediaAllocationRequest): Promise<MediaAllocation>;
  release(allocation: MediaAllocation, reason: MediaEndReason): Promise<void>;
}
export interface MediaTicketPort {
  issue(request: { session: MediaSession; lease: MediaLease; deviceId: string }): Promise<{ signalTicket: string; turnCredentials: TurnCredentials }>;
}
export interface MediaRuntimePort {
  start(session: MediaSession, lease: MediaLease): Promise<void>;
  stop(sessionId: string, generation: number, reason: MediaEndReason): Promise<void>;
}
export interface MediaAuthorizer {
  canCreate(actorId: string, request: MediaCreateRequest): Promise<boolean>;
  canAccept(actorId: string, session: MediaSession): Promise<boolean>;
  canJoin(actorId: string, session: MediaSession, request: MediaJoinRequest): Promise<boolean>;
  canEnd(actorId: string, session: MediaSession): Promise<boolean>;
  canRead(actorId: string, session: MediaSession): Promise<boolean>;
}
export interface MediaSessionTransaction {
  get(sessionId: string): Promise<MediaSession | null>;
  save(session: MediaSession): Promise<void>;
  list(): Promise<MediaSession[]>;
}
export interface MediaSessionStore {
  transaction<Result>(work: (transaction: MediaSessionTransaction) => Promise<Result>): Promise<Result>;
}
export class MediaSessionError extends Error {
  constructor(readonly code: 'SCOPE_DENIED' | 'NOT_FOUND' | 'INVALID_REQUEST' | 'INVALID_STATE' | 'CONSENT_REQUIRED' | 'LEASE_EXPIRED' | 'GRANT_REVOKED' | 'ALLOCATION_FAILED', message: string = code) {
    super(message);
    this.name = 'MediaSessionError';
  }
}

export class OwnerHelperMediaAuthorizer implements MediaAuthorizer {
  async canCreate(actorId: string, request: MediaCreateRequest): Promise<boolean> { return actorId === request.ownerId; }
  async canAccept(actorId: string, session: MediaSession): Promise<boolean> { return actorId === session.helperId; }
  async canJoin(actorId: string, session: MediaSession, request: MediaJoinRequest): Promise<boolean> { return (actorId === session.ownerId || actorId === session.helperId) && request.actorId === actorId; }
  async canEnd(actorId: string, session: MediaSession): Promise<boolean> { return actorId === session.ownerId || actorId === session.helperId; }
  async canRead(actorId: string, session: MediaSession): Promise<boolean> { return actorId === session.ownerId || actorId === session.helperId; }
}
