import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { syntheticDetection, syntheticFrame } from '../helpers/standalone-frame';

const { createStandaloneHost } = createRequire(import.meta.url)('../../apps/desktop/standalone-host.cjs');
const hosts: { dispose(reason: string): Promise<unknown> }[] = [];
type Handler = (event: unknown, payload?: unknown) => unknown;
type MenuEntry = { label?: string; type?: string; checked?: boolean; click?: () => unknown };
type Bounds = { x: number; y: number; width: number; height: number };
type WakeState = { state: string; enabled: boolean; microphoneActive: boolean; generation: number; localOnly: true; dictationAvailable: boolean };
type WakeCallbacks = { onState(state: WakeState): void; onWake(event: { localOnly: true; generation: number }): void; onQuestion(text: string): void };

function fixture(overrides: Record<string, unknown> = {}) {
  const handlers = new Map<string, Handler>();
  const windows: FakeWindow[] = [];
  const menus: MenuEntry[][] = [];
  const area = { x: -800, y: 0, width: 800, height: 620 };
  const display = { id: 1, bounds: { ...area, height: 640 }, workArea: area, scaleFactor: 1 };
  let selectSource: boolean | 'region' = false;
  const source = { listSources: vi.fn(async () => [{ id: 'screen:1:0', name: '合成屏幕', type: 'screen', geometry: area }]),
    capture: vi.fn(async () => syntheticFrame()), detect: vi.fn(async (frame: ReturnType<typeof syntheticFrame>) => syntheticDetection(frame)), stop: vi.fn(async () => undefined) };
  const analyzer = { capabilities: () => ({ configured: false }), analyze: vi.fn() };
  const questioner = { answer: vi.fn(async (_input: { question: string; signal: AbortSignal; instructions?: string }) => ({ text: '可以先打开系统设置，再根据当前页面选择显示相关选项。' })) };
  let wakeState: WakeState = { state: 'disabled', enabled: false, microphoneActive: false, generation: 0, localOnly: true, dictationAvailable: true };
  let wakeCallbacks: WakeCallbacks;
  const setWakeState = (values: Partial<WakeState>) => { wakeState = { ...wakeState, ...values }; wakeCallbacks?.onState({ ...wakeState }); return { ...wakeState }; };
  const wake = { snapshot: () => ({ ...wakeState }), probe: vi.fn(async (_input: unknown): Promise<{ status: string; dictationAvailable?: boolean }> => ({ status: 'complete', dictationAvailable: true })),
    dictate: vi.fn(async (_input: { actor: 'owner'; confirmed: true; signal?: AbortSignal }): Promise<Record<string, unknown>> => ({ status: 'complete', text: '教我收藏网页', localOnly: true, microphoneActive: false })),
    enable: vi.fn(async (_input: unknown) => setWakeState({ state: 'listening', enabled: true, microphoneActive: true, generation: wakeState.generation + 1 })),
    disable: vi.fn(async () => setWakeState({ state: 'disabled', enabled: false, microphoneActive: false, generation: wakeState.generation + 1 })) };
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(`synthetic:${value}`), decryptString: (value: Buffer) => value.toString().slice(10) };
  class FakeWindow extends EventEmitter {
    destroyed = false;
    visible = false;
    minimized = false;
    bounds: Bounds;
    protection = false;
    ignoresMouse = false;
    webContents = Object.assign(new EventEmitter(), { isDestroyed: () => this.destroyed, mainFrame: { url: '' },
      send: vi.fn(), setWindowOpenHandler: vi.fn() });
    constructor(public settings: Record<string, unknown>) {
      super();
      this.bounds = { x: Number(settings.x ?? 0), y: Number(settings.y ?? 0), width: Number(settings.width), height: Number(settings.height) };
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return this.minimized; }
    isVisible() { return this.visible; }
    restore = vi.fn(() => { this.minimized = false; });
    setContentProtection(value: boolean) { this.protection = value; }
    setAlwaysOnTop() {}
    setIgnoreMouseEvents(value: boolean) { this.ignoresMouse = value; }
    getBounds() { return { ...this.bounds }; }
    setBounds(bounds: Bounds) { this.bounds = bounds; }
    setPosition(positionX: number, positionY: number) { this.bounds = { ...this.bounds, x: positionX, y: positionY }; }
    hide() { this.visible = false; }
    show() { this.visible = true; }
    showInactive() { this.visible = true; }
    focus() {}
    async loadFile(file: string) { this.webContents.mainFrame.url = pathToFileURL(file).href; this.webContents.emit('did-finish-load'); }
  }
  const note = { noteId: 'note-local', question: '如何调整显示', summary: '学习显示设置', result: 'unfinished', mastery: 'unmastered' };
  const proposal = { proposalId: 'proposal-local', remindAt: new Date(Date.now() + 60000).toISOString(), timezone: 'Asia/Shanghai', state: 'suggested', reason: '再练习一次' };
  const item = { accountId: 'local-owner', reminderId: 'review-local', instanceId: 'instance-local', scheduleVersion: 1,
    dueAt: proposal.remindAt, updatedAt: new Date().toISOString(), deepLink: 'nuanban://review/note-local', payload: { title: '练习' } };
  const learning = { getLatest: vi.fn(() => ({ note, proposal })), listNotes: vi.fn(() => [note]), getNote: vi.fn(() => note), getOwnerId: () => 'local-owner',
    recordTeaching: vi.fn(), suggestReview: vi.fn(), confirmMastery: vi.fn(), confirmReview: vi.fn(), declineReview: vi.fn(),
    pendingReminders: vi.fn((): typeof item[] => []), markReminderScheduled: vi.fn(), close: vi.fn() };
  const reminderStore = { list: vi.fn(() => []), schedule: vi.fn() };
  const showManagement = vi.fn();
  const showPetTool = vi.fn(async () => true);
  const dialog = { showMessageBox: vi.fn(async (..._arguments: unknown[]) => ({ response: 1, checkboxChecked: false })) };
  const powerMonitor = new EventEmitter();
  const screen = Object.assign(new EventEmitter(), { getPrimaryDisplay: () => display, getDisplayMatching: () => display,
    getDisplayNearestPoint: vi.fn(() => display), getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })) });
  const options = { electron: { BrowserWindow: FakeWindow, ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel) }, screen, safeStorage, powerMonitor, dialog,
    Menu: { buildFromTemplate(template: MenuEntry[]) { menus.push(template); return { popup(configuration: { callback?: () => void }) {
      if (configuration.callback) { if (selectSource) template[selectSource === 'region' ? 2 : 1].click?.(); configuration.callback(); }
    } }; } } }, userDataPath: join(process.cwd(), '.cache', 'synthetic-host-unused'),
    source, analyzer, questioner, createWakeSource: (callbacks: WakeCallbacks) => { wakeCallbacks = callbacks; return wake; },
    createLearningStore: () => learning, reminderStore, isQuitting: () => false, hasManagementWindow: vi.fn(() => false), onExit: vi.fn(), showManagement, showPetTool };
  const host = createStandaloneHost({ ...options, ...overrides });
  hosts.push(host);
  const event = () => ({ sender: windows[0].webContents, senderFrame: windows[0].webContents.mainFrame });
  const invoke = (channel: string, payload?: unknown, sender = event()) => handlers.get(channel)!(sender, payload);
  return { host, options, windows, source, analyzer, questioner, learning, reminderStore, item, dialog, handlers, powerMonitor, screen, menus, invoke, showManagement, showPetTool,
    choose: (region = false) => { selectSource = region ? 'region' : true; }, wake, setWakeState,
    wakeUp: () => wakeCallbacks.onWake({ localOnly: true, generation: wakeState.generation }),
    question: (text: string) => wakeCallbacks.onQuestion(text) };
}

