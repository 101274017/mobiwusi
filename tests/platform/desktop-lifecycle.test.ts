import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createLifecycleController } = require('../../apps/desktop/lifecycle.cjs') as {
  createLifecycleController: (stop: (reason: string) => Promise<unknown>) => {
    requestStop(reason?: string): Promise<unknown>;
    snapshot(): { state: string; lastReason: string | null };
  };
};

describe('Windows 主进程生命周期控制器', () => {
  it('退出、渲染器退出和 IPC 停止共享同一停止 Promise', async () => {
    const stop = vi.fn(async (reason: string) => ({ stopped: true, captureActive: false, reason }));
    const controller = createLifecycleController(stop);
    const first = controller.requestStop('renderer-gone');
    const second = controller.requestStop('process-terminated');

    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ stopped: true, captureActive: false, reason: 'renderer-gone' });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toEqual({ state: 'stopped', lastReason: 'renderer-gone' });
  });

  it('停止回调重入时仍只执行一条清理链', async () => {
    let controller: ReturnType<typeof createLifecycleController>;
    let nested: Promise<unknown> | undefined;
    const stop = vi.fn(async () => {
      nested = controller.requestStop('process-terminated');
      return { stopped: true, captureActive: false };
    });
    controller = createLifecycleController(stop);

    const first = controller.requestStop('renderer-gone');
    await expect(first).resolves.toMatchObject({ stopped: true, captureActive: false });
    expect(nested).toBe(first);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('拒绝无效停止原因和未确认 stop-all 结果，并保持失败阻断', async () => {
    const invalidReason = createLifecycleController(async () => ({ stopped: true, captureActive: false }));
    expect(() => invalidReason.requestStop('synthetic-invalid')).toThrow('生命周期停止原因无效');

    const stop = vi.fn(async () => ({ stopped: true, captureActive: false, mediaActive: true }));
    const controller = createLifecycleController(stop);
    const first = controller.requestStop('process-terminated');
    await expect(first).rejects.toThrow('未确认捕获和媒体均已停止');
    await expect(controller.requestStop('user')).rejects.toThrow('未确认捕获和媒体均已停止');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toEqual({ state: 'cleanup_failed', lastReason: 'process-terminated' });
  });

  it('清理失败后保持失败状态，不自动重新开启停止流程', async () => {
    const stop = vi.fn(async () => { throw new Error('synthetic cleanup failure'); });
    const controller = createLifecycleController(stop);
    const first = controller.requestStop('process-terminated');

    await expect(first).rejects.toThrow('synthetic cleanup failure');
    await expect(controller.requestStop('user')).rejects.toThrow('synthetic cleanup failure');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toEqual({ state: 'cleanup_failed', lastReason: 'process-terminated' });
  });
});
