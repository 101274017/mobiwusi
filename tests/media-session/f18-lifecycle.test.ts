import { describe, expect, it } from 'vitest';
import { InMemoryMediaAllocationPort, InMemoryMediaRuntime, InMemoryMediaSessionStore, MediaSessionError, MediaSessionService, SyntheticMediaTicketPort, type MediaCreateRequest, type MediaRuntimePort, type MediaTicketPort } from '../../packages/media-session/src/index';

const now = 3_000_000;
const request: MediaCreateRequest = { sessionId: 'f18-session', ownerId: 'owner', helperId: 'helper', relationId: 'relation', consentId: 'consent', grantRevision: 1, requestedMedia: ['screen'], expiresAt: now + 60_000 };
const joinRequest = { actorId: 'helper', deviceId: 'device', consentId: 'consent', grantRevision: 1 };

async function accepted(options: { runtime?: MediaRuntimePort; ticket?: MediaTicketPort; allocation?: InMemoryMediaAllocationPort } = {}) {
  const store = new InMemoryMediaSessionStore();
  const allocation = options.allocation ?? new InMemoryMediaAllocationPort();
  const service = new MediaSessionService({ store, allocation, runtime: options.runtime, ticket: options.ticket, now: () => now });
  await service.create('owner', request);
  await service.accept('helper', request.sessionId);
  return { service, store, allocation };
}

describe('F18 media lifecycle regression', () => {
  it('cannot overwrite or reopen an ended session by reusing its ID', async () => {
    const { service, allocation } = await accepted();
    await service.join(joinRequest, request.sessionId);
    await service.disconnect('owner', request.sessionId);
    const ended = await service.get('owner', request.sessionId);
    await expect(service.create('owner', request)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(await service.get('owner', request.sessionId)).toEqual(ended);
    await expect(service.join(joinRequest, request.sessionId)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(allocation.allocations.size).toBe(0);
  });

  it('does not let a second owner replace another session with a duplicate ID', async () => {
    const { service } = await accepted();
    await expect(service.create('other-owner', { ...request, ownerId: 'other-owner' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect((await service.get('owner', request.sessionId)).ownerId).toBe('owner');
  });

  it('ends and cleans the runtime when ticket issuance raises a domain error', async () => {
    const runtime = new InMemoryMediaRuntime();
    const ticket: MediaTicketPort = { async issue() { throw new MediaSessionError('SCOPE_DENIED'); } };
    const { service, allocation } = await accepted({ runtime, ticket });
    await expect(service.join(joinRequest, request.sessionId)).rejects.toMatchObject({ code: 'SCOPE_DENIED' });
    expect(await service.get('owner', request.sessionId)).toMatchObject({ state: 'ended', endReason: 'allocation_failed', lease: { status: 'released' } });
    expect(allocation.allocations.size).toBe(0);
    expect(runtime.stopped).toHaveLength(1);
  });

  it('releases allocation even if runtime stop fails and allows explicit cleanup retry', async () => {
    let stopCalls = 0;
    const runtime: MediaRuntimePort = { async start() {}, async stop() { stopCalls += 1; if (stopCalls === 1) throw new Error('synthetic stop failure'); } };
    const { service, allocation } = await accepted({ runtime });
    await service.join(joinRequest, request.sessionId);
    await expect(service.end('owner', request.sessionId, 'user_stop')).rejects.toThrow();
    expect(allocation.allocations.size).toBe(0);
    expect(await service.get('owner', request.sessionId)).toMatchObject({ state: 'ended', cleanupPending: true });
    await expect(service.join(joinRequest, request.sessionId)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    const cleaned = await service.end('owner', request.sessionId, 'user_stop');
    expect(cleaned).toMatchObject({ state: 'ended', cleanupPending: false, lease: { status: 'released' } });
    expect(stopCalls).toBe(2);
    await service.end('owner', request.sessionId, 'user_stop');
    expect(stopCalls).toBe(2);
  });

  it('does not return late tickets after disconnect or automatically reconnect', async () => {
    let finishTicket!: () => void;
    const issuer = new SyntheticMediaTicketPort();
    const ticket: MediaTicketPort = { async issue(input) { await new Promise<void>(resolve => { finishTicket = resolve; }); return issuer.issue(input); } };
    const { service, allocation } = await accepted({ ticket });
    const joining = service.join(joinRequest, request.sessionId);
    const rejected = expect(joining).rejects.toMatchObject({ code: 'GRANT_REVOKED' });
    for (let attempt = 0; attempt < 100 && !finishTicket; attempt += 1) await new Promise(resolve => setTimeout(resolve, 0));
    expect(finishTicket).toBeTypeOf('function');
    await service.disconnect('owner', request.sessionId);
    finishTicket();
    await rejected;
    expect((await service.get('owner', request.sessionId)).state).toBe('ended');
    expect(allocation.allocations.size).toBe(0);
    expect(allocation.released).toHaveLength(1);
  });
});
