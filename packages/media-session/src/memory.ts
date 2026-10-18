import type { MediaAllocation, MediaAllocationPort, MediaEndReason, MediaRuntimePort, MediaSession, MediaSessionStore, MediaSessionTransaction, MediaTicketPort, TurnCredentials } from './ports.ts';

class MemoryTransactions<State> {
  private lock: Promise<void> = Promise.resolve();
  constructor(private state: State) {}

  async transaction<Result>(work: (state: State) => Promise<Result>): Promise<Result> {
    let unlock!: () => void;
    const previous = this.lock;
    this.lock = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    try {
      const draft = structuredClone(this.state);
      const result = await work(draft);
      const output = structuredClone(result);
      this.state = draft;
      return output;
    } finally { unlock(); }
  }
}

export class InMemoryMediaSessionStore implements MediaSessionStore {
  private readonly memory = new MemoryTransactions({ sessions: new Map<string, MediaSession>() });

  transaction<Result>(work: (transaction: MediaSessionTransaction) => Promise<Result>): Promise<Result> {
    return this.memory.transaction(state => work({
      get: async sessionId => structuredClone(state.sessions.get(sessionId) ?? null),
      save: async session => { state.sessions.set(session.sessionId, structuredClone(session)); },
      list: async () => [...state.sessions.values()].map(session => structuredClone(session)),
    }));
  }
}

export class InMemoryMediaAllocationPort implements MediaAllocationPort {
  readonly allocations = new Map<string, MediaAllocation>();
  readonly released: Array<{ allocation: MediaAllocation; reason: MediaEndReason }> = [];
  private sequence = 0;

  async allocate(request: { sessionId: string; leaseId: string; generation: number; requestedMedia: readonly ('screen' | 'audio')[]; expiresAt: number; signal: AbortSignal }): Promise<MediaAllocation> {
    if (request.signal.aborted) throw new DOMException('Allocation cancelled', 'AbortError');
    const allocation = { allocationId: `allocation-${++this.sequence}`, sessionId: request.sessionId, leaseId: request.leaseId, generation: request.generation, expiresAt: request.expiresAt };
    this.allocations.set(allocation.allocationId, structuredClone(allocation));
    return structuredClone(allocation);
  }

  async release(allocation: MediaAllocation, reason: MediaEndReason): Promise<void> {
    this.allocations.delete(allocation.allocationId);
    this.released.push({ allocation: structuredClone(allocation), reason });
  }
}

export class SyntheticMediaTicketPort implements MediaTicketPort {
  async issue(request: { session: MediaSession; lease: { leaseId: string }; deviceId: string }): Promise<{ signalTicket: string; turnCredentials: TurnCredentials }> {
    return {
      signalTicket: `synthetic-signal-${request.lease.leaseId}-${request.deviceId}`,
      turnCredentials: { urls: ['turn:synthetic.invalid:3478'], username: 'synthetic', credential: `synthetic-${request.lease.leaseId}` },
    };
  }
}

export class InMemoryMediaRuntime implements MediaRuntimePort {
  readonly started: Array<{ sessionId: string; leaseId: string; generation: number }> = [];
  readonly stopped: Array<{ sessionId: string; generation: number; reason: MediaEndReason }> = [];

  async start(session: MediaSession, lease: { leaseId: string }): Promise<void> { this.started.push({ sessionId: session.sessionId, leaseId: lease.leaseId, generation: session.generation }); }
  async stop(sessionId: string, generation: number, reason: MediaEndReason): Promise<void> { this.stopped.push({ sessionId, generation, reason }); }
}
