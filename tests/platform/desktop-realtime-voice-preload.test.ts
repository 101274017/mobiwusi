import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type VoiceEvent = { type: string; state?: string; id?: string; role?: string; text?: string };
type VoiceBridge = {
  mode(): Promise<unknown>;
  transcript(value: unknown): Promise<unknown>;
  onControl(listener: (action: string) => void): () => void;
  localControl(action: string): Promise<unknown>;
  onEvent(listener: (value: VoiceEvent) => void): () => void;
  connect(offer: string): Promise<unknown>;
  state(value: string): Promise<unknown>;
  stop(): Promise<unknown>;
  failed(): Promise<unknown>;
};

function fixture() {
  const events = new EventEmitter();
  const invoke = vi.fn(async (_channel: string, ..._argumentsList: unknown[]) => ({}));
  let bridge!: VoiceBridge;
  const exposeInMainWorld = vi.fn((name: string, value: VoiceBridge) => {
    expect(name).toBe('nuanbanVoiceChat');
    bridge = value;
  });
  runInNewContext(readFileSync(new URL('../../apps/desktop/realtime-voice-preload.cjs', import.meta.url), 'utf8'), {
    require: (name: string) => {
      if (name !== 'electron') throw new Error('Unexpected preload import');
      return { contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke, on: events.on.bind(events), removeListener: events.removeListener.bind(events) } };
    },
  });
  const emit = (value: unknown) => events.emit('nuanban:voice-chat:event', {}, value);
  return { bridge, invoke, events, emit, exposeInMainWorld };
}

describe('本地与云端共用语音 preload 的受限桥接', () => {
  it('仅向宿主投影文字字幕，不转发音频和任意字段', async () => {
    const current = fixture();
    await current.bridge.transcript({ id: 'response_1', role: 'assistant', text: '桌宠气泡回答', audio: 'discard', apiKey: 'discard' });
    expect(current.invoke).toHaveBeenCalledWith('nuanban:voice-chat:transcript', { id: 'response_1', role: 'assistant', text: '桌宠气泡回答' });
    for (const value of [null, {}, { id: 'turn', role: 'system', text: '拒绝' },
      { id: 'x'.repeat(221), role: 'user', text: '拒绝' }, { id: 'turn', role: 'user', text: 'x'.repeat(6001) }]) {
      expect(() => current.bridge.transcript(value)).toThrow('语音字幕无效');
    }
    expect(current.invoke).toHaveBeenCalledTimes(1);
  });

  it('桌宠控制仅允许静音、恢复和打断，取消监听后忽略迟到事件', () => {
    const current = fixture();
    const listener = vi.fn();
    const unsubscribe = current.bridge.onControl(listener);
    for (const action of ['mute', 'unmute', 'interrupt', 'start', 'stop', null, { action: 'mute' }]) {
      current.events.emit('nuanban:voice-chat:control', {}, action);
    }
    expect(listener.mock.calls).toEqual([['mute'], ['unmute'], ['interrupt']]);
    unsubscribe();
    unsubscribe();
    expect(current.events.listenerCount('nuanban:voice-chat:control')).toBe(0);
    current.events.emit('nuanban:voice-chat:control', {}, 'mute');
    expect(listener).toHaveBeenCalledTimes(3);
    expect(() => current.bridge.onControl(null as unknown as (action: string) => void)).toThrow('语音控制监听器必须是函数');
  });

  it('仅暴露冻结的固定命令，不暴露原始 IPC', async () => {
    const current = fixture();
    expect(current.exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(current.bridge)).toBe(true);
    expect(Object.keys(current.bridge).sort()).toEqual(['connect', 'failed', 'localControl', 'mode', 'onControl', 'onEvent', 'state', 'stop', 'transcript']);
    await current.bridge.mode();
    await current.bridge.stop();
    await current.bridge.failed();
    expect(current.invoke.mock.calls).toEqual([
      ['nuanban:voice-chat:mode'], ['nuanban:voice-chat:stop'], ['nuanban:voice-chat:failed'],
    ]);
  });

  it('本地操作、云端状态与 SDP 必须通过白名单', async () => {
    const current = fixture();
    for (const action of ['start', 'mute', 'unmute', 'interrupt']) await current.bridge.localControl(action);
    for (const state of ['listening', 'thinking', 'speaking', 'muted']) await current.bridge.state(state);
    await current.bridge.connect('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111');
    expect(current.invoke).toHaveBeenCalledTimes(9);
    expect(() => current.bridge.localControl('record')).toThrow('本地语音操作无效');
    expect(() => current.bridge.state('off')).toThrow('语音状态无效');
    expect(() => current.bridge.connect('not an offer')).toThrow('语音会话无效');
    expect(() => current.bridge.connect('v=0\n' + 'x'.repeat(65536))).toThrow('语音会话无效');
    expect(current.invoke).toHaveBeenCalledTimes(9);
  });

  it('状态与字幕只投影固定字段，移除音频、密钥和其他原始数据', () => {
    const current = fixture();
    const listener = vi.fn();
    current.bridge.onEvent(listener);
    current.emit({ type: 'state', state: 'listening', microphoneActive: true, secret: 'not-exposed' });
    current.emit({ type: 'transcript', id: 'local-turn-1', role: 'user', text: '合成听写文字', audio: 'not-exposed' });
    expect(listener.mock.calls).toEqual([
      [{ type: 'state', state: 'listening' }],
      [{ type: 'transcript', id: 'local-turn-1', role: 'user', text: '合成听写文字' }],
    ]);
  });

  it('忽略未知状态、无效字幕和超长载荷', () => {
    const current = fixture();
    const listener = vi.fn();
    current.bridge.onEvent(listener);
    for (const value of [null, {}, { type: 'state', state: 'off' }, { type: 'state', state: 'error' },
      { type: 'transcript', id: '../path', role: 'user', text: '无效标识' },
      { type: 'transcript', id: 'turn-1', role: 'system', text: '无效角色' },
      { type: 'transcript', id: 'turn-1', role: 'assistant', text: 'x'.repeat(6001) },
      { type: 'transcript', id: 'turn-1', role: 'user', text: 123 },
    ]) current.emit(value);
    expect(listener).not.toHaveBeenCalled();
  });

  it('取消监听移除实际 IPC listener，不再接收迟到字幕', () => {
    const current = fixture();
    const listener = vi.fn();
    const unsubscribe = current.bridge.onEvent(listener);
    expect(current.events.listenerCount('nuanban:voice-chat:event')).toBe(1);
    unsubscribe();
    unsubscribe();
    expect(current.events.listenerCount('nuanban:voice-chat:event')).toBe(0);
    current.emit({ type: 'transcript', id: 'late', role: 'assistant', text: '迟到结果' });
    expect(listener).not.toHaveBeenCalled();
    expect(() => current.bridge.onEvent(null as unknown as (value: VoiceEvent) => void)).toThrow('语音监听器必须是函数');
  });
});