function faceVoiceFixture() {
  let voiceState = { state: 'off', active: false, microphoneActive: false, configured: true, mode: 'local' };
  let callbacks!: { presentation: string; onState(state: typeof voiceState): void; onTranscript(event: Record<string, unknown>): void };
  const update = (values: Partial<typeof voiceState>) => { voiceState = { ...voiceState, ...values }; callbacks.onState({ ...voiceState }); };
  const stop = vi.fn(async () => { update({ state: 'off', active: false, microphoneActive: false }); return { stopped: true, microphoneActive: false }; });
  const voice = {
    snapshot: () => ({ ...voiceState }),
    open: vi.fn(async () => update({ state: 'listening', active: true, microphoneActive: true })),
    control: vi.fn(async (action: string) => update({ state: action === 'mute' ? 'muted' : 'listening', microphoneActive: action !== 'mute' })),
    stop, dispose: vi.fn(async () => { update({ state: 'off', active: false, microphoneActive: false }); return { stopped: true, microphoneActive: false }; }),
  };
  const createVoiceHost = vi.fn((input: typeof callbacks) => { callbacks = input; return voice; });
  return { ...fixture({ createVoiceHost }), voice, createVoiceHost, update,
    transcript: (event: Record<string, unknown>) => callbacks.onTranscript(event) };
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.dispose('test')));
});

