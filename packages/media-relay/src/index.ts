import {
  FrameSafetyGate,
  type FrameDecisionReason,
  type LocalFrameInput,
  type LocalGateContext,
  type SafetyTicket,
} from '@nuanban/privacy';

export type MediaOutlet = 'ai' | 'family';
export type RelayStopReason = 'user' | 'risk' | 'destination-revoked' | 'queue-full' | 'encoder-failed' | 'outlet-failed' | 'renderer-gone';

export interface ApprovedFrame {
  frameId: string;
  frameHash: string;
  generation: number;
  policyVersion: string;
  redactionApplied: boolean;
  canary: 'NUANBAN-C04-SYNTHETIC';
}

export interface EncodedSafeFrame {
  artifactId: string;
  frameId: string;
  frameHash: string;
  generation: number;
  policyVersion: string;
  codec: 'synthetic-redacted-metadata';
  encodedBytes: number;
  redactionApplied: boolean;
  canary: 'NUANBAN-C04-SYNTHETIC';
}

export type SafeFrameEncoder = (frame: ApprovedFrame) => Promise<EncodedSafeFrame>;
export type OutletSender = (outlet: MediaOutlet, frame: EncodedSafeFrame) => Promise<void>;

export interface RelayConfig {
  encoder: SafeFrameEncoder;
  sender: OutletSender;
  maxQueue?: number;
  now?: () => number;
  nextTicketId?: () => string;
  outlets?: readonly MediaOutlet[];
}

export interface RelaySnapshot {
  active: boolean;
  generation: number;
  queued: number;
  inFlight: number;
  submitted: number;
  accepted: number;
  denied: number;
  queueDrops: number;
  staleDrops: number;
  encoded: number;
  sentByOutlet: Record<MediaOutlet, number>;
  encoderFailures: number;
  outletFailures: number;
  lastStopReason: RelayStopReason | null;
}

export type SubmitResult =
  | { accepted: true; ticket: SafetyTicket; queued: true }
  | { accepted: false; reason: FrameDecisionReason | 'inactive' | 'queue_full' | 'ticket_failed' };

interface QueueItem {
  input: LocalFrameInput;
  ticket: SafetyTicket;
  approved: ApprovedFrame;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function safeArtifact(value: unknown): value is EncodedSafeFrame {
  if (!record(value)) return false;
  const keys = ['artifactId', 'frameId', 'frameHash', 'generation', 'policyVersion', 'codec', 'encodedBytes', 'redactionApplied', 'canary'];
  const generation = value.generation;
  const encodedBytes = value.encodedBytes;
  return Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key))
    && typeof value.artifactId === 'string' && value.artifactId.length > 0
    && typeof value.frameId === 'string' && value.frameId.length > 0
    && typeof value.frameHash === 'string' && value.frameHash.length > 0
    && safeInteger(generation) && generation >= 0
    && typeof value.policyVersion === 'string' && value.policyVersion.length > 0
    && value.codec === 'synthetic-redacted-metadata'
    && safeInteger(encodedBytes) && encodedBytes >= 0 && encodedBytes <= 10_000_000
    && typeof value.redactionApplied === 'boolean'
    && value.canary === 'NUANBAN-C04-SYNTHETIC';
}

export class InMemoryMediaReceiver {
  readonly packets: Record<MediaOutlet, EncodedSafeFrame[]> = { ai: [], family: [] };
  readonly attempted: Array<{ outlet: MediaOutlet; frameId: string; generation: number }> = [];

  receive(outlet: MediaOutlet, frame: EncodedSafeFrame): void {
    this.attempted.push({ outlet, frameId: frame.frameId, generation: frame.generation });
    this.packets[outlet].push(structuredClone(frame));
  }

  snapshot(): Record<MediaOutlet, EncodedSafeFrame[]> { return structuredClone(this.packets); }
}

export class ControlledMediaRelay {
  private readonly gate = new FrameSafetyGate();
  private readonly encoder: SafeFrameEncoder;
  private readonly sender: OutletSender;
  private readonly maxQueue: number;
  private readonly now: () => number;
  private readonly nextTicketId: () => string;
  private readonly outlets: readonly MediaOutlet[];
  private readonly queue: QueueItem[] = [];
  private readonly idleWaiters: Array<() => void> = [];
  private active = false;
  private processing = false;
  private inFlight = 0;
  private lastGeneration = -1;
  private submitted = 0;
  private accepted = 0;
  private denied = 0;
  private queueDrops = 0;
  private staleDrops = 0;
  private encoded = 0;
  private sentByOutlet: Record<MediaOutlet, number> = { ai: 0, family: 0 };
  private encoderFailures = 0;
  private outletFailures = 0;
  private lastStopReason: RelayStopReason | null = null;

