import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createLocalVoiceHost } = require('../../apps/desktop/voice/local-voice-host.cjs');
const { createRealtimeVoiceHost } = require('../../apps/desktop/realtime-voice-host.cjs');
type Handler = (event: unknown, ...args: unknown[]) => unknown;
type ConversationCallbacks = { onEvent(event: Record<string, unknown>): void; onError(): void; onEnd(): void };
const hosts: Array<{ dispose(): unknown }> = [];

function fixture(presentation: 'window' | 'pet' = 'window') {
  const windows: FakeWindow[] = [];
  const handlers = new Map<string, Handler>();
  let callbacks: ConversationCallbacks;
  let microphoneActive = false;
  const conversation = {
    snapshot: () => ({ microphoneActive }),
    probe: vi.fn(async (_options: { signal: AbortSignal }) => ({})),
    start: vi.fn(async (_options: { actor: string; confirmed: boolean }) => { microphoneActive = true; callbacks.onEvent({ type: 'state', state: 'listening' }); return { muted: false }; }),
    setMuted: vi.fn(async (muted: boolean) => { microphoneActive = !muted; return { muted }; }),
    interrupt: vi.fn(async () => ({ muted: false })),
    stop: vi.fn(async (): Promise<{ stopped: boolean; microphoneActive: boolean }> => { microphoneActive = false; return { stopped: true, microphoneActive: false }; }),
  };
  class FakeWindow extends EventEmitter {
    destroyed = false;
    webContents = Object.assign(new EventEmitter(), { isDestroyed: () => this.destroyed, mainFrame: { url: '' }, send: vi.fn(), setWindowOpenHandler: vi.fn() });
    constructor(readonly options: Record<string, unknown>) { super(); windows.push(this); }
    isDestroyed() { return this.destroyed; }
    show = vi.fn();
    focus = vi.fn();
    setContentProtection = vi.fn();
    destroy() { this.destroyed = true; this.emit('closed'); }
    async loadFile(file: string) { this.webContents.mainFrame.url = pathToFileURL(file).href; }
  }
  const privateSession = { setPermissionCheckHandler: vi.fn(), setPermissionRequestHandler: vi.fn(), setDisplayMediaRequestHandler: vi.fn(), webRequest: { onBeforeRequest: vi.fn() } };
  const electron = { BrowserWindow: FakeWindow, ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler), removeHandler: (channel: string) => handlers.delete(channel) },
    session: { fromPartition: vi.fn(() => privateSession) }, screen: { getPrimaryDisplay: () => ({ workArea: { width: 1200, height: 900 } }) } };
  const showDialog = vi.fn(async (_options: Record<string, unknown>) => ({ response: 0 }));
  const beforeStart = vi.fn(async () => {});
  const onState = vi.fn();
  const onTranscript = vi.fn();
  const provider = { answer: vi.fn() };
  const createConversation = vi.fn((options: ConversationCallbacks) => { callbacks = options; return conversation; });
  const host = createLocalVoiceHost({ electron, provider, showDialog, beforeStart, onState, onTranscript, presentation, createConversation });
  hosts.push(host);
  const event = () => ({ sender: windows[0].webContents, senderFrame: windows[0].webContents.mainFrame });
  const invoke = (name: string, ...args: unknown[]) => handlers.get('nuanban:voice-chat:' + name)!(event(), ...args);
  return { host, electron, conversation, createConversation, windows, handlers, event, invoke, showDialog, beforeStart, privateSession, provider, onTranscript, callbacks: () => callbacks };
}

afterEach(async () => { for (const host of hosts.splice(0)) await host.dispose(); });