describe('桌宠身体拖动的受限窗口接线', () => {
  it('只用系统光标移动桌宠，保留原尺寸，不触发观察、麦克风或管理窗口', async () => {
    const current = fixture();
    await current.host.initialize();
    const before = current.windows[0].getBounds();
    const otherWindows = current.windows.slice(1).map(window => window.getBounds());
    current.screen.getCursorScreenPoint.mockReturnValue({ x: before.x + 80, y: before.y + 100 });
    expect(await current.invoke('nuanban:pet:drag', 'start')).toBe(true);
    current.screen.getCursorScreenPoint.mockReturnValue({ x: before.x + 30, y: before.y + 80 });
    expect(await current.invoke('nuanban:pet:drag', 'move')).toBe(true);
    expect(current.windows[0].getBounds()).toEqual({ ...before, x: before.x - 50, y: before.y - 20 });
    await current.invoke('nuanban:pet:drag', 'end');
    current.screen.getCursorScreenPoint.mockReturnValue({ x: -700, y: 10 });
    expect(await current.invoke('nuanban:pet:drag', 'move')).toBe(false);
    expect(current.windows[0].getBounds()).toEqual({ ...before, x: before.x - 50, y: before.y - 20 });
    expect(current.windows.slice(1).map(window => window.getBounds())).toEqual(otherWindows);
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.wake.dictate).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.showPetTool).not.toHaveBeenCalled();
  });

  it('负坐标屏幕边界与任务栏工作区限制生效', async () => {
    const current = fixture();
    await current.host.initialize();
    const before = current.windows[0].getBounds();
    current.screen.getCursorScreenPoint.mockReturnValue({ x: before.x + 80, y: before.y + 100 });
    await current.invoke('nuanban:pet:drag', 'start');
    current.screen.getCursorScreenPoint.mockReturnValue({ x: -5000, y: -5000 });
    await current.invoke('nuanban:pet:drag', 'move');
    expect(current.windows[0].getBounds()).toMatchObject({ x: -800, y: 0 });
    current.screen.getCursorScreenPoint.mockReturnValue({ x: 5000, y: 5000 });
    await current.invoke('nuanban:pet:drag', 'move');
    expect(current.windows[0].getBounds()).toMatchObject({ x: -300, y: 230 });
  });

  it('跨屏使用系统 DIP 坐标，较小屏幕会收紧窗口以免移出可见区域', async () => {
    const current = fixture();
    await current.host.initialize();
    const before = current.windows[0].getBounds();
    current.screen.getCursorScreenPoint.mockReturnValue({ x: before.x + 80, y: before.y + 100 });
    await current.invoke('nuanban:pet:drag', 'start');
    const point = { x: 200, y: 100 };
    current.screen.getCursorScreenPoint.mockReturnValue(point);
    current.screen.getDisplayNearestPoint.mockReturnValue({ id: 2, scaleFactor: 1.5, bounds: { x: 0, y: 0, width: 220, height: 340 }, workArea: { x: 0, y: 0, width: 220, height: 300 } });
    await current.invoke('nuanban:pet:drag', 'move');
    expect(current.screen.getDisplayNearestPoint).toHaveBeenCalledWith(point);
    expect(current.windows[0].getBounds()).toEqual({ x: 0, y: 0, width: 220, height: 300 });
  });

  it.each(['blur', 'hide', 'render-process-gone'])('%s 后不接受迟到的移动', async eventName => {
    const current = fixture();
    await current.host.initialize();
    const before = current.windows[0].getBounds();
    current.screen.getCursorScreenPoint.mockReturnValue({ x: before.x + 80, y: before.y + 100 });
    await current.invoke('nuanban:pet:drag', 'start');
    if (eventName === 'render-process-gone') current.windows[0].webContents.emit(eventName);
    else current.windows[0].emit(eventName);
    await Promise.resolve();
    const afterEvent = current.windows[0].getBounds();
    current.screen.getCursorScreenPoint.mockReturnValue({ x: -700, y: 10 });
    expect(await current.invoke('nuanban:pet:drag', 'move')).toBe(false);
    expect(current.windows[0].getBounds()).toEqual(afterEvent);
  });

  it('未开始、鼠标不在桌宠内或已隐藏时不能移动，拒绝不可信调用和任意坐标', async () => {
    const current = fixture();
    await current.host.initialize();
    const before = current.windows[0].getBounds();
    expect(await current.invoke('nuanban:pet:drag', 'move')).toBe(false);
    expect(await current.invoke('nuanban:pet:drag', 'start')).toBe(false);
    for (const action of ['resize', { x: 5000, y: 5000 }, null]) expect(() => current.invoke('nuanban:pet:drag', action)).toThrow();
    const guide = current.windows[1];
    expect(() => current.invoke('nuanban:pet:drag', 'start', { sender: guide.webContents, senderFrame: guide.webContents.mainFrame })).toThrow('不可信');
    current.windows[0].hide();
    expect(await current.invoke('nuanban:pet:drag', 'start')).toBe(false);
    expect(current.windows[0].getBounds()).toEqual(before);
  });
});

describe('独立桌宠面对面气泡接线（合成语音，不打开真实麦克风）', () => {
  it('入口收起小屋并扩展气泡空间，状态与字幕只进入桌宠', async () => {
    const current = faceVoiceFixture();
    await current.host.initialize();
    current.host.showPetPanel({ section: 'features' });
    expect(current.windows[0].bounds.width).toBe(400);
    await current.invoke('nuanban:pet:command', { type: 'voice.open' });
    expect(current.createVoiceHost).toHaveBeenCalledWith(expect.objectContaining({ presentation: 'pet' }));
    expect(current.voice.open).toHaveBeenCalledOnce();
    expect(current.windows).toHaveLength(3);
    expect(current.windows[0].bounds).toMatchObject({ width: 320, height: 500 });
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: false, focusInput: false });
    current.transcript({ role: 'user', text: '合成问题', audio: 'discard' });
    current.transcript({ role: 'assistant', text: '合成回答' });
    expect(current.host.snapshot().voice).toMatchObject({ presentation: 'pet', bubble: { user: '合成问题', assistant: '合成回答' } });
    expect(current.host.snapshot().messages).toEqual([]);
    current.host.showPetPanel({ section: 'features' });
    expect(current.windows[0].webContents.send).toHaveBeenLastCalledWith('nuanban:pet:panel', { expanded: false, focusInput: false });
    expect(current.windows[0].bounds.width).toBe(320);
    current.transcript({ role: 'user', text: '下一句' });
    current.transcript({ role: 'system', text: '不投影' });
    current.transcript({ role: 'assistant', text: 'x'.repeat(6001) });
    expect(current.host.snapshot().voice.bubble).toEqual({ user: '下一句', assistant: '' });
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.wake.dictate).not.toHaveBeenCalled();
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.showPetTool).not.toHaveBeenCalled();
  });

  it('精简控制转发给语音宿主，停止失败不撤掉气泡和结束入口', async () => {
    const current = faceVoiceFixture();
    await current.host.initialize();
    await current.invoke('nuanban:pet:command', { type: 'voice.open' });
    for (const action of ['mute', 'unmute', 'interrupt']) {
      await current.invoke('nuanban:pet:command', { type: 'voice.' + action });
      expect(current.voice.control).toHaveBeenLastCalledWith(action);
    }
    current.transcript({ role: 'assistant', text: '停止后要清除的合成回答' });
    current.voice.stop.mockResolvedValueOnce({ stopped: false, microphoneActive: true });
    await expect(current.invoke('nuanban:pet:command', { type: 'voice.stop' })).rejects.toThrow('麦克风停止尚未确认');
    expect(current.host.snapshot().voice.active).toBe(true);
    expect(current.windows[0].bounds.width).toBe(320);
    await current.invoke('nuanban:pet:command', { type: 'voice.stop' });
    current.transcript({ role: 'assistant', text: '迟到回答不能恢复气泡' });
    expect(current.host.snapshot().voice).toMatchObject({ active: false, microphoneActive: false });
    expect(current.host.snapshot().voice.bubble).toBeUndefined();
    expect(current.windows[0].bounds).toMatchObject({ width: 300, height: 390 });
  });

  it('原生右键面对面入口与功能卡片一致，不唤出新的聊天窗口', async () => {
    const current = faceVoiceFixture();
    await current.host.initialize();
    await current.invoke('nuanban:pet:context-menu');
    current.menus.at(-1)?.find(entry => entry.label === '面对面实时语音…')?.click?.();
    await vi.waitFor(() => expect(current.voice.open).toHaveBeenCalledOnce());
    expect(current.windows).toHaveLength(3);
    expect(current.host.snapshot().voice.presentation).toBe('pet');
    expect(current.windows[0].bounds.width).toBe(320);
  });
});

