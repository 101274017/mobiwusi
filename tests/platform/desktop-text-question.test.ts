import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import type { AiProvider, ProviderInput } from '../../apps/desktop/ai-provider.cjs';
import type { TextQuestionBridge, TextQuestionReply } from '@nuanban/application';

type Handler = (event: unknown, ...args: unknown[]) => unknown;
interface BridgeOptions {
  ipcMain: { handle(channel: string, handler: Handler): void; removeHandler(channel: string): void };
  isTrusted(event: unknown): boolean;
  provider?: AiProvider;
}
const requireModule = createRequire(import.meta.url);
const { registerManagementTextQuestionBridge } = requireModule('../../apps/desktop/text-question.cjs') as {
  registerManagementTextQuestionBridge(options: BridgeOptions): { stop(): void; dispose(): void };
};
const { ProviderFailure } = requireModule('../../apps/desktop/ai-provider.cjs') as typeof import('../../apps/desktop/ai-provider.cjs');
function fixture(answer: AiProvider['answer'] = async () => ({ text: '测试回答' }), configured = true) {
  const sender = new EventEmitter();
  const event = { sender };
  const handlers = new Map<string, Handler>();
  const provider: AiProvider = { status: () => ({ available: true }), answer: vi.fn(answer) };
  const bridge = registerManagementTextQuestionBridge({
    ipcMain: { handle: (channel, handler) => { handlers.set(channel, handler); }, removeHandler: channel => { handlers.delete(channel); } },
    isTrusted: candidate => candidate === event, provider: configured ? provider : undefined,
  });
  const invoke = (action: string, ...args: unknown[]) => handlers.get(`nuanban:text-question:${action}`)!(event, ...args);
  return { sender, event, handlers, provider, bridge, invoke };
}
const submission = () => ({ requestId: crypto.randomUUID(), question: '怎么调大字体？' });