describe('本地语音窗口的本人同意与生命周期（无真实采集）', () => {
  it('桌宠气泡模式同意后直接开始，不创建聊天窗口或 Renderer 媒体权限', async () => {
    const current = fixture('pet');
    await current.host.open();
    expect(current.windows).toHaveLength(0);
    expect(current.electron.session.fromPartition).not.toHaveBeenCalled();
    expect(current.conversation.start).toHaveBeenCalledExactlyOnceWith({ actor: 'owner', confirmed: true });
    expect(current.host.snapshot()).toMatchObject({ state: 'listening', active: true, microphoneActive: true });
    current.callbacks().onEvent({ type: 'transcript', id: 'turn-1', role: 'assistant', text: '合成桌宠回复' });
    expect(current.onTranscript).toHaveBeenCalledWith({ type: 'transcript', id: 'turn-1', role: 'assistant', text: '合成桌宠回复' });
    await current.host.control('mute');
    expect(current.conversation.setMuted).toHaveBeenCalledWith(true);
    await current.host.stop();
    current.callbacks().onEvent({ type: 'transcript', id: 'late', role: 'assistant', text: '迟到回复' });
    expect(current.onTranscript).toHaveBeenCalledTimes(1);
    expect(current.host.snapshot()).toMatchObject({ state: 'off', active: false, microphoneActive: false });
  });

  it('气泡模式取消仍不启麦；停麦失败保留活动状态且不能重开另一段监听', async () => {
    const current = fixture('pet');
    current.showDialog.mockResolvedValueOnce({ response: 1 });
    await current.host.open();
    expect(current.conversation.start).not.toHaveBeenCalled();
    await current.host.open();
    current.conversation.stop.mockResolvedValueOnce({ stopped: false, microphoneActive: true });
    expect(await current.host.stop()).toEqual({ stopped: false, microphoneActive: true });
    expect(current.host.snapshot()).toMatchObject({ state: 'error', active: true, microphoneActive: true });
    await current.host.open();
    expect(current.conversation.start).toHaveBeenCalledTimes(1);
    await current.host.stop();
  });

  it('无实时语音配置但有文字模型时选择本地；显式配置云端时不悄悄切换', async () => {
    const current = fixture();
    await current.host.dispose();
    const client = { status: () => ({ configured: false }) };
    const selected = createRealtimeVoiceHost({ electron: current.electron, provider: current.provider, client, showDialog: current.showDialog });
    hosts.push(selected);
    expect(selected.snapshot()).toMatchObject({ mode: 'local', configured: true, microphoneActive: false });
    await selected.dispose();
    const remote = createRealtimeVoiceHost({ electron: current.electron, provider: current.provider, client: { status: () => ({ configured: true }) }, showDialog: current.showDialog });
    hosts.push(remote);
    expect(remote.snapshot()).not.toHaveProperty('mode', 'local');
    expect(current.createConversation).not.toHaveBeenCalled();
  });

  it('默认不创建窗口、不探测、不调用模型；取消不启麦', async () => {
    const current = fixture();
    expect(current.host.snapshot()).toMatchObject({ state: 'off', active: false, microphoneActive: false });
    expect(current.windows).toHaveLength(0);
    current.showDialog.mockResolvedValueOnce({ response: 1 });
    await current.host.open();
    expect(current.createConversation).not.toHaveBeenCalled();
    expect(current.provider.answer).not.toHaveBeenCalled();
  });

  it('确认明确说明文字上云与额度；探测后仍须固定窗口开始，Renderer 无媒体权限', async () => {
    const current = fixture();
    await current.host.open();
    expect(current.showDialog.mock.calls[0][0]).toMatchObject({ defaultId: 1, cancelId: 1 });
    expect(String(current.showDialog.mock.calls[0][0].detail)).toContain('不能保证免费或完全离线');
    expect(current.beforeStart).toHaveBeenCalledTimes(1);
    expect(current.conversation.probe).toHaveBeenCalledTimes(1);
    expect(current.conversation.start).not.toHaveBeenCalled();
    expect(current.privateSession.setPermissionCheckHandler.mock.calls[0][0]()).toBe(false);
    const permission = vi.fn();
    current.privateSession.setPermissionRequestHandler.mock.calls[0][0]({}, 'media', permission);
    expect(permission).toHaveBeenCalledWith(false);
    expect(current.invoke('mode')).toEqual({ mode: 'local' });
    await current.invoke('local-control', 'start');
    expect(current.conversation.start).toHaveBeenCalledExactlyOnceWith({ actor: 'owner', confirmed: true });
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:voice-chat:event', { type: 'state', state: 'listening' });
  });

  it('拒绝子框架、额外参数、重复开始和任意操作', async () => {
    const current = fixture();
    await current.host.open();
    expect(() => current.handlers.get('nuanban:voice-chat:mode')!({ ...current.event(), senderFrame: { url: current.windows[0].webContents.mainFrame.url } })).toThrow('不可信');
    expect(() => current.invoke('mode', 'extra')).toThrow('不可信');
    await expect(current.invoke('local-control', 'mute')).rejects.toThrow('尚未开始');
    await current.invoke('local-control', 'start');
    await expect(current.invoke('local-control', 'start')).rejects.toThrow('无效');
    await expect(current.invoke('local-control', 'execute-command')).rejects.toThrow('无效');
    await current.invoke('local-control', 'mute');
    expect(current.conversation.setMuted).toHaveBeenCalledWith(true);
    await current.invoke('local-control', 'interrupt');
    expect(current.conversation.interrupt).toHaveBeenCalledTimes(1);
  });

  it('停止使迟到的本人同意失效，不能启动或探测', async () => {
    const current = fixture();
    let confirm!: (value: { response: number }) => void;
    current.showDialog.mockImplementationOnce(async () => new Promise(resolve => { confirm = resolve; }));
    const opening = current.host.open();
    await current.host.stop('lock');
    confirm({ response: 0 });
    await opening;
    expect(current.createConversation).not.toHaveBeenCalled();
    expect(current.windows).toHaveLength(0);
  });

  it('退出等待真实停麦，等待期间不允许重新开始；迟到事件被丢弃', async () => {
    const current = fixture();
    await current.host.open();
    await current.invoke('local-control', 'start');
    let finish!: (result: { stopped: boolean; microphoneActive: boolean }) => void;
    current.conversation.stop.mockImplementationOnce(async () => new Promise(resolve => { finish = resolve; }));
    const stopping = current.host.stop('lock');
    await Promise.resolve();
    expect(current.host.snapshot()).toMatchObject({ state: 'stopping', microphoneActive: true });
    expect(current.windows[0].destroyed).toBe(false);
    await expect(current.invoke('local-control', 'start')).rejects.toThrow('已结束');
    const sends = current.windows[0].webContents.send.mock.calls.length;
    current.callbacks().onEvent({ type: 'transcript', id: 'late', role: 'assistant', text: '不应显示' });
    expect(current.windows[0].webContents.send.mock.calls).toHaveLength(sends);
    await current.conversation.stop();
    finish({ stopped: true, microphoneActive: false });
    expect(await stopping).toEqual({ stopped: true, microphoneActive: false });
    expect(current.windows[0].destroyed).toBe(true);
  });

  it('停麦失败不销毁控制窗、不假报成功，后续可重试停止', async () => {
    const current = fixture();
    await current.host.open();
    await current.invoke('local-control', 'start');
    current.conversation.stop.mockResolvedValueOnce({ stopped: false, microphoneActive: true });
    expect(await current.host.stop()).toEqual({ stopped: false, microphoneActive: true });
    expect(current.windows[0].destroyed).toBe(false);
    expect(current.host.snapshot()).toMatchObject({ state: 'error', active: true });
    expect((await current.host.stop()).stopped).toBe(true);
  });

  it('渲染崩溃停止采集、不重建窗口；退出清理全部 IPC', async () => {
    const current = fixture();
    await current.host.open();
    await current.invoke('local-control', 'start');
    current.windows[0].webContents.emit('render-process-gone');
    await vi.waitFor(() => expect(current.host.snapshot().state).toBe('error'));
    expect(current.conversation.stop).toHaveBeenCalledTimes(1);
    expect(current.windows).toHaveLength(1);
    await current.host.dispose();
    expect(current.handlers.size).toBe(0);
  });
});
