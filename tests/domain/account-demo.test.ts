import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountDemoEligibility, accountDemoReducer, initialAccountDemo, type AccountDemoInput } from '../fixtures/account-demo';
import { DemoAccountFlow } from '../fixtures/business-scenarios';

const input: AccountDemoInput = { method: 'family', platform: 'android', subject: 'adult', hasSim: true, bound: true, operatorAuthorized: true, purposeAccepted: true, outcome: 'success' };
afterEach(() => vi.useRealTimers());

describe('账号演练不会升级成认证或授权', () => {
  it.each(['carrier', 'face', 'device', 'family', 'community'] as const)('%s 路径先校验再确认，始终 authenticated:false', method => {
    const started = accountDemoReducer(initialAccountDemo, { type: 'START', input: { ...input, method } });
    expect(started.phase).toBe('waiting');
    const proof = accountDemoReducer(started, { type: 'PROOF', generation: started.generation });
    expect(proof.phase).toBe('await_confirmation');
    expect(accountDemoReducer(proof, { type: 'CONFIRM', consent: false, guardianVerified: false }).phase).toBe('await_confirmation');
    const result = accountDemoReducer(proof, { type: 'CONFIRM', consent: true, guardianVerified: false });
    expect(result.phase).toBe('demo_ready'); expect(result.authenticated).toBe(false);
  });
  it('Windows、无 SIM、无绑定、无开通权和未确认用途都不能假成功', () => {
    expect(accountDemoEligibility({ ...input, method: 'carrier', platform: 'windows' })).toContain('没有本机号码能力');
    expect(accountDemoEligibility({ ...input, method: 'carrier', hasSim: false })).not.toBeNull();
    expect(accountDemoEligibility({ ...input, method: 'face', bound: false })).toContain('陌生人脸');
    expect(accountDemoEligibility({ ...input, method: 'device', bound: false })).not.toBeNull();
    expect(accountDemoEligibility({ ...input, operatorAuthorized: false })).not.toBeNull();
    expect(accountDemoEligibility({ ...input, purposeAccepted: false })).not.toBeNull();
  });
  it('儿童必须经有效监护关系模拟核验，名单和操作员不能代确认', () => {
    const waiting = accountDemoReducer(initialAccountDemo, { type: 'START', input: { ...input, method: 'community', subject: 'child' } });
    const proof = accountDemoReducer(waiting, { type: 'PROOF', generation: waiting.generation });
    const blocked = accountDemoReducer(proof, { type: 'CONFIRM', consent: true, guardianVerified: false });
    expect(blocked.phase).toBe('await_confirmation'); expect(blocked.error).toContain('监护关系');
    expect(accountDemoReducer(blocked, { type: 'CONFIRM', consent: true, guardianVerified: true }).phase).toBe('demo_ready');
  });
  it('停止、过期和重启隔离迟到证明，不会静默激活', () => {
    const waiting = accountDemoReducer(initialAccountDemo, { type: 'START', input });
    const stopped = accountDemoReducer(waiting, { type: 'CANCEL' });
    expect(accountDemoReducer(stopped, { type: 'PROOF', generation: waiting.generation })).toEqual(stopped);
    const restarted = accountDemoReducer(stopped, { type: 'START', input });
    expect(accountDemoReducer(restarted, { type: 'PROOF', generation: waiting.generation })).toEqual(restarted);
    const proof = accountDemoReducer(restarted, { type: 'PROOF', generation: restarted.generation });
    const expired = accountDemoReducer(proof, { type: 'EXPIRE' });
    expect(accountDemoReducer(expired, { type: 'CONFIRM', consent: true, guardianVerified: true })).toEqual(expired);
  });
  it('Mock 端口只返回合成证明，支持取消/失败/过期且不发凭证', async () => {
    vi.useFakeTimers();
    const service = new DemoAccountFlow();
    const result = service.attempt(input, new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ source: 'mock', authenticated: false });
    for (const outcome of ['failure', 'expired'] as const) {
      const pending = service.attempt({ ...input, outcome }, new AbortController().signal);
      const assertion = expect(pending).rejects.toMatchObject({ code: outcome === 'failure' ? 'AUTH_FAILED' : 'INVITE_EXPIRED' });
      await vi.runAllTimersAsync(); await assertion;
    }
    const controller = new AbortController();
    const cancelled = service.attempt(input, controller.signal);
    const assertion = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await assertion;
  });
});
