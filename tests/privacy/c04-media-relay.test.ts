import { describe, expect, it } from 'vitest';
import { ControlledMediaRelay, InMemoryMediaReceiver, type ApprovedFrame, type EncodedSafeFrame } from '@nuanban/media-relay';
import type { LocalFrameInput, LocalGateContext } from '@nuanban/privacy';

const context: LocalGateContext = { systemAuthorized: true, consent: true, sessionActive: true, destinationAuthorized: true, generation: 8, policyVersion: 'privacy-0.3.0', maxFrameAgeMs: 500, minimumConfidence: 0.85 };
const frame = (overrides: Partial<LocalFrameInput> = {}): LocalFrameInput => ({ frameId: 'c04-frame-001', frameHash: 'c04-safe-hash', generation: 8, capturedAt: 10_000, pageKind: 'verified', detectorStatus: 'healthy', ocrStatus: 'complete', text: 'NUANBAN-C04-SYNTHETIC safe page', confidence: 0.99, thirdPartyFaces: 0, faceRedaction: 'not_required', ...overrides });
const artifact = (approved: ApprovedFrame): EncodedSafeFrame => ({ artifactId: `encoded-${approved.frameId}`, frameId: approved.frameId, frameHash: approved.frameHash, generation: approved.generation, policyVersion: approved.policyVersion, codec: 'synthetic-redacted-metadata', encodedBytes: 128, redactionApplied: approved.redactionApplied, canary: 'NUANBAN-C04-SYNTHETIC' });

function setup(options: { maxQueue?: number; encoder?: (frame: ApprovedFrame) => Promise<EncodedSafeFrame>; sender?: (outlet: 'ai' | 'family', frame: EncodedSafeFrame) => Promise<void> } = {}) {
  let now = 10_100;
  const receiver = new InMemoryMediaReceiver();
  const encoderInputs: ApprovedFrame[] = [];
  const encoder = options.encoder ?? (async (approved: ApprovedFrame) => { encoderInputs.push(structuredClone(approved)); return artifact(approved); });
  const relay = new ControlledMediaRelay({ maxQueue: options.maxQueue, now: () => now, nextTicketId: (() => { let value = 0; return () => `c04-ticket-${++value}`; })(), encoder, sender: options.sender ?? (async (outlet, packet) => receiver.receive(outlet, packet)) });
  relay.start(context);
  return { relay, receiver, encoderInputs, advance: (amount: number) => { now += amount; } };
}

