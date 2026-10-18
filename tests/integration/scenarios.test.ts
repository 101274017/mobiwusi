import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuration, scenarioCatalog } from '@nuanban/config';
import { DemoConversation, ScenarioRepository, createScenarioSnapshot } from '@nuanban/mocks';
import { readConversation } from '@nuanban/application';
import { IndexedDbRepository, IndexedDbDrawing } from '@nuanban/local-data';
import { UnconnectedConversation, UnconnectedRepository } from '../../packages/api-client/src/index';
import { guideReducer, initialGuide } from '@nuanban/domain';

afterEach(() => vi.useRealTimers());
describe('确定性 Mock 与独立开关', () => {
  it('登记了方案规定的 13 个场景', () => {
    expect(scenarioCatalog).toHaveLength(13);
    expect(new Set(scenarioCatalog.map(scenario => scenario.id)).size).toBe(13);
    for (const scenario of scenarioCatalog) expect(configuration({ VITE_MOCK_SCENARIO: scenario.id }, false).scenario).toBe(scenario.id);
  });
  it('同场景重置的时间、ID 与顺序固定', () => {
    expect(createScenarioSnapshot('demo-owner', 'success')).toEqual(createScenarioSnapshot('demo-owner', 'success'));
    expect(createScenarioSnapshot('demo-owner', 'success').todos[0].timezone).toBe('Asia/Shanghai');
    expect(createScenarioSnapshot('demo-owner', 'empty').notes).toEqual([]);
    expect(createScenarioSnapshot('demo-owner', 'empty').todos).toEqual([]);
  });
  it('平台选择不会改变业务服务或场景', () => {
    for (const platform of ['browser', 'windows', 'android']) {
      expect(configuration({ VITE_PLATFORM_MODE: platform, VITE_MOCK_SCENARIO: 'timeout' }, false)).toEqual({ apiMode: 'mock', platformMode: platform, scenario: 'timeout' });
    }
  });
  it('未知场景、真实模式注入和正式部署 Mock 均失败关闭', () => {
    expect(() => configuration({ VITE_MOCK_SCENARIO: 'typo' }, false)).toThrow('未知演示场景');
    expect(() => configuration({ VITE_API_MODE: 'real', VITE_MOCK_SCENARIO: 'offline' }, false)).toThrow('禁止注入');
    expect(() => configuration({ VITE_API_MODE: 'mock' }, true)).toThrow('禁止');
  });
  it.each([
    ['timeout', 'TIMEOUT'], ['offline', 'NETWORK_OFFLINE'], ['permission-denied', 'PERMISSION_DENIED'],
    ['stream-interrupted', 'STREAM_INTERRUPTED'], ['partial-failure', 'PARTIAL_FAILURE'], ['provider-quota', 'RATE_LIMITED'],
  ] as const)('场景 %s 返回真实错误状态 %s', async (scenario, code) => {
    vi.useFakeTimers();
    const result = readConversation(new DemoConversation(scenario), '字体怎么调大？', new AbortController().signal, vi.fn());
    const assertion = expect(result).rejects.toMatchObject({ code });
    await vi.runAllTimersAsync();
    await assertion;
  });
  it('正常场景可以完整消费并重放事件序列', async () => {
    vi.useFakeTimers();
    const first = readConversation(new DemoConversation(), '字体怎么调大？', new AbortController().signal, vi.fn());
    await vi.runAllTimersAsync();
    const answer = await first;
    const second = readConversation(new DemoConversation(), '字体怎么调大？', new AbortController().signal, vi.fn());
    await vi.runAllTimersAsync();
    expect(await second).toBe(answer);
    expect(answer).toContain('大字体');
  });
  it('真实适配器缺失时不返回 Mock 或读取演示资料', async () => {
    await expect(readConversation(new UnconnectedConversation(), '怎么操作', new AbortController().signal, vi.fn())).rejects.toThrow('不会回退');
    await expect(new UnconnectedRepository().load('demo-local-owner')).rejects.toThrow('不会读取或创建演示账号');
    await expect(new UnconnectedRepository().commit('demo-local-owner', createScenarioSnapshot('demo-local-owner', 'success'))).rejects.toThrow('未保存');
  });
});

describe('场景仓储与安全状态', () => {
  it('版本冲突保留旧内容，不能以成功提示覆盖', async () => {
    const owner = crypto.randomUUID();
    const underlying = new IndexedDbRepository();
    const repository = new ScenarioRepository(underlying, 'version-conflict');
    const snapshot = createScenarioSnapshot(owner, 'version-conflict');
    expect(await repository.load(owner)).toBeNull();
    await repository.commit(owner, snapshot);
    const changed = structuredClone(snapshot);
    changed.notes[0].mastery = 'mastered';
    await expect(repository.commit(owner, changed)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await underlying.load(owner))!.notes[0].mastery).toBe('unmastered');
  });
  it('清理一个场景不清理其他账号或画稿', async () => {
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    const repository = new IndexedDbRepository();
    const firstDrawing = new IndexedDbDrawing(first);
    const secondDrawing = new IndexedDbDrawing(second);
    await repository.commit(first, createScenarioSnapshot(first, 'success'));
    await repository.commit(second, createScenarioSnapshot(second, 'empty'));
    await firstDrawing.save([]);
    await secondDrawing.save([]);
    await repository.clear(first);
    await firstDrawing.clear();
    expect(await repository.load(first)).toBeNull();
    expect(await firstDrawing.load()).toBeNull();
    expect(await repository.load(second)).not.toBeNull();
    expect(await secondDrawing.load()).toEqual([]);
  });
  it('低置信暂停撤销代际，迟到目标不能恢复指向', () => {
    const started = guideReducer(guideReducer(initialGuide, { type: 'START' }), { type: 'CONSENT' });
    const paused = guideReducer(started, { type: 'LOW_CONFIDENCE', generation: started.generation });
    expect(paused.state).toBe('need_help');
    expect(paused.generation).toBeGreaterThan(started.generation);
    expect(guideReducer(paused, { type: 'TARGET', generation: started.generation })).toEqual(paused);
  });
  it('结束后不接纳低置信或风险迟到事件', () => {
    const ended = guideReducer(initialGuide, { type: 'STOP' });
    expect(guideReducer(ended, { type: 'LOW_CONFIDENCE', generation: ended.generation })).toEqual(ended);
    expect(guideReducer(ended, { type: 'RISK', risk: 'transaction' })).toEqual(ended);
  });
});
