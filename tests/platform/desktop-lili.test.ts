import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { AnimationController } = require('../../apps/desktop/lili-animation.cjs');
const { loadLiliResource, describeLiliResource } = require('../../apps/desktop/lili-resource.cjs');
const { createLiliHost } = require('../../apps/desktop/lili-host.cjs');
const { createLiliAdapter } = require('../../apps/desktop/lili-adapter.cjs');
const directory = resolve('apps/desktop/assets/lili');
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
const hosts: { dispose(): void }[] = [];
afterEach(() => { for (const host of hosts.splice(0)) host.dispose(); vi.useRealTimers(); });

function advance(controller: InstanceType<typeof AnimationController>, duration: number) {
  for (let remaining = duration; remaining > 0; remaining -= 125) controller.advance(Math.min(remaining, 125));
}

function hostFixture(overrides = {}) {
  const events: { type: string }[] = [];
  const host = createLiliHost({ userDataPath: mkdtempSync(join(tmpdir(), 'nuanban-lili-')),
    resourcePath: directory, onEvent: (event: { type: string }) => events.push(event), onView: () => ({ ok: true }), ...overrides });
  hosts.push(host);
  return { host, events };
}

describe('栗栗独立角色资源', () => {
  it('实际校验所有身体与表情图集并查询能力', () => {
    const resource = loadLiliResource(directory);
    expect(resource.atlases).toHaveLength(30);
    expect(describeLiliResource(resource)).toMatchObject({ id: 'lili', version: '1.0.0', fps: 24,
      anchor: [192, 336], capabilities: { runtimeNeedsBlender: false, frontOnly: true } });
  });

  it('拒绝不兼容锚点和非法动作帧', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'lili-invalid-'));
    const invalid = structuredClone(manifest);
    invalid.anchor = [0, 0];
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify(invalid));
    expect(() => loadLiliResource(temporary)).toThrow('锚点');
    invalid.anchor = [192, 336];
    invalid.frames.idle[0].atlas = 999;
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify(invalid));
    expect(() => loadLiliResource(temporary)).toThrow('动作帧');
  });
});

describe('栗栗动画控制', () => {
  it('待机循环，招手完成后返回待机并发送完成事件', () => {
    const controller = new AnimationController(manifest);
    const events: { type: string; reason?: string; action?: string }[] = [];
    controller.on('event', (event: typeof events[number]) => events.push(event));
    advance(controller, 4200);
    expect(controller.snapshot().clip).toBe('idle');
    controller.play('wave');
    advance(controller, 3000);
    expect(controller.snapshot().clip).toBe('idle');
    expect(events).toContainEqual(expect.objectContaining({ type: 'action.completed', action: 'wave', reason: 'finished' }));
  });

  it('更高优先级打断可中断动作，重复事件合并', () => {
    const controller = new AnimationController(manifest);
    controller.play('wave');
    expect(controller.play('wave').status).toBe('coalesced');
    expect(controller.play('success').status).toBe('started');
    expect(controller.snapshot().action).toBe('success');
  });

  it('举牌不可打断，排队按优先级执行，停止等待道具交接完成', () => {
    const controller = new AnimationController(manifest);
    controller.play('sign');
    expect(controller.play('wave', { enqueue: true }).status).toBe('queued');
    expect(controller.play('success').status).toBe('queued');
    expect(controller.snapshot().queue).toEqual(['success', 'wave']);
    expect(controller.stop().status).toBe('deferred_until_safe');
    expect(controller.snapshot().clip).toBe('sign');
    advance(controller, 8000);
    expect(controller.snapshot().clip).toBe('idle');
    expect(controller.snapshot().queue).toEqual([]);
  });

  it('休息经过坐下、循环和起身，起身之后才执行动作', () => {
    const controller = new AnimationController(manifest);
    controller.play('rest');
    expect(controller.snapshot().clip).toBe('rest_enter');
    advance(controller, 3000);
    expect(controller.snapshot().clip).toBe('rest_loop');
    expect(controller.play('wave').status).toBe('waking');
    expect(controller.snapshot().clip).toBe('rest_exit');
    advance(controller, 3000);
    expect(controller.snapshot().clip).toBe('wave');
    advance(controller, 3000);
    expect(controller.snapshot().clip).toBe('rest_enter');
  });

  it('暂停不推进帧，减少动态保留动作计时，拒绝非法参数', () => {
    const controller = new AnimationController(manifest);
    controller.configure({ paused: true });
    advance(controller, 1000);
    expect(controller.snapshot().frame).toBe(0);
    expect(controller.configure({ paused: 'yes' }).ok).toBe(false);
    expect(controller.play('wave', { priority: NaN }).ok).toBe(false);
    expect(controller.setExpression('happy', 2).ok).toBe(false);
    controller.configure({ paused: false, reducedMotion: true });
    controller.play('wave');
    expect(controller.snapshot().frame).toBe(36);
    advance(controller, 3000);
    expect(controller.snapshot().clip).toBe('idle');
  });
});

