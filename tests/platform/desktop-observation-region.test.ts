import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createObservationRegionSelector } = createRequire(import.meta.url)('../../apps/desktop/observation/region-selector.cjs');
const selectors: { dispose(): void }[] = [];
const display = { x: -800, y: -200, width: 800, height: 600 };
const region = { x: 20, y: 30, width: 320, height: 200 };
const channel = 'nuanban:observation-region:select';
type Bounds = typeof display;

function fixture(placement: { initialBounds?: Bounds; actualBounds?: Bounds } = {}) {
  const ipcMain = new EventEmitter();
  const windows: FakeWindow[] = [];
  let completeLoad: (() => void) | undefined;
  let delayLoad = false;
  class FakeWindow extends EventEmitter {
    destroyed = false;
    webContents = Object.assign(new EventEmitter(), { mainFrame: { url: '' }, setWindowOpenHandler: vi.fn() });
    setContentProtection = vi.fn();
    show = vi.fn();
    focus = vi.fn();
    constructor(public settings: Record<string, unknown>) { super(); Object.assign(settings, placement.initialBounds); windows.push(this); }
    setBounds = vi.fn((bounds: Bounds) => { Object.assign(this.settings, bounds, placement.actualBounds); });
    isDestroyed() { return this.destroyed; }
    getBounds() { return { x: this.settings.x, y: this.settings.y, width: this.settings.width, height: this.settings.height }; }
    getContentBounds() { return this.getBounds(); }
    destroy() { this.destroyed = true; this.emit('closed'); }
    async loadFile(file: string, options?: { query: Record<string, string> }) {
      const url = pathToFileURL(file);
      if (options?.query) url.search = new URLSearchParams(options.query).toString();
      this.webContents.mainFrame.url = url.href;
      if (delayLoad) await new Promise<void>(resolve => { completeLoad = resolve; });
    }
  }
  const selector = createObservationRegionSelector({ BrowserWindow: FakeWindow, ipcMain });
  selectors.push(selector);
  const event = () => ({ sender: windows[0].webContents, senderFrame: windows[0].webContents.mainFrame });
  return { selector, windows, ipcMain, event, choose: (payload: unknown, sender = event()) => ipcMain.emit(channel, sender, payload),
    delayLoad: () => { delayLoad = true; }, finishLoad: () => completeLoad?.() };
}

afterEach(() => { for (const selector of selectors.splice(0)) selector.dispose(); });