describe('独立桌宠单次听写接线（合成语音，不打开真实麦克风）', () => {
  it('原生确认默认取消，拒绝时不切换已有唤醒或启动任何听写', async () => {
    const current = fixture();
    await current.host.initialize();
    current.setWakeState({ state: 'listening', enabled: true, microphoneActive: true });
    expect(await current.host.requestVoiceDictation()).toEqual({ status: 'cancelled', localOnly: true });
    expect(current.wake.probe).not.toHaveBeenCalled();
    expect(current.wake.dictate).not.toHaveBeenCalled();
    expect(current.wake.disable).not.toHaveBeenCalled();
    expect(current.host.snapshot().wake.microphoneActive).toBe(true);
  });

  it('先等待旧麦克风真实停止，再直接听写；不自动提交问题或恢复唤醒', async () => {
    const current = fixture();
    await current.host.initialize();
    current.dialog.showMessageBox.mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    current.setWakeState({ state: 'listening', enabled: true, microphoneActive: true });
    let finishStop!: () => void;
    current.wake.disable.mockImplementationOnce(async () => new Promise(resolve => { finishStop = () => resolve(current.setWakeState({ state: 'disabled', enabled: false, microphoneActive: false })); }));
    const pending = current.host.requestVoiceDictation();
    await vi.waitFor(() => expect(current.wake.disable).toHaveBeenCalledOnce());
    expect(current.wake.dictate).not.toHaveBeenCalled();
    finishStop();
    expect(await pending).toMatchObject({ status: 'complete', text: '教我收藏网页', microphoneActive: false });
    expect(current.wake.dictate).toHaveBeenCalledWith({ actor: 'owner', confirmed: true, signal: expect.any(AbortSignal) });
    expect(current.wake.enable).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.host.snapshot().messages).toEqual([]);
  });

  it('关闭发起页面或取消待确认请求后，迟到的本人确认不能开启麦克风', async () => {
    const current = fixture();
    await current.host.initialize();
    let confirm!: () => void;
    current.dialog.showMessageBox.mockImplementationOnce(async () => new Promise(resolve => { confirm = () => resolve({ response: 0, checkboxChecked: false }); }));
    const controller = new AbortController();
    const pending = current.host.requestVoiceDictation({ signal: controller.signal });
    controller.abort();
    confirm();
    expect(await pending).toMatchObject({ status: 'cancelled' });
    expect(current.wake.probe).not.toHaveBeenCalled();
    expect(current.wake.dictate).not.toHaveBeenCalled();
  });

  it('锁屏或停止会使正在听写的请求失效，不能回填迟到的文本', async () => {
    const current = fixture();
    await current.host.initialize();
    current.dialog.showMessageBox.mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    current.wake.dictate.mockImplementationOnce(async ({ signal }) => new Promise(resolve => {
      current.setWakeState({ state: 'question', enabled: true, microphoneActive: true });
      signal!.addEventListener('abort', () => resolve({ status: 'complete', text: '不应回填', localOnly: true, microphoneActive: false }), { once: true });
    }));
    const pending = current.host.requestVoiceDictation();
    await vi.waitFor(() => expect(current.wake.dictate).toHaveBeenCalledOnce());
    await current.host.stop('lock');
    expect(await pending).toMatchObject({ status: 'cancelled' });
    expect(current.host.snapshot().wake.microphoneActive).toBe(false);
  });

  it('听写能力缺失如实失败，不启用云端替代', async () => {
    const current = fixture();
    await current.host.initialize();
    current.dialog.showMessageBox.mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    current.wake.probe.mockResolvedValueOnce({ status: 'complete', dictationAvailable: false });
    await expect(current.host.requestVoiceDictation()).rejects.toThrow('本机离线中文听写引擎不可用');
    expect(current.wake.dictate).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
  });

  it('桌宠听写 IPC 仅接受固定页面主框架，不接受授权参数', async () => {
    const current = fixture();
    await current.host.initialize();
    const contents = current.windows[0].webContents;
    const event = { sender: contents, senderFrame: contents.mainFrame };
    const dictate = current.handlers.get('nuanban:pet:voice:dictate')!;
    expect(() => dictate({})).toThrow('不可信');
    expect(() => dictate(event, { confirmed: true })).toThrow('本人');
    expect(await dictate(event)).toMatchObject({ status: 'cancelled' });
  });
});

