import { randomUUID } from 'node:crypto';
import { MediaSessionError, OwnerHelperMediaAuthorizer, type MediaAllocation, type MediaAllocationPort, type MediaAuthorizer, type MediaCreateRequest, type MediaEndReason, type MediaJoinRequest, type MediaJoinResponse, type MediaRuntimePort, type MediaSession, type MediaSessionStore, type MediaTicketPort } from './ports.ts';
import { InMemoryMediaAllocationPort, InMemoryMediaRuntime, SyntheticMediaTicketPort } from './memory.ts';

export interface MediaSessionServiceOptions {
  store: MediaSessionStore;
  authorizer?: MediaAuthorizer;
  allocation?: MediaAllocationPort;
  ticket?: MediaTicketPort;
  runtime?: MediaRuntimePort;
  now?: () => number;
  nextId?: () => string;
}

function validateCreate(request: MediaCreateRequest, now: number): void {
  if (!request || !request.sessionId || !request.ownerId || !request.helperId || !request.relationId || !request.consentId || !Number.isSafeInteger(request.grantRevision) || request.grantRevision < 1 || !Number.isFinite(request.expiresAt) || request.expiresAt <= now || !Array.isArray(request.requestedMedia) || !request.requestedMedia.length || request.requestedMedia.some(kind => kind !== 'screen' && kind !== 'audio')) throw new MediaSessionError('INVALID_REQUEST');
  if (new Set(request.requestedMedia).size !== request.requestedMedia.length) throw new MediaSessionError('INVALID_REQUEST');
}

export class MediaSessionService {
  readonly allocation: MediaAllocationPort;
  private readonly store: MediaSessionStore;
  private readonly authorizer: MediaAuthorizer;
  private readonly ticket: MediaTicketPort;
  private readonly runtime: MediaRuntimePort;
  private readonly now: () => number;
  private readonly nextId: () => string;
  private readonly pending = new Map<string, AbortController>();
  private readonly cleanups = new Map<string, Promise<MediaSession>>();

  constructor(options: MediaSessionServiceOptions) {
    this.store = options.store;
    this.authorizer = options.authorizer ?? new OwnerHelperMediaAuthorizer();
    this.allocation = options.allocation ?? new InMemoryMediaAllocationPort();
    this.ticket = options.ticket ?? new SyntheticMediaTicketPort();
    this.runtime = options.runtime ?? new InMemoryMediaRuntime();
    this.now = options.now ?? (() => Date.now());
    this.nextId = options.nextId ?? randomUUID;
  }

  async create(actorId: string, request: MediaCreateRequest): Promise<MediaSession> {
    validateCreate(request, this.now());
    if (!(await this.authorizer.canCreate(actorId, request))) throw new MediaSessionError('SCOPE_DENIED');
    const now = this.now();
    const session: MediaSession = { ...structuredClone(request), requestedMedia: [...request.requestedMedia], generation: 0, state: 'inviting', createdAt: now, updatedAt: now, lease: null, endReason: null, cleanupPending: false };
    await this.store.transaction(async transaction => {
      if (await transaction.get(request.sessionId)) throw new MediaSessionError('INVALID_STATE');
      await transaction.save(session);
    });
    return session;
  }

  async accept(actorId: string, sessionId: string): Promise<MediaSession> {
    return this.store.transaction(async transaction => {
      const session = await this.mustGet(transaction, sessionId);
      if (!(await this.authorizer.canAccept(actorId, session))) throw new MediaSessionError('SCOPE_DENIED');
      if (session.state !== 'inviting') throw new MediaSessionError('INVALID_STATE');
      if (session.expiresAt <= this.now()) throw new MediaSessionError('LEASE_EXPIRED');
      const accepted = { ...session, state: 'accepted' as const, updatedAt: this.now() };
      await transaction.save(accepted);
      return accepted;
    });
  }