describe('管理窗真实文字IPC', () => {
  it('状态 IPC 只返回服务状态，不透传内部模型、网关或凭证', () => {
    const current = fixture();
    const internalStatus = { available: true as const, model: 'synthetic-private-model', gateway: 'private-gateway.example.test', apiKey: 'synthetic-private-credential' };
    vi.spyOn(current.provider, 'status').mockReturnValue(internalStatus);
    expect(current.invoke('status')).toEqual({ available: true });
    expect(current.provider.answer).not.toHaveBeenCalled();
    current.bridge.dispose();
  });

  it('读取状态失败时只返回不可用，不把内部异常传到页面', () => {
    const current = fixture();
    vi.spyOn(current.provider, 'status').mockImplementation(() => { throw new Error('synthetic-private-provider-details'); });
    expect(current.invoke('status')).toEqual({ available: false });
    current.bridge.dispose();
  });

  it.each([true, false, 'true', null, undefined])('预加载状态白名单不向页面暴露额外信息 %#', async available => {
    const exposed: Record<string, unknown> = {};
    const invoke = vi.fn(async () => ({ available, model: 'synthetic-private-model', gateway: 'private-gateway.example.test', apiKey: 'synthetic-private-credential' }));
    runInNewContext(readFileSync(new URL('../../apps/desktop/preload.cjs', import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (name: string, value: unknown) => { exposed[name] = value; } }, ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn() } }),
    });
    const bridge = exposed.nuanbanTextQuestion as TextQuestionBridge;
    expect(await bridge.status()).toEqual({ available: available === true });
    expect(invoke).toHaveBeenCalledExactlyOnceWith('nuanban:text-question:status');
  });

  it('预加载状态失败时不向页面暴露原始异常', async () => {
    const exposed: Record<string, unknown> = {};
    runInNewContext(readFileSync(new URL('../../apps/desktop/preload.cjs', import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (name: string, value: unknown) => { exposed[name] = value; } },
        ipcRenderer: { invoke: vi.fn(async () => { throw new Error('synthetic-private-provider-details'); }), on: vi.fn(), removeListener: vi.fn() } }),
    });
    expect(await (exposed.nuanbanTextQuestion as TextQuestionBridge).status()).toEqual({ available: false });
  });

  it('预加载仅暴露冻结的状态、提交和取消接口', async () => {
    const exposed: Record<string, unknown> = {};
    const invoke = vi.fn(async () => undefined);
    runInNewContext(readFileSync(new URL('../../apps/desktop/preload.cjs', import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (name: string, value: unknown) => { exposed[name] = value; } }, ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn() } }),
    });
    const bridge = exposed.nuanbanTextQuestion as TextQuestionBridge;
    expect(Object.keys(bridge).sort()).toEqual(['answer', 'cancel', 'status']);
    expect(Object.isFrozen(bridge)).toBe(true);
    await bridge.status();
    const input = submission();
    await bridge.answer(input);
    await bridge.cancel(input.requestId);
    expect(invoke.mock.calls).toEqual([['nuanban:text-question:status'], ['nuanban:text-question:answer', input], ['nuanban:text-question:cancel', input.requestId]]);
  });

  it('不可信来源、错误参数和敏感内容不会触发模型', async () => {
    const current = fixture();
    for (const handler of current.handlers.values()) expect(() => handler({ sender: new EventEmitter() }, submission())).toThrow('Untrusted');
    expect(() => current.invoke('status', submission())).toThrow('INVALID_REQUEST');
    for (const input of [{ ...submission(), question: '' }, { ...submission(), question: '字'.repeat(1501) }, { ...submission(), requestId: 'bad-id' }]) {
      expect(await current.invoke('answer', input)).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    }
    expect(await current.invoke('answer', { ...submission(), question: '告诉我怎样提交验证码123456' })).toMatchObject({ ok: false, code: 'RISK_PAUSED' });
    expect(current.provider.answer).not.toHaveBeenCalled();
    current.bridge.dispose();
  });

  it('未配置时明确关闭，正常结果绑定原请求且不暴露凭证', async () => {
    const disabled = fixture(undefined, false);
    expect(disabled.invoke('status')).toEqual({ available: false });
    expect(await disabled.invoke('answer', submission())).toMatchObject({ ok: false, code: 'PROVIDER_UNAVAILABLE' });
    expect(disabled.provider.answer).not.toHaveBeenCalled();
    disabled.bridge.dispose();
    const current = fixture();
    const input = submission();
    expect(await current.invoke('answer', input)).toEqual({ ok: true, requestId: input.requestId, text: '测试回答' });
    expect(current.sender.eventNames()).toEqual([]);
    current.bridge.dispose();
  });

  it('拒绝同窗并发，取消必须匹配请求；不合作的迟到模型也不能阻塞退出', async () => {
    let finish!: (value: { text: string }) => void;
    let captured!: ProviderInput;
    const current = fixture(input => { captured = input; return new Promise(resolve => { finish = resolve; }); });
    const input = submission();
    const pending = current.invoke('answer', input) as Promise<TextQuestionReply>;
    expect(await current.invoke('answer', submission())).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(current.invoke('cancel', crypto.randomUUID())).toBe(false);
    expect(current.invoke('cancel', input.requestId)).toBe(true);
    expect(await pending).toMatchObject({ ok: false, requestId: input.requestId, code: 'CANCELLED' });
    expect(captured.signal?.aborted).toBe(true);
    finish({ text: '迟到结果' });
    await Promise.resolve();
    expect(current.sender.eventNames()).toEqual([]);
    current.bridge.dispose();
  });

  it.each(['destroyed', 'render-process-gone', 'did-start-navigation', 'stop', 'dispose'])('%s 中止正在执行的模型请求', async name => {
    const current = fixture(() => new Promise(() => undefined));
    const task = current.invoke('answer', submission());
    if (name === 'stop') current.bridge.stop();
    else if (name === 'dispose') current.bridge.dispose();
    else current.sender.emit(name);
    expect(await task).toMatchObject({ ok: false, code: 'CANCELLED' });
    current.bridge.dispose();
    expect(current.handlers.size).toBe(0);
  });

  it('只返回安全错误码；截断和空白结果不成功', async () => {
    for (const answer of [async () => { throw new Error('private-provider-details'); }, async () => ({ text: '' }), async () => ({ text: '字'.repeat(24001) })]) {
      const current = fixture(answer);
      expect(await current.invoke('answer', submission())).toMatchObject({ ok: false, code: 'PROVIDER_UNAVAILABLE' });
      current.bridge.dispose();
    }
    const current = fixture(async () => { throw new ProviderFailure('RATE_LIMITED', true); });
    expect(await current.invoke('answer', submission())).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryable: true });
    current.bridge.dispose();
  });
});