describe('本人框选区域，只读遮罩、不采集桌面', () => {
  it('构造不创建窗口、不监听 IPC；只有显式选择才打开受保护遮罩', async () => {
    const setup = fixture();
    expect(setup.windows).toHaveLength(0);
    expect(setup.ipcMain.listenerCount(channel)).toBe(0);
    const selection = setup.selector.select(display);
    await Promise.resolve();
    expect(setup.windows).toHaveLength(1);
    expect(setup.windows[0].settings).toMatchObject({ ...display, transparent: true, frame: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    expect(setup.windows[0].setContentProtection).toHaveBeenCalledWith(true);
    setup.choose(region);
    await expect(selection).resolves.toEqual(region);
    expect(setup.windows[0].destroyed).toBe(true);
    expect(setup.ipcMain.listenerCount(channel)).toBe(0);
  });

  it.each(['sender', 'subframe', 'url'])('拒绝其他窗口、子框架或页面提交：%s', async type => {
    const setup = fixture();
    const selection = setup.selector.select(display);
    const event = setup.event();
    if (type === 'sender') event.sender = { ...event.sender };
    if (type === 'subframe') event.senderFrame = { ...event.senderFrame };
    if (type === 'url') event.senderFrame.url = 'https://invalid.example/';
    setup.choose(region, event);
    expect(setup.windows[0].destroyed).toBe(false);
    setup.selector.cancel();
    await expect(selection).resolves.toBeNull();
  });

  it.each([
    { x: -1, y: 20, width: 100, height: 100 },
    { x: 750, y: 20, width: 100, height: 100 },
    { x: 20, y: 20, width: 31, height: 100 },
    { x: 20.5, y: 20, width: 100, height: 100 },
    { x: 20, y: 20, width: 100, height: 100, sourceId: 'other' },
  ])('无效或扩大范围的坐标不能成为授权：%j', async selection => {
    const setup = fixture();
    const result = setup.selector.select(display);
    setup.choose(selection);
    await expect(result).rejects.toMatchObject({ code: 'capture_region_invalid' });
    expect(setup.windows[0].destroyed).toBe(true);
    expect(setup.ipcMain.listenerCount(channel)).toBe(0);
  });

  it('遮罩位置或尺寸与选定显示器不一致时拒绝映射', async () => {
    const setup = fixture();
    const result = setup.selector.select(display);
    setup.windows[0].settings.width = 799;
    setup.choose(region);
    await expect(result).rejects.toMatchObject({ code: 'capture_region_invalid' });
  });

  it('150% 缩放下重新定位被任务栏压缩的遮罩，并限制为所选显示器范围', async () => {
    const expected = { x: 0, y: 0, width: 1707, height: 1067 };
    const actual = { x: 0, y: 0, width: 1708, height: 1068 };
    const setup = fixture({ initialBounds: { ...actual, height: 1020 }, actualBounds: actual });
    const result = setup.selector.select({ ...expected, scaleFactor: 1.5 });
    await Promise.resolve();
    expect(setup.windows[0].setBounds).toHaveBeenCalledExactlyOnceWith(expected);
    expect(new URL(setup.windows[0].webContents.mainFrame.url).searchParams.get('width')).toBe('1707');
    expect(new URL(setup.windows[0].webContents.mainFrame.url).searchParams.get('height')).toBe('1067');
    const edge = { x: 1607, y: 967, width: 100, height: 100 };
    setup.choose(edge);
    await expect(result).resolves.toEqual(edge);
  });

  it.each([
    { x: 1608, y: 967, width: 100, height: 100 },
    { x: 1607, y: 968, width: 100, height: 100 },
  ])('系统取整产生的框外像素不能扩大本人授权：%j', async payload => {
    const setup = fixture({ actualBounds: { x: 0, y: 0, width: 1708, height: 1068 } });
    const result = setup.selector.select({ x: 0, y: 0, width: 1707, height: 1067 });
    setup.choose(payload);
    await expect(result).rejects.toMatchObject({ code: 'capture_region_invalid' });
  });

  it('负原点显示器按实际内容区偏移映射，而不是假定与请求的窗口边界相同', async () => {
    const setup = fixture({ actualBounds: { x: -801, y: -201, width: 801, height: 601 } });
    const result = setup.selector.select(display);
    await Promise.resolve();
    const query = new URL(setup.windows[0].webContents.mainFrame.url).searchParams;
    expect(Object.fromEntries(query)).toEqual({ x: '1', y: '1', width: '800', height: '600' });
    setup.choose({ ...region, x: region.x + 1, y: region.y + 1 });
    await expect(result).resolves.toEqual(region);
  });

  it('授权只覆盖实际内容区与所选显示器的交集', async () => {
    const setup = fixture({ actualBounds: { ...display, x: -790, y: -180, width: 780, height: 560 } });
    const result = setup.selector.select(display);
    setup.choose(region);
    await expect(result).resolves.toEqual({ ...region, x: 30, y: 50 });
  });

  it('窗口初始尺寸无法与所选屏幕形成可选区域时直接拒绝', async () => {
    const setup = fixture({ actualBounds: { ...display, x: 100, y: 100 } });
    await expect(setup.selector.select(display)).rejects.toMatchObject({ code: 'capture_region_invalid' });
    expect(setup.windows[0].show).not.toHaveBeenCalled();
    expect(setup.windows[0].destroyed).toBe(true);
  });

  it('选择开始后调用方改变几何数据不能扩大屏幕授权', async () => {
    const expected = { ...display };
    const setup = fixture({ actualBounds: { ...display, width: 801 } });
    const result = setup.selector.select(expected);
    expected.width = 900;
    setup.choose({ x: 701, y: 30, width: 100, height: 100 });
    await expect(result).rejects.toMatchObject({ code: 'capture_region_invalid' });
  });

  it.each(['cancel', 'blur', 'closed'])('取消、失去焦点或关闭遮罩只取消选择：%s', async action => {
    const setup = fixture();
    const result = setup.selector.select(display);
    if (action === 'cancel') setup.choose(null);
    else setup.windows[0].emit(action);
    await expect(result).resolves.toBeNull();
    expect(setup.ipcMain.listenerCount(channel)).toBe(0);
  });

  it('停止发生在加载中时，晚到页面不能重新显示或授权', async () => {
    const setup = fixture();
    setup.delayLoad();
    const result = setup.selector.select(display);
    setup.selector.cancel();
    setup.finishLoad();
    await expect(result).resolves.toBeNull();
    await Promise.resolve();
    expect(setup.windows[0].show).not.toHaveBeenCalled();
  });

  it('不能同时创建第二个区域选择器', async () => {
    const setup = fixture();
    const result = setup.selector.select(display);
    await expect(setup.selector.select(display)).rejects.toMatchObject({ code: 'busy' });
    expect(setup.windows).toHaveLength(1);
    setup.selector.cancel();
    await result;
  });

  it('遮罩页面离线，不使用屏幕捕获、输入注入或网络 API', () => {
    const page = readFileSync(new URL('../../apps/desktop/observation/region-selector.html', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../../apps/desktop/observation/region-selector.js', import.meta.url), 'utf8');
    expect(page).toContain("default-src 'none'");
    expect(page).toContain("connect-src 'none'");
    expect(renderer).not.toMatch(/getDisplayMedia|getUserMedia|fetch\(|XMLHttpRequest|WebSocket|executeJavaScript/);
  });
});