describe('栗栗暖伴适配和生命周期', () => {
  it('状态变化映射表现，重复发布不重复播放，隐私暂停不展示新业务文字', () => {
    const play = vi.fn(() => ({ ok: true }));
    const setExpression = vi.fn(() => ({ ok: true }));
    const showBubble = vi.fn();
    const adapter = createLiliAdapter({ play, setExpression, showBubble });
    const state = { task: { state: 'completed' }, observation: { state: 'off' }, messages: [{ role: 'assistant', text: '完成啦' }] };
    adapter.observe(state);
    adapter.observe(state);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('success');
    expect(showBubble).toHaveBeenCalledTimes(1);
    adapter.observe({ ...state, observation: { state: 'privacy_paused' }, messages: [{ role: 'assistant', text: '私密内容' }] });
    expect(showBubble).not.toHaveBeenCalledWith('私密内容');
    expect(adapter.semantic('unknown').ok).toBe(false);
  });

  it('默认不启用；选择后能控制并收到事件；销毁后拒绝命令', () => {
    const { host, events } = hostFixture();
    expect(host.bootstrap().enabled).toBe(false);
    expect(host.command({ type: 'action.play', action: 'wave' }).code).toBe('lili_not_selected');
    expect(host.setEnabled(true).ok).toBe(true);
    expect(host.bootstrap().atlases).toHaveLength(30);
    expect(host.command({ type: 'action.play', action: 'wave' }).ok).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: 'action.started', action: 'wave' }));
    expect(host.command({ type: 'display.set', options: { facing: 'left' } }).code).toBe('unsupported_facing');
    expect(host.command({ type: 'action.play', action: 'wave', arbitraryPath: '../secret' }).ok).toBe(false);
    host.dispose();
    expect(host.command({ type: 'state.get' }).code).toBe('disposed');
    expect(host.bootstrap().enabled).toBe(false);
    expect(host.interaction({ type: 'click' }).ok).toBe(false);
  });

  it('结束语音倾听时恢复动作表情，教学仍分析时保留倾听', () => {
    const setExpression = vi.fn(() => ({ ok: true }));
    const adapter = createLiliAdapter({ play: vi.fn(() => ({ ok: true })), setExpression, showBubble: vi.fn() });
    adapter.observe({ task: { state: 'idle' }, voice: { state: 'thinking' } });
    expect(setExpression).toHaveBeenLastCalledWith('listening');
    adapter.observe({ task: { state: 'idle' }, voice: { state: 'speaking' } });
    expect(setExpression).toHaveBeenLastCalledWith(null);
    adapter.observe({ task: { state: 'analyzing' }, voice: { state: 'listening' } });
    adapter.observe({ task: { state: 'analyzing' }, voice: { state: 'off' } });
    expect(setExpression).toHaveBeenLastCalledWith('listening');
  });

  it('资源加载失败后可以重新选择恢复，重新选择不继承上次举牌或表情', () => {
    const { host, events } = hostFixture();
    host.setEnabled(true);
    host.command({ type: 'action.play', action: 'sign' });
    host.command({ type: 'expression.set', expression: 'concern' });
    host.interaction({ type: 'loadFailed' });
    expect(host.snapshot().failure).not.toBe('');
    expect(host.setEnabled(true).ok).toBe(true);
    expect(host.snapshot()).toMatchObject({ failure: '', animation: { clip: 'idle', expression: 'smile' } });
    host.setEnabled(false);
    host.setEnabled(true);
    expect(host.snapshot().animation.clip).toBe('idle');
    expect(events.filter(event => event.type === 'resource.changed')).toHaveLength(4);
  });

  it('气泡只接收文字并自动消失，无法恢复时拒绝隐藏与穿透', () => {
    vi.useFakeTimers();
    const { host } = hostFixture({ onView: (view: { visible?: boolean }) => view.visible === false ? { ok: false, code: 'tray_unavailable' } : { ok: true } });
    host.setEnabled(true);
    expect(host.command({ type: 'semantic.send', name: 'listening', text: '<b>只作文字</b>' }).ok).toBe(true);
    expect(host.snapshot().bubble).toBe('<b>只作文字</b>');
    vi.advanceTimersByTime(12000);
    expect(host.snapshot().bubble).toBe('');
    expect(host.command({ type: 'display.set', options: { visible: false } }).code).toBe('tray_unavailable');
    expect(host.command({ type: 'display.set', options: { size: 0 } }).ok).toBe(false);
  });

  it('资源缺失返回错误而不是报告已加载', () => {
    const { host, events } = hostFixture({ resourcePath: join(tmpdir(), 'missing-lili-resources') });
    expect(host.setEnabled(true)).toEqual({ ok: false, code: 'resource_load_failed' });
    expect(host.snapshot().enabled).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: 'resource.load_failed' }));
  });
});
