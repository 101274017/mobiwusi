import { describe, expect, it } from 'vitest';
import { InMemoryMediaAllocationPort, InMemoryMediaRuntime, InMemoryMediaSessionStore, MediaSessionError, MediaSessionService, type MediaAllocation, type MediaAllocationPort, type MediaEndReason, type MediaRuntimePort } from '../../packages/media-session/src/index';

function request(expiresAt: number) {
  return { sessionId: 'assist-1', ownerId: 'owner-1', helperId: 'helper-1', relationId: 'relation-1', consentId: 'consent-1', requestedMedia: ['screen', 'audio'] as const, grantRevision: 7, expiresAt };
}

describe('E10 controlled media session', () => {
  it('uses synthetic offline defaults and reclaims allocation on user stop', async () => {
    let now = 1_000_000;
    const allocation = new InMemoryMediaAllocationPort();
    const runtime = new InMemoryMediaRuntime();
    const service = new MediaSessionService({ store: new InMemoryMediaSessionStore(), allocation, runtime, now: () => now });
    await service.create('owner-1', request(now + 20_000));
    await service.accept('helper-1', 'assist-1');
    const joined = await service.join({ actorId: 'helper-1', deviceId: 'device-1', consentId: 'consent-1', grantRevision: 7 }, 'assist-1');
    expect(joined.relayOnly).toBe(true);
    expect(joined.turnCredentials.urls).toEqual(['turn:synthetic.invalid:3478']);
    expect(allocation.allocations.size).toBe(1);
    const ended = await service.end('helper-1', 'assist-1', 'user_stop');
    expect(ended.state).toBe('ended');
    expect(ended.lease?.status).toBe('released');
    expect(allocation.allocations.size).toBe(0);
    expect(allocation.released).toHaveLength(1);
    expect(runtime.stopped).toHaveLength(1);
    now += 1000;
    await expect(service.renew('helper-1', 'assist-1', joined.leaseId, 7)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('rejects stale grant joins and ends/reclaims expired leases', async () => {
    let now = 2_000_000;
    const allocation = new InMemoryMediaAllocationPort();
    const service = new MediaSessionService({ store: new InMemoryMediaSessionStore(), allocation, now: () => now });
    await service.create('owner-1', request(now + 2_000));
    await service.accept('helper-1', 'assist-1');
    await expect(service.join({ actorId: 'helper-1', deviceId: 'device-1', consentId: 'consent-1', grantRevision: 6 }, 'assist-1')).rejects.toMatchObject({ code: 'GRANT_REVOKED' });
    const joined = await service.join({ actorId: 'helper-1', deviceId: 'device-1', consentId: 'consent-1', grantRevision: 7 }, 'assist-1');
    now = joined.expiresAt + 1;
    expect(await service.expire()).toEqual(['assist-1']);
    expect((await service.get('owner-1', 'assist-1')).endReason).toBe('expired');
    expect(allocation.released).toHaveLength(1);
  });

  it('releases a late allocation after revocation while join is connecting', async () => {
    let resolveAllocation!: (allocation: MediaAllocation) => void;
    const released: Array<{ allocation: MediaAllocation; reason: MediaEndReason }> = [];
    const delayed: MediaAllocationPort = {
      allocate: async () => new Promise<MediaAllocation>(resolve => { resolveAllocation = resolve; }),
      release: async (allocation, reason) => { released.push({ allocation, reason }); },
    };
    const service = new MediaSessionService({ store: new InMemoryMediaSessionStore(), allocation: delayed, now: () => 3_000_000 });
    await service.create('owner-1', request(3_010_000));
    await service.accept('helper-1', 'assist-1');
    const joining = service.join({ actorId: 'helper-1', deviceId: 'device-1', consentId: 'consent-1', grantRevision: 7 }, 'assist-1');
    for (let index = 0; index < 20 && !resolveAllocation; index += 1) await new Promise(resolve => setTimeout(resolve, 0));
    await service.revoke('owner-1', 'assist-1', 'permission_revoked');
    resolveAllocation({ allocationId: 'late-allocation', sessionId: 'assist-1', leaseId: 'late-lease', generation: 1, expiresAt: 3_010_000 });
    await expect(joining).rejects.toMatchObject({ code: 'GRANT_REVOKED' });
    expect(released).toHaveLength(1);
  });

  it('cleans an allocated resource when runtime startup fails', async () => {
    const allocation = new InMemoryMediaAllocationPort();
    const runtime: MediaRuntimePort = { start: async () => { throw new Error('synthetic runtime failure'); }, stop: async () => {} };
    const service = new MediaSessionService({ store: new InMemoryMediaSessionStore(), allocation, runtime, now: () => 4_000_000 });
    await service.create('owner-1', request(4_010_000));
    await service.accept('helper-1', 'assist-1');
    await expect(service.join({ actorId: 'helper-1', deviceId: 'device-1', consentId: 'consent-1', grantRevision: 7 }, 'assist-1')).rejects.toMatchObject({ code: 'ALLOCATION_FAILED' });
    expect((await service.get('owner-1', 'assist-1')).state).toBe('ended');
    expect(allocation.allocations.size).toBe(0);
    expect(allocation.released).toHaveLength(1);
  });
});

describe('media session offline boundary', () => {
  it('does not contain network/WebRTC activation in the default service path', () => {
    const source = `${MediaSessionService.toString()} ${InMemoryMediaAllocationPort.toString()}`;
    expect(source).not.toMatch(/fetch\(|WebSocket|RTCPeerConnection|MediaRecorder|getUserMedia/);
  });
});