  async join(request: MediaJoinRequest, sessionId: string): Promise<MediaJoinResponse> {
    const connecting = await this.store.transaction(async transaction => {
      const session = await this.mustGet(transaction, sessionId);
      if (!(await this.authorizer.canJoin(request.actorId, session, request))) throw new MediaSessionError('SCOPE_DENIED');
      if (session.consentId !== request.consentId) throw new MediaSessionError('CONSENT_REQUIRED');
      if (request.grantRevision !== session.grantRevision) throw new MediaSessionError('GRANT_REVOKED');
      if (!['accepted', 'reconnecting'].includes(session.state) || session.expiresAt <= this.now()) throw new MediaSessionError('INVALID_STATE');
      if (session.lease?.status === 'active') throw new MediaSessionError('INVALID_STATE');
      const next: MediaSession = { ...session, state: 'connecting', generation: session.generation + 1, updatedAt: this.now() };
      await transaction.save(next);
      return next;
    });
    const leaseId = this.nextId();
    const controller = new AbortController();
    this.pending.set(sessionId, controller);
    let allocation: MediaAllocation | undefined;
    let allocationReleased = false;
    const releaseAllocation = async (reason: MediaEndReason): Promise<void> => {
      if (!allocation || allocationReleased) return;
      const latest = await this.store.transaction(transaction => transaction.get(sessionId));
      if (latest?.lease?.allocationId === allocation.allocationId && latest.lease.status === 'released') {
        allocationReleased = true;
        return;
      }
      await this.allocation.release(allocation, reason);
      allocationReleased = true;
    };
    try {
      allocation = await this.allocation.allocate({ sessionId, leaseId, generation: connecting.generation, requestedMedia: connecting.requestedMedia, expiresAt: connecting.expiresAt, signal: controller.signal });
      const lease = { leaseId, sessionId, generation: connecting.generation, grantRevision: connecting.grantRevision, issuedAt: this.now(), expiresAt: Math.min(connecting.expiresAt, this.now() + 5 * 60_000), status: 'active' as const, allocationId: allocation.allocationId };
      const current = await this.store.transaction(transaction => transaction.get(sessionId));
      if (!current || current.state !== 'connecting' || current.generation !== connecting.generation || current.grantRevision !== connecting.grantRevision || current.expiresAt <= this.now()) {
        await releaseAllocation(current?.endReason ?? 'permission_revoked');
        throw new MediaSessionError('GRANT_REVOKED');
      }
      await this.runtime.start(current, lease);
      const active = await this.store.transaction(async transaction => {
        const latest = await this.mustGet(transaction, sessionId);
        if (latest.state !== 'connecting' || latest.generation !== connecting.generation || latest.grantRevision !== connecting.grantRevision) return null;
        const updated = { ...latest, state: 'active' as const, lease, updatedAt: this.now() };
        await transaction.save(updated);
        return updated;
      });
      if (!active) {
        await this.runtime.stop(sessionId, connecting.generation, 'permission_revoked');
        await releaseAllocation('permission_revoked');
        throw new MediaSessionError('GRANT_REVOKED');
      }
      const credentials = await this.ticket.issue({ session: active, lease, deviceId: request.deviceId });
      const latest = await this.store.transaction(transaction => transaction.get(sessionId));
      if (controller.signal.aborted || !latest || latest.state !== 'active' || latest.generation !== active.generation || latest.grantRevision !== active.grantRevision || latest.lease?.leaseId !== leaseId || latest.lease.status !== 'active' || latest.expiresAt <= this.now() || latest.lease.expiresAt <= this.now()) throw new MediaSessionError('GRANT_REVOKED');
      return { sessionId, leaseId, signalTicket: credentials.signalTicket, turnCredentials: credentials.turnCredentials, expiresAt: lease.expiresAt, relayOnly: true, generation: active.generation, allocationId: allocation.allocationId };
    } catch (error) {
      const current = await this.store.transaction(transaction => transaction.get(sessionId));
      const reason = error instanceof MediaSessionError && error.code === 'GRANT_REVOKED' ? 'permission_revoked' : 'allocation_failed';
      const cleanupErrors: unknown[] = [];
      try {
        if (current && ((current.state !== 'ended' && current.generation === connecting.generation) || current.cleanupPending)) await this.terminate(sessionId, reason);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      try { await releaseAllocation(reason); } catch (cleanupError) { cleanupErrors.push(cleanupError); }
      if (cleanupErrors.length > 0) throw new AggregateError([error, ...cleanupErrors], 'Media cleanup failed');
      if (error instanceof MediaSessionError) throw error;
      throw new MediaSessionError('ALLOCATION_FAILED');
    } finally {
      if (this.pending.get(sessionId) === controller) this.pending.delete(sessionId);
    }
  }

  async renew(actorId: string, sessionId: string, leaseId: string, grantRevision: number, until?: number): Promise<MediaSession> {
    const current = await this.store.transaction(transaction => transaction.get(sessionId));
    if (!current) throw new MediaSessionError('NOT_FOUND');
    if (!(await this.authorizer.canEnd(actorId, current))) throw new MediaSessionError('SCOPE_DENIED');
    if (current.state !== 'active' || !current.lease || current.lease.leaseId !== leaseId || current.lease.status !== 'active') throw new MediaSessionError('INVALID_STATE');
    if (current.grantRevision !== grantRevision) throw new MediaSessionError('GRANT_REVOKED');
    if (current.lease.expiresAt <= this.now()) { await this.terminate(sessionId, 'expired'); throw new MediaSessionError('LEASE_EXPIRED'); }
    const expiresAt = Math.min(current.expiresAt, until ?? this.now() + 5 * 60_000);
    return this.store.transaction(async transaction => {
      const latest = await this.mustGet(transaction, sessionId);
      if (!latest.lease || latest.lease.leaseId !== leaseId || latest.grantRevision !== grantRevision || latest.state !== 'active') throw new MediaSessionError('GRANT_REVOKED');
      const renewed = { ...latest, updatedAt: this.now(), lease: { ...latest.lease, expiresAt } };
      await transaction.save(renewed);
      return renewed;
    });
  }

  async end(actorId: string, sessionId: string, reason: MediaEndReason): Promise<MediaSession> {
    const current = await this.store.transaction(transaction => transaction.get(sessionId));
    if (!current) throw new MediaSessionError('NOT_FOUND');
    if (!(await this.authorizer.canEnd(actorId, current))) throw new MediaSessionError('SCOPE_DENIED');
    return this.terminate(sessionId, reason);
  }

  async revoke(actorId: string, sessionId: string, reason: 'consent_revoked' | 'permission_revoked' | 'risk' = 'permission_revoked'): Promise<MediaSession> {
    return this.end(actorId, sessionId, reason);
  }

  async disconnect(actorId: string, sessionId: string): Promise<MediaSession> {
    return this.end(actorId, sessionId, 'disconnected');
  }

  async expire(at = this.now()): Promise<string[]> {
    const sessions = await this.store.transaction(transaction => transaction.list());
    const expired = sessions.filter(session => session.state !== 'ended' && (session.expiresAt <= at || (session.lease?.status === 'active' && session.lease.expiresAt <= at)));
    for (const session of expired) await this.terminate(session.sessionId, 'expired');
    return expired.map(session => session.sessionId);
  }

  async get(actorId: string, sessionId: string): Promise<MediaSession> {
    return this.store.transaction(async transaction => {
      const session = await this.mustGet(transaction, sessionId);
      if (!(await this.authorizer.canRead(actorId, session))) throw new MediaSessionError('SCOPE_DENIED');
      return session;
    });
  }

  private terminate(sessionId: string, reason: MediaEndReason): Promise<MediaSession> {
    const pendingCleanup = this.cleanups.get(sessionId);
    if (pendingCleanup) return pendingCleanup;
    const cleanup = this.terminateOnce(sessionId, reason).finally(() => {
      if (this.cleanups.get(sessionId) === cleanup) this.cleanups.delete(sessionId);
    });
    this.cleanups.set(sessionId, cleanup);
    return cleanup;
  }

  private async terminateOnce(sessionId: string, reason: MediaEndReason): Promise<MediaSession> {
    const result = await this.store.transaction(async transaction => {
      const current = await this.mustGet(transaction, sessionId);
      if (current.state === 'ended' && !current.cleanupPending && current.lease?.status !== 'revoked') return { session: current, allocation: null as MediaAllocation | null, cleanup: false };
      const allocation = current.lease ? { allocationId: current.lease.allocationId, sessionId, leaseId: current.lease.leaseId, generation: current.lease.generation, expiresAt: current.lease.expiresAt } : null;
      const cleanup = Boolean(current.cleanupPending || allocation || ['connecting', 'active', 'reconnecting'].includes(current.state));
      const next: MediaSession = { ...current, state: 'ended', generation: current.state === 'ended' ? current.generation : current.generation + 1, updatedAt: this.now(), endReason: current.endReason ?? reason, cleanupPending: cleanup, lease: current.lease ? { ...current.lease, status: 'revoked' } : null };
      await transaction.save(next);
      return { session: next, allocation, cleanup };
    });
    this.pending.get(sessionId)?.abort();
    if (!result.cleanup) return result.session;
    const cleanupReason = result.session.endReason ?? reason;
    const outcomes = await Promise.allSettled([
      Promise.resolve().then(() => this.runtime.stop(sessionId, result.session.generation, cleanupReason)),
      Promise.resolve().then(() => result.allocation ? this.allocation.release(result.allocation, cleanupReason) : undefined),
    ]);
    const failures = outcomes.filter(outcome => outcome.status === 'rejected');
    if (failures.length > 0) throw new AggregateError(failures.map(outcome => outcome.reason), 'Media cleanup failed');
    return this.store.transaction(async transaction => {
      const current = await this.mustGet(transaction, sessionId);
      const cleaned: MediaSession = { ...current, cleanupPending: false, lease: current.lease ? { ...current.lease, status: 'released' } : null };
      await transaction.save(cleaned);
      return cleaned;
    });
  }

  private async mustGet(transaction: { get(sessionId: string): Promise<MediaSession | null> }, sessionId: string): Promise<MediaSession> {
    const session = await transaction.get(sessionId);
    if (!session) throw new MediaSessionError('NOT_FOUND');
    return session;
  }
}