  constructor(config: RelayConfig) {
    if (!record(config) || typeof config.encoder !== 'function' || typeof config.sender !== 'function') throw new Error('C04 需要严格的编码器和接收端');
    this.encoder = config.encoder;
    this.sender = config.sender;
    this.maxQueue = config.maxQueue ?? 2;
    this.now = config.now ?? (() => Date.now());
    this.nextTicketId = config.nextTicketId ?? (() => `c04-ticket-${crypto.randomUUID()}`);
    this.outlets = [...(config.outlets ?? ['ai', 'family'])];
    if (this.maxQueue < 1 || this.maxQueue > 8 || !this.outlets.length || this.outlets.some(outlet => outlet !== 'ai' && outlet !== 'family')) throw new Error('C04 队列或出口配置无效');
  }

  start(context: LocalGateContext): void {
    if (this.active || this.processing || this.queue.length > 0 || context.generation <= this.lastGeneration) throw new Error('C04 会话仍未清理或代际未更新');
    this.gate.authorize(context);
    this.active = true;
    this.lastGeneration = context.generation;
    this.lastStopReason = null;
  }

  submit(input: LocalFrameInput): SubmitResult {
    this.submitted += 1;
    if (!this.active) { this.denied += 1; return { accepted: false, reason: 'inactive' }; }
    const evaluatedAt = this.now();
    const result = this.gate.evaluate(input, evaluatedAt);
    if (result.decision !== 'allow') { this.denied += 1; return { accepted: false, reason: result.reason }; }
    if (this.queue.length + this.inFlight >= this.maxQueue) { this.queueDrops += 1; this.denied += 1; return { accepted: false, reason: 'queue_full' }; }
    const ticket = this.gate.issue(input, evaluatedAt, this.nextTicketId());
    if (!ticket) { this.denied += 1; return { accepted: false, reason: 'ticket_failed' }; }
    const approved: ApprovedFrame = { frameId: input.frameId, frameHash: input.frameHash, generation: input.generation, policyVersion: result.policyVersion, redactionApplied: result.redactionApplied, canary: 'NUANBAN-C04-SYNTHETIC' };
    this.queue.push({ input, ticket, approved });
    this.accepted += 1;
    void this.pump();
    return { accepted: true, ticket, queued: true };
  }

  stop(reason: RelayStopReason): void {
    if (!this.active && !this.processing && this.queue.length === 0) return;
    this.active = false;
    this.lastStopReason = reason;
    this.gate.stop();
    this.staleDrops += this.queue.length;
    this.queue.length = 0;
    this.resolveIdleIfReady();
  }

  async drain(): Promise<void> {
    if (!this.processing && this.queue.length === 0 && this.inFlight === 0) return;
    await new Promise<void>(resolve => this.idleWaiters.push(resolve));
  }

  snapshot(): RelaySnapshot {
    return { active: this.active, generation: this.gate.generation, queued: this.queue.length, inFlight: this.inFlight, submitted: this.submitted, accepted: this.accepted, denied: this.denied, queueDrops: this.queueDrops, staleDrops: this.staleDrops, encoded: this.encoded, sentByOutlet: { ...this.sentByOutlet }, encoderFailures: this.encoderFailures, outletFailures: this.outletFailures, lastStopReason: this.lastStopReason };
  }

  private async pump(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) continue;
        if (!this.active || !this.gate.permits(item.ticket, item.input, this.now())) { this.staleDrops += 1; continue; }
        this.inFlight += 1;
        try {
          const encoded = await this.encoder(structuredClone(item.approved));
          if (!safeArtifact(encoded) || encoded.frameId !== item.approved.frameId || encoded.frameHash !== item.approved.frameHash || encoded.generation !== item.approved.generation || encoded.policyVersion !== item.approved.policyVersion || encoded.redactionApplied !== item.approved.redactionApplied || !this.active || !this.gate.permits(item.ticket, item.input, this.now())) { this.staleDrops += 1; continue; }
          this.encoded += 1;
          for (const outlet of this.outlets) {
            if (!this.active || !this.gate.permits(item.ticket, item.input, this.now())) { this.staleDrops += 1; break; }
            try { await this.sender(outlet, structuredClone(encoded)); this.sentByOutlet[outlet] += 1; }
            catch { this.outletFailures += 1; this.stop('outlet-failed'); break; }
          }
        } catch { this.encoderFailures += 1; this.stop('encoder-failed'); }
        finally { this.inFlight -= 1; }
      }
    } finally {
      this.processing = false;
      this.resolveIdleIfReady();
      if (this.queue.length > 0) void this.pump();
    }
  }

  private resolveIdleIfReady(): void {
    if (this.processing || this.queue.length > 0 || this.inFlight > 0) return;
    while (this.idleWaiters.length) this.idleWaiters.shift()?.();
  }
}