describe('C04 受控媒体源 → 本地编码元数据 → 双出口', () => {
  it('逐帧安全通过后才调用编码器，并将同一安全 artifact 发送给 AI 与家属出口', async () => {
    const { relay, receiver, encoderInputs } = setup();
    const result = relay.submit(frame());
    expect(result.accepted).toBe(true);
    await relay.drain();
    expect(encoderInputs).toHaveLength(1);
    expect(encoderInputs[0]).not.toHaveProperty('text');
    expect(encoderInputs[0]).not.toHaveProperty('pixels');
    expect(receiver.packets.ai).toHaveLength(1);
    expect(receiver.packets.family).toHaveLength(1);
    expect(receiver.packets.ai[0]).toEqual(receiver.packets.family[0]);
  });

  it.each([
    { text: '请支付验证码 123456' },
    { pageKind: 'unknown' as const },
    { detectorStatus: 'timeout' as const },
    { thirdPartyFaces: 1, faceRedaction: 'failed' as const },
    { confidence: 0.5 },
    { generation: 7 },
  ])('任何不安全帧都不进入编码器或任一出口: %j', async overrides => {
    const { relay, receiver, encoderInputs } = setup();
    const result = relay.submit(frame(overrides));
    expect(result.accepted).toBe(false);
    await relay.drain();
    expect(encoderInputs).toHaveLength(0);
    expect(receiver.packets.ai).toHaveLength(0);
    expect(receiver.packets.family).toHaveLength(0);
  });

  it('未启动、目标撤权和系统撤权都关闭两个出口', async () => {
    const receiver = new InMemoryMediaReceiver();
    const relay = new ControlledMediaRelay({ encoder: async approved => artifact(approved), sender: async (outlet, packet) => receiver.receive(outlet, packet), nextTicketId: () => 'c04-ticket-inactive' });
    expect(relay.submit(frame({ generation: 8 })).accepted).toBe(false);
    relay.start(context);
    relay.stop('destination-revoked');
    expect(relay.submit(frame()).accepted).toBe(false);
    await relay.drain();
    expect(receiver.snapshot()).toEqual({ ai: [], family: [] });
  });

  it('队列有界，满时拒绝新帧而不丢旧安全策略', async () => {
    const gates: Array<() => void> = [];
    const waitForGate = async () => {
      const deadline = Date.now() + 1_000;
      while (gates.length === 0) {
        if (Date.now() >= deadline) throw new Error('等待合成编码器未完成');
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    };
    const { relay, receiver } = setup({ maxQueue: 2, encoder: approved => new Promise(resolve => gates.push(() => resolve(artifact(approved)))) });
    expect(relay.submit(frame({ frameId: 'frame-a', frameHash: 'hash-a' })).accepted).toBe(true);
    expect(relay.submit(frame({ frameId: 'frame-b', frameHash: 'hash-b' })).accepted).toBe(true);
    expect(relay.submit(frame({ frameId: 'frame-c', frameHash: 'hash-c' })).accepted).toBe(false);
    expect(relay.snapshot()).toMatchObject({ accepted: 2, queueDrops: 1, queued: 1, inFlight: 1 });
    expect(gates).toHaveLength(1);
    gates.shift()?.();
    await waitForGate();
    gates.shift()?.();
    await relay.drain();
    expect(receiver.packets.ai.map(packet => packet.frameId)).toEqual(['frame-a', 'frame-b']);
  });

  it('停止先关闭门控、清队列；编码器迟到后不向任一出口发送', async () => {
    let resolveEncoding: (value: EncodedSafeFrame) => void = () => { throw new Error('编码器尚未初始化'); };
    const { relay, receiver } = setup({ encoder: approved => new Promise(resolve => { resolveEncoding = () => resolve(artifact(approved)); }) });
    const result = relay.submit(frame());
    expect(result.accepted).toBe(true);
    relay.stop('user');
    resolveEncoding(artifact({ frameId: 'c04-frame-001', frameHash: 'c04-safe-hash', generation: 8, policyVersion: context.policyVersion, redactionApplied: false, canary: 'NUANBAN-C04-SYNTHETIC' }));
    await relay.drain();
    expect(receiver.snapshot()).toEqual({ ai: [], family: [] });
    expect(relay.snapshot()).toMatchObject({ active: false, staleDrops: 1, sentByOutlet: { ai: 0, family: 0 } });
  });

  it('停止发生在 AI 出口之后时，家属出口也被同一门控阻断', async () => {
    const receiver = new InMemoryMediaReceiver();
    const { relay } = setup({ sender: async (outlet, packet) => { if (outlet === 'ai') { receiver.receive(outlet, packet); relay.stop('risk'); return; } receiver.receive(outlet, packet); } });
    relay.submit(frame());
    await relay.drain();
    expect(receiver.packets.ai).toHaveLength(1);
    expect(receiver.packets.family).toHaveLength(0);
    expect(relay.snapshot()).toMatchObject({ active: false, lastStopReason: 'risk' });
  });

  it('编码器不能伪造输入绑定或将未绑定 artifact 发给出口', async () => {
    const receiver = new InMemoryMediaReceiver();
    const { relay } = setup({ encoder: async approved => ({ ...artifact(approved), frameHash: 'forged-hash', redactionApplied: !approved.redactionApplied }), sender: async (outlet, packet) => receiver.receive(outlet, packet) });
    relay.submit(frame());
    await relay.drain();
    expect(receiver.snapshot()).toEqual({ ai: [], family: [] });
    expect(relay.snapshot()).toMatchObject({ encoded: 0, staleDrops: 1 });
  });

  it('出口抛错会停止两个出口，并且不自动恢复', async () => {
    const receiver = new InMemoryMediaReceiver();
    const { relay } = setup({ sender: async (outlet, packet) => { if (outlet === 'family') throw new Error('synthetic receiver failure'); receiver.receive(outlet, packet); } });
    relay.submit(frame());
    await relay.drain();
    expect(relay.snapshot()).toMatchObject({ active: false, outletFailures: 1, lastStopReason: 'outlet-failed', sentByOutlet: { ai: 1, family: 0 } });
    expect(relay.submit(frame({ frameId: 'after-stop', frameHash: 'after-stop-hash' })).accepted).toBe(false);
  });

  it('重启需要更高新代际，旧票据/旧帧不会复用', async () => {
    const { relay, receiver } = setup();
    const first = relay.submit(frame());
    relay.stop('user');
    await relay.drain();
    expect(first.accepted).toBe(true);
    relay.start({ ...context, generation: 9 });
    expect(relay.submit(frame({ generation: 8, frameId: 'old', frameHash: 'old' })).accepted).toBe(false);
    expect(relay.submit(frame({ generation: 9, frameId: 'new', frameHash: 'new' })).accepted).toBe(true);
    await relay.drain();
    expect(receiver.packets.ai.map(packet => packet.frameId)).toEqual(['new']);
  });
});

describe('C04 受控出口的静态边界', () => {
  it('安全输出类型没有 raw track、像素、编码器输入或远程地址字段', () => {
    const source = `ControlledMediaRelay ${ControlledMediaRelay.toString()} ${InMemoryMediaReceiver.toString()}`;
    expect(source).not.toMatch(/MediaRecorder|RTCPeerConnection|WebSocket|getUserMedia|fetch\(|http:\/\/|https:\/\//);
    expect(source).not.toMatch(/rawFrame|pixels|imageData|trackId|sourceId/);
  });
});
