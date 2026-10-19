const states = new Set(['off', 'observing', 'privacy_paused', 'stopped', 'cleanup_failed']);

function registerManagementObservationBridge({ ipcMain, isTrusted, getHost }) {
  const channels = [];

  function hostFor(event, argumentsList) {
    if (!isTrusted(event)) throw new Error('不可信屏幕观察来源');
    if (argumentsList.length !== 0) throw new Error('屏幕范围和用途必须由本人在原生窗口选择');
    const host = getHost();
    if (!host || !host.hasPetWindow()) throw new Error('独立桌宠尚未就绪，请先启动桌宠');
    return host;
  }

  function status(host) {
    const current = host.snapshot();
    const observation = current.observation;
    if (!observation || !states.has(observation.state) || typeof observation.captureActive !== 'boolean') throw new Error('屏幕观察状态未确认');
    const state = observation.captureActive && ['off', 'stopped'].includes(observation.state) ? 'cleanup_failed' : observation.state;
    return Object.freeze({ state, captureActive: observation.captureActive,
      sourceName: typeof observation.sourceName === 'string' ? observation.sourceName.slice(0, 120) : '',
      cloudConfigured: current.capabilities?.cloudAnalysis === true });
  }

  function handle(channel, action) {
    channels.push(channel);
    ipcMain.handle(channel, (event, ...argumentsList) => action(hostFor(event, argumentsList)));
  }

  handle('nuanban:observation:status', status);
  for (const [action, resume] of [['start', false], ['resume', true]]) {
    handle(`nuanban:observation:${action}`, async host => {
      await host.showPetPanel();
      await host.requestObservation(resume);
      return status(host);
    });
  }
  handle('nuanban:observation:stop', async host => { await host.stop('user'); return status(host); });
  handle('nuanban:observation:show-pet', async host => { await host.showPetPanel(); return status(host); });

  return { dispose() { for (const channel of channels.splice(0)) ipcMain.removeHandler(channel); } };
}

module.exports = { registerManagementObservationBridge };