describe('独立桌宠宿主接线（合成依赖，不代表外部软件或系统权限验收）', () => {
  it('本人框选后仍需单独授权，范围明确且默认不允许云端发送', async () => {
    const region = { x: 20, y: 30, width: 320, height: 200 };
    const picker = { select: vi.fn(async () => region), cancel: vi.fn(), dispose: vi.fn() };
    const current = fixture({ createRegionSelector: () => picker });
    await current.host.initialize();
    current.choose(true);
    current.dialog.showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await current.invoke('nuanban:pet:command', { type: 'observation.start' });
    await vi.waitFor(() => expect(current.source.capture).toHaveBeenCalled());
    expect(picker.select).toHaveBeenCalledWith(expect.objectContaining({ x: -800, width: 800 }));
    expect(current.dialog.showMessageBox).toHaveBeenCalledWith(current.windows[0], expect.objectContaining({ checkboxChecked: false, defaultId: 1, detail: expect.stringContaining('框外内容不进入 OCR 或云端分析') }));
    expect(current.source.capture).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'screen:1:0', region }));
    expect(current.host.snapshot().observation.sourceName).toContain('框选区域');
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
  });

  it('取消框选不显示授权对话框，也不退回整屏采集', async () => {
    const picker = { select: vi.fn(async () => null), cancel: vi.fn(), dispose: vi.fn() };
    const current = fixture({ createRegionSelector: () => picker });
    await current.host.initialize();
    current.choose(true);
    const result = await current.invoke('nuanban:pet:command', { type: 'observation.start' });
    expect(result).toMatchObject({ ok: true, status: 'cancelled' });
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(current.host.snapshot().observation.state).toBe('off');
  });

  it('本人在框选期间停止，晚到选择不能重新授权或采集', async () => {
    let choose!: (region: Bounds) => void;
    const picker = { select: vi.fn(() => new Promise<Bounds>(resolve => { choose = resolve; })), cancel: vi.fn(), dispose: vi.fn() };
    const current = fixture({ createRegionSelector: () => picker });
    await current.host.initialize();
    current.choose(true);
    const pending = current.invoke('nuanban:pet:command', { type: 'observation.start' });
    await vi.waitFor(() => expect(picker.select).toHaveBeenCalled());
    await current.host.stop('user');
    choose({ x: 20, y: 30, width: 320, height: 200 });
    await expect(pending).resolves.toMatchObject({ status: 'cancelled' });
    expect(picker.cancel).toHaveBeenCalled();
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('功能页全部工具路径由主进程白名单承接，不走客户端、不启动观察或语音', async () => {
    const current = fixture();
    await current.host.initialize();
    const markup = readFileSync(new URL('../../apps/desktop/pet.html', import.meta.url), 'utf8');
    const routes = [...markup.matchAll(/data-tool="([^"]+)"/g)].map(match => match[1]);
    expect(routes).toHaveLength(10);
    for (const route of routes) expect(await current.invoke('nuanban:pet:open-tool', route)).toBe(true);
    expect(current.showPetTool.mock.calls).toHaveLength(routes.length);
    for (const [route, section] of [['/notes', 'archive'], ['/todos', 'todos']]) {
      expect(await current.invoke('nuanban:pet:open-tool', route)).toBe(true);
      expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: true, focusInput: false, section });
    }
    expect(current.showPetTool.mock.calls).toHaveLength(routes.length);
    for (const route of ['/', '/not-a-tool', '/notes/private', '/settings?capture=1', 'https://example.com']) expect(() => current.invoke('nuanban:pet:open-tool', route)).toThrow();
    expect(() => current.invoke('nuanban:pet:open-tool', '/notes', { sender: current.windows[1].webContents, senderFrame: current.windows[1].webContents.mainFrame })).toThrow();
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
  });

  it('右键菜单直接回到功能首页或光标教学，普通工具进入桌宠工作区', async () => {
    const current = fixture();
    await current.host.initialize();
    await current.invoke('nuanban:pet:context-menu');
    const entries = current.menus.at(-1)!;
    entries.find(entry => entry.label === '桌宠全部功能')!.click?.();
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: true, focusInput: false, section: 'features' });
    entries.find(entry => entry.label === '光标指引 · 教我操作')!.click?.();
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: true, focusInput: false, section: 'guidance' });
    for (const [label, section] of [['学习档案', 'archive'], ['待办与复习', 'todos']]) {
      entries.find(entry => entry.label === label)!.click?.();
      expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: true, focusInput: false, section });
    }
    expect(current.showPetTool).not.toHaveBeenCalled();
    entries.find(entry => entry.label === '画一画')!.click?.();
    for (let count = 0; count < 8; count += 1) await Promise.resolve();
    expect(current.showPetTool).toHaveBeenCalledWith('/pets/draw');
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.source.capture).not.toHaveBeenCalled();
  });

  it('只启动安全桌宠和只读浮层，管理窗口、屏幕、麦克风和云分析默认关闭', async () => {
    const current = fixture();
    await current.host.initialize();
    expect(current.windows).toHaveLength(3);
    for (const window of current.windows) {
      expect(window.protection).toBe(true);
      expect(window.settings.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true });
    }
    expect(current.windows.slice(1).every(window => window.ignoresMouse)).toBe(true);
    expect(current.windows.map(window => window.visible)).toEqual([true, false, false]);
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.host.snapshot().observation.state).toBe('off');
    expect(current.host.snapshot().wake.state).not.toBe('listening');
    expect(current.wake.probe).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
  });

  it('采集开始前同步通知客户端恢复保护，确认停止后才允许兼容显示', async () => {
    const onObservationState = vi.fn();
    const current = fixture({ onObservationState });
    await current.host.initialize();
    expect(onObservationState).toHaveBeenLastCalledWith(expect.objectContaining({ captureActive: false }));
    const originalCapture = current.source.capture.getMockImplementation()!;
    current.source.capture.mockImplementation(async (...argumentsList: Parameters<typeof originalCapture>) => {
      expect(onObservationState).toHaveBeenLastCalledWith(expect.objectContaining({ captureActive: true }));
      return originalCapture(...argumentsList);
    });
    current.choose();
    current.dialog.showMessageBox.mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    await current.invoke('nuanban:pet:command', { type: 'observation.start' });
    await vi.waitFor(() => expect(current.source.capture).toHaveBeenCalled());
    await current.host.stop('user');
    expect(onObservationState).toHaveBeenLastCalledWith(expect.objectContaining({ captureActive: false }));
  });

  it('桌宠兼容显示不影响字幕和指引保护，开启观察前恢复、停止后解除桌宠保护', async () => {
    const current = fixture({ petDisplayCompatible: true });
    await current.host.initialize();
    expect(current.windows.map(window => window.protection)).toEqual([false, true, true]);
    const originalCapture = current.source.capture.getMockImplementation()!;
    current.source.capture.mockImplementation(async (...argumentsList: Parameters<typeof originalCapture>) => {
      expect(current.windows.map(window => window.protection)).toEqual([true, true, true]);
      return originalCapture(...argumentsList);
    });
    current.choose();
    current.dialog.showMessageBox.mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    await current.invoke('nuanban:pet:command', { type: 'observation.start' });
    await vi.waitFor(() => expect(current.source.capture).toHaveBeenCalled());
    current.host.setPetDisplayCompatibility(true);
    expect(current.windows[0].protection).toBe(true);
    current.source.stop.mockRejectedValueOnce(new Error('synthetic stop failure'));
    expect(await current.host.stop('user')).toMatchObject({ stopped: false });
    expect(current.windows[0].protection).toBe(true);
    expect(await current.host.stop('user')).toMatchObject({ stopped: true });
    expect(current.windows.map(window => window.protection)).toEqual([false, true, true]);
  });

  it('右键独立切换远程录屏兼容，第二次启动可启用，不开启观察或麦克风', async () => {
    const current = fixture();
    await current.host.initialize();
    await current.invoke('nuanban:pet:context-menu');
    const entry = current.menus.at(-1)!.find(item => item.label === '远程与录屏可见（观察期间暂停）')!;
    expect(entry).toMatchObject({ type: 'checkbox', checked: false });
    entry.click!();
    expect(current.windows.map(window => window.protection)).toEqual([false, true, true]);
    await current.invoke('nuanban:pet:context-menu');
    const enabled = current.menus.at(-1)!.find(item => item.label === entry.label)!;
    expect(enabled.checked).toBe(true);
    enabled.click!();
    expect(current.windows[0].protection).toBe(true);
    current.host.setPetDisplayCompatibility(true);
    expect(current.windows.map(window => window.protection)).toEqual([false, true, true]);
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
  });

  it('恢复隐藏和最小化的桌宠，重复打开复用窗口，不开启观察或语音', async () => {
    const current = fixture();
    await current.host.initialize();
    const pet = current.windows[0];
    pet.hide();
    pet.minimized = true;
    await current.host.showPetPanel();
    await current.host.showPetPanel();
    expect(pet.restore).toHaveBeenCalledOnce();
    expect(pet.visible).toBe(true);
    expect(current.windows).toHaveLength(3);
    expect(current.source.listSources).not.toHaveBeenCalled();
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
  });

  it('客户端仍开时关闭桌宠先停止观察和语音，再隐藏；可重新显示且不恢复采集', async () => {
    const current = fixture();
    current.options.hasManagementWindow.mockReturnValue(true);
    await current.host.initialize();
    current.setWakeState({ state: 'listening', enabled: true, microphoneActive: true });
    await expect(current.invoke('nuanban:pet:close')).resolves.toBe(true);
    expect(current.windows[0].visible).toBe(false);
    expect(current.options.onExit).not.toHaveBeenCalled();
    expect(current.host.snapshot().wake.microphoneActive).toBe(false);
    expect(current.host.snapshot().observation.captureActive).toBe(false);
    expect(current.learning.close).not.toHaveBeenCalled();
    await current.host.showPetPanel();
    expect(current.windows[0].visible).toBe(true);
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
  });

  it('关闭清理尚未结束时重新打开，会等待清理后显示，不被迟到的关闭再次隐藏', async () => {
    const current = fixture();
    current.options.hasManagementWindow.mockReturnValue(true);
    await current.host.initialize();
    current.setWakeState({ state: 'listening', enabled: true, microphoneActive: true });
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    current.wake.disable.mockImplementationOnce(async () => {
      await waiting;
      return current.setWakeState({ state: 'disabled', enabled: false, microphoneActive: false });
    });
    const closing = current.invoke('nuanban:pet:close');
    await vi.waitFor(() => expect(current.wake.disable).toHaveBeenCalled());
    const opening = current.host.showPetPanel();
    expect(current.windows[0].visible).toBe(true);
    release();
    await closing;
    await opening;
    expect(current.windows[0].visible).toBe(true);
    expect(current.host.snapshot().wake.microphoneActive).toBe(false);
  });

  it('实际采集停止未确认时拒绝关闭，不隐藏窗口或假报成功', async () => {
    const current = fixture();
    current.options.hasManagementWindow.mockReturnValue(true);
    await current.host.initialize();
    current.setWakeState({ state: 'listening', enabled: true, microphoneActive: true });
    current.wake.disable.mockImplementationOnce(async () => current.setWakeState({ state: 'failed', enabled: true, microphoneActive: true }));
    await expect(current.invoke('nuanban:pet:close')).rejects.toThrow('采集停止尚未确认');
    expect(current.windows[0].visible).toBe(true);
    expect(current.options.onExit).not.toHaveBeenCalled();
  });

  it('系统关闭桌宠窗口同样保留客户端，单独运行桌宠时仍走应用退出', async () => {
    const current = fixture();
    current.options.hasManagementWindow.mockReturnValue(true);
    await current.host.initialize();
    const preventDefault = vi.fn();
    current.windows[0].emit('close', { preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(current.windows[0].visible).toBe(false));
    expect(current.options.onExit).not.toHaveBeenCalled();
    current.options.hasManagementWindow.mockReturnValue(false);
    await current.invoke('nuanban:pet:close');
    expect(current.options.onExit).toHaveBeenCalledOnce();
  });

  it('提问在桌宠处理，无观察时不假装看到外部画面，也不打开管理窗口', async () => {
    const current = fixture();
    await current.host.initialize();
    await current.invoke('nuanban:pet:ask', { text: '请教我调大字体' });
    expect(current.host.snapshot().task.question).toBe('请教我调大字体');
    expect(current.questioner.answer).toHaveBeenCalledWith(expect.objectContaining({ question: '请教我调大字体', instructions: expect.stringContaining('没有提供当前屏幕画面') }));
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
    expect(current.showManagement).not.toHaveBeenCalled();
  });

  it('拒绝其他 renderer、iframe 及伪造 owner 字段', async () => {
    const current = fixture();
    await current.host.initialize();
    expect(() => current.invoke('nuanban:pet:command', { type: 'observation.stop' }, { sender: current.windows[1].webContents, senderFrame: current.windows[1].webContents.mainFrame })).toThrow('不可信');
    expect(() => current.invoke('nuanban:pet:command', { type: 'observation.stop' }, { sender: current.windows[0].webContents, senderFrame: { ...current.windows[0].webContents.mainFrame } })).toThrow('不可信');
    await expect(current.invoke('nuanban:pet:command', { type: 'learning.set-mastery', noteId: 'note-local', mastered: true, actor: 'helper' })).rejects.toThrow('不允许');
  });

  it('学习记录归一化且掌握状态只由受信本人命令更新', async () => {
    const current = fixture();
    await current.host.initialize();
    expect(current.host.snapshot().learning).toMatchObject({ note: { id: 'note-local', mastery: 'unmastered' }, proposal: { id: 'proposal-local' } });
    await current.invoke('nuanban:pet:command', { type: 'learning.set-mastery', noteId: 'note-local', mastered: true });
    expect(current.learning.confirmMastery).toHaveBeenCalledWith({ actor: 'owner', noteId: 'note-local', mastered: true });
  });

  it('复习本人确认后先持久化调度，再确认 outbox；不伪造 delivered', async () => {
    const current = fixture();
    await current.host.initialize();
    current.learning.pendingReminders.mockReturnValue([current.item]);
    await current.invoke('nuanban:pet:command', { type: 'learning.review.confirm', proposalId: 'proposal-local' });
    expect(current.learning.confirmReview).toHaveBeenCalledWith({ actor: 'owner', proposalId: 'proposal-local' });
    expect(current.reminderStore.schedule).toHaveBeenCalledWith(current.item);
    expect(current.learning.markReminderScheduled).toHaveBeenCalledWith('review-local');
    expect(current.reminderStore.schedule.mock.invocationCallOrder[0]).toBeLessThan(current.learning.markReminderScheduled.mock.invocationCallOrder[0]);
  });

  it('跨库失败保留 outbox，显示未调度而不确认成功', async () => {
    const current = fixture();
    await current.host.initialize();
    current.learning.pendingReminders.mockReturnValue([current.item]);
    current.reminderStore.schedule.mockImplementation(() => { throw new Error('synthetic-disk-error'); });
    await current.invoke('nuanban:pet:command', { type: 'learning.review.confirm', proposalId: 'proposal-local' });
    expect(current.learning.markReminderScheduled).not.toHaveBeenCalled();
    expect(current.host.snapshot().learningError).toContain('调度未完成');
  });

  it('原生菜单直接打开桌宠学习区，面板尺寸钳制到当前工作区', async () => {
    const current = fixture();
    await current.host.initialize();
    current.invoke('nuanban:pet:context-menu');
    current.menus.at(-1)?.find(item => item.label === '学习笔记与复习')?.click?.();
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: true, focusInput: false, section: 'learning' });
    expect(current.windows[0].bounds).toMatchObject({ width: 400, height: 596 });
    expect(current.windows[0].bounds.y).toBeGreaterThanOrEqual(12);
  });

  it('原生搜索入口明确进入搜索功能页，不额外开启观察或麦克风', async () => {
    const current = fixture();
    await current.host.initialize();
    const petWindow = current.windows[0];
    await current.handlers.get('nuanban:pet-search:show')!({ sender: petWindow.webContents, senderFrame: petWindow.webContents.mainFrame });
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: true, focusInput: false, section: 'search' });
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet-search:opened');
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
    expect(current.wake.dictate).not.toHaveBeenCalled();
    expect(current.showManagement).not.toHaveBeenCalled();
  });

  it('智能查询直接复用教学模型，不读取 AnySearch 密钥或开启屏幕和麦克风', async () => {
    const provider = { status: () => ({ available: true }), answer: vi.fn(async () => ({ text: '合成查询回答' })) };
    const current = fixture({ questioner: provider });
    await current.host.initialize();
    const petWindow = current.windows[0];
    const event = { sender: petWindow.webContents, senderFrame: petWindow.webContents.mainFrame };
    expect(current.handlers.get('nuanban:pet-search:status')!(event)).toEqual({ provider: 'ConfiguredModel', configured: true });
    expect(provider.answer).not.toHaveBeenCalled();
    await expect(current.handlers.get('nuanban:pet-search:run')!(event, { query: '怎样保存文件', consent: true })).resolves.toMatchObject({
      ok: true, kind: 'model-answer', answer: '合成查询回答', webSearch: false, results: [],
    });
    expect(provider.answer).toHaveBeenCalledOnce();
    expect(current.host.snapshot().observation.captureActive).toBe(false);
    expect(current.host.snapshot().wake.microphoneActive).toBe(false);
    expect(current.showManagement).not.toHaveBeenCalled();
  });

  it('取消原生用途确认不会采集，云端同意默认不勾选', async () => {
    const current = fixture();
    await current.host.initialize();
    current.choose();
    await current.invoke('nuanban:pet:command', { type: 'observation.start' });
    expect(current.dialog.showMessageBox).toHaveBeenCalledWith(current.windows[0], expect.objectContaining({ defaultId: 1, checkboxChecked: false }));
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.host.snapshot().observation.state).toBe('off');
  });

  it('仅本地观察不会分析上传，锁屏和拓扑变化均真实停止', async () => {
    const current = fixture();
    await current.host.initialize();
    current.choose();
    current.dialog.showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await current.invoke('nuanban:pet:command', { type: 'observation.start' });
    await vi.waitFor(() => expect(current.source.detect).toHaveBeenCalled());
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
    current.powerMonitor.emit('lock-screen');
    await vi.waitFor(() => expect(current.host.snapshot().observation.state).toBe('stopped'));
    expect(current.source.stop).toHaveBeenCalled();
    expect(current.windows[1].visible).toBe(false);
  });

  it('退出后移除全部受信 IPC、定时器和仓储连接', async () => {
    const current = fixture();
    await current.host.initialize();
    const result = await current.host.dispose('test');
    expect(result).toMatchObject({ stopped: true, captureActive: false, mediaActive: false });
    expect(current.handlers.size).toBe(0);
    expect(current.learning.close).toHaveBeenCalledTimes(1);
  });

  it('取消单独语音确认既不探测也不启麦，确认后才使用本地引擎', async () => {
    const current = fixture();
    await current.host.initialize();
    await current.invoke('nuanban:pet:command', { type: 'wake.enable' });
    expect(current.wake.probe).not.toHaveBeenCalled();
    expect(current.wake.enable).not.toHaveBeenCalled();
    current.dialog.showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await current.invoke('nuanban:pet:command', { type: 'wake.enable' });
    expect(current.wake.probe).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(current.wake.enable).toHaveBeenCalledWith({ actor: 'owner', confirmed: true, signal: expect.any(AbortSignal) });
    expect(current.host.snapshot().wake).toMatchObject({ state: 'enabled', microphoneActive: true, localOnly: true });
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
  });

  it('本地唤醒只展开桌宠，本地问题在桌宠处理而非打开管理页面', async () => {
    const current = fixture();
    await current.host.initialize();
    current.dialog.showMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false });
    await current.invoke('nuanban:pet:command', { type: 'wake.enable' });
    current.wakeUp();
    expect(current.windows[0].webContents.send).toHaveBeenCalledWith('nuanban:pet:panel', { expanded: true, focusInput: true });
    current.question('请教我调大字体');
    await vi.waitFor(() => expect(current.host.snapshot().task.question).toBe('请教我调大字体'));
    expect(current.showManagement).not.toHaveBeenCalled();
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
    await current.invoke('nuanban:pet:command', { type: 'wake.disable' });
    current.question('迟到的问题不能提交');
    expect(current.host.snapshot().task.question).toBe('请教我调大字体');
  });

  it('锁屏让迟到的语音同意失效，不会在锁屏后重新启麦', async () => {
    const current = fixture();
    await current.host.initialize();
    let confirm!: (value: { response: number; checkboxChecked: boolean }) => void;
    current.dialog.showMessageBox.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    const enabling = current.invoke('nuanban:pet:command', { type: 'wake.enable' });
    current.powerMonitor.emit('lock-screen');
    await vi.waitFor(() => expect(current.wake.disable).toHaveBeenCalled());
    confirm({ response: 0, checkboxChecked: false });
    await enabling;
    expect(current.wake.enable).not.toHaveBeenCalled();
    expect(current.wake.probe).not.toHaveBeenCalled();
  });

  it('停止让迟到的屏幕用途确认失效，不会重新开启采集', async () => {
    const current = fixture();
    await current.host.initialize();
    current.choose();
    let confirm!: (value: { response: number; checkboxChecked: boolean }) => void;
    current.dialog.showMessageBox.mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
    const observing = current.invoke('nuanban:pet:command', { type: 'observation.start' });
    await vi.waitFor(() => expect(current.dialog.showMessageBox).toHaveBeenCalled());
    await current.invoke('nuanban:pet:command', { type: 'observation.stop' });
    confirm({ response: 0, checkboxChecked: true });
    await observing;
    expect(current.source.capture).not.toHaveBeenCalled();
    expect(current.host.snapshot().observation.state).toBe('stopped');
    expect(current.analyzer.analyze).not.toHaveBeenCalled();
  });

  it('等待麦克风真实清理后才确认退出，不先关闭加密仓储', async () => {
    const current = fixture();
    await current.host.initialize();
    current.setWakeState({ state: 'listening', enabled: true, microphoneActive: true });
    let release!: () => void;
    current.wake.disable.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return current.setWakeState({ state: 'disabled', enabled: false, microphoneActive: false });
    });
    const quitting = current.host.dispose('test');
    await vi.waitFor(() => expect(current.wake.disable).toHaveBeenCalled());
    expect(current.host.snapshot().wake.microphoneActive).toBe(true);
    expect(current.learning.close).not.toHaveBeenCalled();
    release();
    expect(await quitting).toMatchObject({ stopped: true, captureActive: false, mediaActive: false, microphoneActive: false });
    expect(current.learning.close).toHaveBeenCalled();
  });
});
