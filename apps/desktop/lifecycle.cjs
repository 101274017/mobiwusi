const stopReasons = new Set(['user', 'permission-revoked', 'lock', 'process-terminated', 'overlay-contamination', 'window-moved', 'recursive-capture', 'renderer-gone']);

function isConfirmedStopResult(result) {
  return Boolean(result && typeof result === 'object' && !Array.isArray(result)
    && result.stopped === true
    && result.captureActive === false
    && (result.mediaActive === undefined || result.mediaActive === false));
}

function createLifecycleController(stop) {
  if (typeof stop !== 'function') throw new TypeError('生命周期停止函数不完整');
  let stopPromise = null;
  let lastReason = null;
  let state = 'idle';
  function requestStop(reason = 'user') {
    if (!stopPromise && !stopReasons.has(reason)) throw new TypeError('生命周期停止原因无效');
    if (!stopPromise) {
      lastReason = reason;
      state = 'stopping';
      stopPromise = Promise.resolve()
        .then(() => stop(reason))
        .then(result => {
          if (!isConfirmedStopResult(result)) {
            state = 'cleanup_failed';
            throw new Error('生命周期停止未确认捕获和媒体均已停止');
          }
          state = 'stopped';
          return result;
        }, error => {
          state = 'cleanup_failed';
          throw error;
        });
    }
    return stopPromise;
  }
  return {
    requestStop,
    snapshot() { return { state, lastReason }; },
  };
}

module.exports = { createLifecycleController };
