import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const { createManagementWindowVisibility } = createRequire(import.meta.url)('../../apps/desktop/management-window-visibility.cjs');

function fixture() {
  let destroyed = false;
  let minimized = true;
  const window = {
    isDestroyed: () => destroyed,
    isMinimized: () => minimized,
    setContentProtection: vi.fn(),
    setTitle: vi.fn(),
    setSkipTaskbar: vi.fn(),
    restore: vi.fn(() => { minimized = false; }),
    show: vi.fn(),
    moveTop: vi.fn(),
    focus: vi.fn(),
    webContents: { isDestroyed: () => destroyed, executeJavaScript: vi.fn(async () => undefined) },
  };
  return { window, destroy: () => { destroyed = true; } };
}

describe('客户端窗口唤起与按需显示兼容', () => {
  it('默认始终保护客户端，即使确认观察已关闭', () => {
    const visibility = createManagementWindowVisibility();
    const { window } = fixture();
    visibility.syncProtection(window);
    visibility.updateObservation({ captureActive: false }, window);
    expect(window.setContentProtection).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('兼容模式只在明确不采集时生效，观察和停止未确认期间恢复保护', () => {
    const visibility = createManagementWindowVisibility({ displayCompatible: true });
    const { window } = fixture();
    visibility.syncProtection(window);
    visibility.updateObservation({ state: 'off', captureActive: false }, window);
    visibility.updateObservation({ state: 'off', captureActive: false }, window);
    visibility.updateObservation({ state: 'observing', captureActive: true }, window);
    visibility.updateObservation({ state: 'stopping', captureActive: true }, window);
    visibility.updateObservation({ state: 'stopped', captureActive: false }, window);
    visibility.updateObservation(undefined, window);
    expect(window.setContentProtection.mock.calls).toEqual([[true], [false], [true], [false], [true]]);
  });

  it('第二次启动可显式开启兼容，但不能绕过正在进行的采集保护', () => {
    const visibility = createManagementWindowVisibility();
    const { window } = fixture();
    visibility.updateObservation({ captureActive: true }, window);
    visibility.enableCompatibility(window);
    expect(window.setContentProtection).toHaveBeenCalledExactlyOnceWith(true);
    visibility.updateObservation({ captureActive: false }, window);
    expect(window.setContentProtection).toHaveBeenLastCalledWith(false);
  });

  it('重建窗口沿用已确认的采集状态，忽略已销毁的窗口', () => {
    const visibility = createManagementWindowVisibility({ displayCompatible: true });
    visibility.updateObservation({ captureActive: false });
    const current = fixture();
    current.destroy();
    visibility.syncProtection(current.window);
    expect(current.window.setContentProtection).not.toHaveBeenCalled();
    const replacement = fixture();
    visibility.syncProtection(replacement.window);
    expect(replacement.window.setContentProtection).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('先恢复并前置窗口，再等待页面加载和路由，避免只剩任务栏图标', async () => {
    const visibility = createManagementWindowVisibility();
    const { window } = fixture();
    let finishLoading!: () => void;
    const ready = new Promise<void>(resolve => { finishLoading = resolve; });
    const showing = visibility.show(window, { route: '/settings', ready });
    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.setSkipTaskbar).toHaveBeenCalledExactlyOnceWith(false);
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.moveTop).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
    finishLoading();
    await expect(showing).resolves.toBe(true);
    expect(window.webContents.executeJavaScript).toHaveBeenCalledWith('window.location.hash = "/settings";', true);
    expect(window.restore.mock.invocationCallOrder[0]).toBeLessThan(window.show.mock.invocationCallOrder[0]!);
    expect(window.focus.mock.invocationCallOrder[0]).toBeLessThan(window.webContents.executeJavaScript.mock.invocationCallOrder[0]!);
  });

  it('加载期间被关闭时不执行路由，也不假报唤起成功', async () => {
    const visibility = createManagementWindowVisibility();
    const current = fixture();
    let finishLoading!: () => void;
    const ready = new Promise<void>(resolve => { finishLoading = resolve; });
    const showing = visibility.show(current.window, { ready });
    current.destroy();
    finishLoading();
    await expect(showing).rejects.toThrow('管理窗口已关闭');
    expect(current.window.webContents.executeJavaScript).not.toHaveBeenCalled();
    await expect(visibility.show(current.window)).rejects.toThrow('管理窗口未就绪');
  });
});
