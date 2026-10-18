import { describe, expect, it, vi } from 'vitest';
import { bindLifecycleEvents, LifecycleCoordinator, type LifecycleResources } from '@nuanban/platform-ports';

function resources(order: string[], failures: Set<string> = new Set()): LifecycleResources {
  const step = (name: string) => async () => {
    order.push(name);
    if (failures.has(name)) throw new Error(`${name} failed`);
  };
  return { closeOutlets: step('close_outlets'), clearQueue: step('clear_queue'), stopTrack: step('stop_track'), hideOverlay: step('hide_overlay') };
}

describe('C09/C10 生命周期清理协调器', () => {
  it('Android 权限撤回按出口、代际、队列、轨道顺序清理', async () => {
    const calls: string[] = [];
    const coordinator = new LifecycleCoordinator('android', resources(calls));
    coordinator.start(8);
    expect(coordinator.canRelease(8)).toBe(true);
    const report = await coordinator.signal('permission-revoked');
    expect(report.order).toEqual(['close_outlets', 'invalidate_generation', 'clear_queue', 'stop_track', 'hide_overlay']);
    expect(report.reason).toBe('permission-revoked');
    expect(report.generationAfter).toBe(9);
    expect(report.failedSteps).toEqual([]);
    expect(coordinator.canRelease(8)).toBe(false);
    expect(coordinator.snapshot().state).toBe('stopped');
    expect(calls).toEqual(['close_outlets', 'clear_queue', 'stop_track', 'hide_overlay']);
  });

  it('Windows 窗口移动或递归捕获信号会停止输出并隐藏浮层', async () => {
    const calls: string[] = [];
    const coordinator = new LifecycleCoordinator('windows', resources(calls));
    coordinator.start(3);
    const report = await coordinator.signal('window-moved');
    expect(report.reason).toBe('window-moved');
    expect(report.overlayHidden).toBe(true);
    expect(coordinator.canRelease(3)).toBe(false);
    expect(coordinator.snapshot().lastStopReason).toBe('window-moved');

    const recursiveCoordinator = new LifecycleCoordinator('windows', resources([]));
    recursiveCoordinator.start(6);
    const recursiveReport = await recursiveCoordinator.signal('recursive-capture');
    expect(recursiveReport.reason).toBe('recursive-capture');
    expect(recursiveReport.generationAfter).toBe(7);
    expect(recursiveCoordinator.canRelease(6)).toBe(false);
  });

  it('重复停止共享同一清理结果，不重复调用资源端口', async () => {
    const calls: string[] = [];
    const coordinator = new LifecycleCoordinator('android', resources(calls));
    coordinator.start(1);
    const first = coordinator.stop('user');
    const second = coordinator.stop('user');
    const [firstReport, secondReport] = await Promise.all([first, second]);
    expect(firstReport).toEqual(secondReport);
    expect(calls).toHaveLength(4);
    expect(coordinator.snapshot().generation).toBe(2);
    expect(coordinator.snapshot().lastSignal).toBe('user-stop');
  });

  it('清理中的后续信号不会覆盖首个停止原因', async () => {
    const calls: string[] = [];
    let releaseClose!: () => void;
    const closeGate = new Promise<void>(resolve => { releaseClose = resolve; });
    const coordinator = new LifecycleCoordinator('windows', {
      closeOutlets: async () => { calls.push('close_outlets'); await closeGate; },
      clearQueue: async () => { calls.push('clear_queue'); },
      stopTrack: async () => { calls.push('stop_track'); },
      hideOverlay: async () => { calls.push('hide_overlay'); },
    });
    coordinator.start(1);

    const first = coordinator.signal('window-moved');
    const second = coordinator.signal('renderer-gone');
    expect(coordinator.snapshot()).toMatchObject({ state: 'stopping', outputAllowed: false, lastSignal: 'window-moved' });
    releaseClose();

    const [firstReport, secondReport] = await Promise.all([first, second]);
    expect(secondReport).toEqual(firstReport);
    expect(firstReport).toMatchObject({ signal: 'window-moved', reason: 'window-moved' });
    expect(coordinator.snapshot()).toMatchObject({ lastSignal: 'window-moved', lastStopReason: 'window-moved' });
    expect(calls).toEqual(['close_outlets', 'clear_queue', 'stop_track', 'hide_overlay']);
  });

  it('资源关闭回调重入停止时仍只执行一条清理链', async () => {
    const calls: string[] = [];
    let coordinator!: LifecycleCoordinator;
    let nested: Promise<unknown> | undefined;
    coordinator = new LifecycleCoordinator('android', {
      closeOutlets: async () => { calls.push('close_outlets'); nested = coordinator.stop('user'); },
      clearQueue: async () => { calls.push('clear_queue'); },
      stopTrack: async () => { calls.push('stop_track'); },
      hideOverlay: async () => { calls.push('hide_overlay'); },
    });
    coordinator.start(1);

    await coordinator.stop('user');
    if (!nested) throw new Error('重入停止未返回共享 Promise。');
    await expect(nested).resolves.toMatchObject({ reason: 'user', signal: 'user-stop' });
    expect(calls).toEqual(['close_outlets', 'clear_queue', 'stop_track', 'hide_overlay']);
  });

  it('拒绝无法再安全递增的最大代际', () => {
    const coordinator = new LifecycleCoordinator('android', resources([]));
    expect(() => coordinator.start(Number.MAX_SAFE_INTEGER)).toThrow('生命周期代际必须是递增的安全整数');
  });

  it('运行时拒绝不受支持的平台、伪造原因和不匹配信号', async () => {
    expect(() => new LifecycleCoordinator('ios' as never, resources([]))).toThrow('生命周期平台不受支持');
    const coordinator = new LifecycleCoordinator('android', resources([]));
    await expect(coordinator.stop('forged' as never, null)).rejects.toThrow('生命周期停止原因或信号无效');
    await expect(coordinator.stop('window-moved', 'user-stop')).rejects.toThrow('生命周期停止原因与信号不匹配');
  });

  it('停止开始即固定首个原因，并在第一步失败时继续封闭旧代际', async () => {
    const calls: string[] = [];
    const coordinator = new LifecycleCoordinator('windows', {
      closeOutlets: async () => { calls.push('close_outlets'); throw new Error('close failed'); },
      clearQueue: async () => { calls.push('clear_queue'); },
      stopTrack: async () => { calls.push('stop_track'); },
      hideOverlay: async () => { calls.push('hide_overlay'); },
    });
    coordinator.start(5);
    const stopping = coordinator.signal('window-moved');
    expect(coordinator.snapshot()).toMatchObject({ state: 'stopping', outputAllowed: false, lastSignal: 'window-moved', lastStopReason: 'window-moved' });
    const report = await stopping;
    expect(report).toMatchObject({ generationBefore: 5, generationAfter: 6, failedSteps: ['close_outlets'], restartBlocked: true });
    expect(coordinator.canRelease(5)).toBe(false);
    expect(calls).toEqual(['close_outlets', 'clear_queue', 'stop_track', 'hide_overlay']);
  });

  it('清理失败时保持停止并禁止当前进程重新开始', async () => {
    const calls: string[] = [];
    const coordinator = new LifecycleCoordinator('windows', resources(calls, new Set(['stop_track'])));
    coordinator.start(5);
    const report = await coordinator.stop('renderer-gone', 'renderer-gone');
    expect(report.restartBlocked).toBe(true);
    expect(report.failedSteps).toEqual(['stop_track']);
    expect(coordinator.snapshot().state).toBe('cleanup_failed');
    expect(() => coordinator.start(7)).toThrow('清理失败');
    expect(coordinator.canRelease(6)).toBe(false);
  });

  it('停止后的旧代际不能释放，显式更高代际开始后才恢复', async () => {
    const calls: string[] = [];
    const coordinator = new LifecycleCoordinator('android', resources(calls));
    coordinator.start(10);
    await coordinator.signal('lock');
    expect(coordinator.canRelease(10)).toBe(false);
    coordinator.start(12);
    expect(coordinator.canRelease(10)).toBe(false);
    expect(coordinator.canRelease(12)).toBe(true);
  });

  it('调用资源端口时保留资源对象的 this 绑定', async () => {
    const calls: string[] = [];
    const port: LifecycleResources & { calls: string[] } = {
      calls,
      async closeOutlets() { this.calls.push('close_outlets'); },
      async clearQueue() { this.calls.push('clear_queue'); },
      async stopTrack() { this.calls.push('stop_track'); },
      async hideOverlay() { this.calls.push('hide_overlay'); },
    };
    const coordinator = new LifecycleCoordinator('android', port);
    coordinator.start(2);
    await coordinator.stop();
    expect(calls).toEqual(['close_outlets', 'clear_queue', 'stop_track', 'hide_overlay']);
  });

  it('新建协调器默认为 idle，不因进程重启自动恢复采集', () => {
    const coordinator = new LifecycleCoordinator('android', resources([]));
    expect(coordinator.snapshot()).toMatchObject({ state: 'idle', outputAllowed: false, generation: 0 });
    expect(coordinator.canRelease(0)).toBe(false);
  });

  it('Android 宿主暂停事件装配到锁屏清理，销毁后不再响应', async () => {
    const calls: string[] = [];
    const target = new EventTarget();
    const coordinator = new LifecycleCoordinator('android', resources(calls));
    coordinator.start(4);
    const binding = bindLifecycleEvents(coordinator, target);

    target.dispatchEvent(new Event('nuanban:host-pause'));
    const cleanup = binding.lastCleanup();
    expect(cleanup).not.toBeNull();
    if (!cleanup) throw new Error('生命周期清理未启动。');
    await cleanup;
    expect(coordinator.snapshot()).toMatchObject({ state: 'stopped', lastStopReason: 'lock', generation: 5 });
    expect(calls).toEqual(['close_outlets', 'clear_queue', 'stop_track', 'hide_overlay']);

    target.dispatchEvent(new Event('nuanban:host-destroy'));
    expect(binding.lastCleanup()).toBe(cleanup);
    expect(coordinator.snapshot()).toMatchObject({ lastSignal: 'lock', lastStopReason: 'lock' });

    binding.dispose();
    target.dispatchEvent(new Event('nuanban:host-permission-revoked'));
    expect(binding.lastCleanup()).toBe(cleanup);
    expect(calls).toHaveLength(4);
  });

  it('Windows 宿主渲染器退出事件使用同一清理链，并共享并发结果', async () => {
    const calls: string[] = [];
    const target = new EventTarget();
    const coordinator = new LifecycleCoordinator('windows', resources(calls));
    coordinator.start(11);
    const binding = bindLifecycleEvents(coordinator, target);

    target.dispatchEvent(new Event('nuanban:host-renderer-gone'));
    target.dispatchEvent(new Event('nuanban:host-before-quit'));
    const cleanup = binding.lastCleanup();
    expect(cleanup).not.toBeNull();
    if (!cleanup) throw new Error('生命周期清理未启动。');
    await cleanup;
    expect(coordinator.snapshot()).toMatchObject({ state: 'stopped', lastStopReason: 'renderer-gone', generation: 12 });
    expect(calls).toHaveLength(4);
  });

  it('生命周期事件部分装配失败时回滚已经注册的监听器', () => {
    const coordinator = new LifecycleCoordinator('windows', resources([]));
    let registrations = 0;
    const target = {
      addEventListener: vi.fn((_eventName: string, _listener: EventListener) => {
        registrations += 1;
        if (registrations === 2) throw new Error('synthetic listener failure');
      }),
      removeEventListener: vi.fn(),
    };

    expect(() => bindLifecycleEvents(coordinator, target)).toThrow('synthetic listener failure');
    expect(target.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
