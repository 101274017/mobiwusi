const { isRestrictedText } = require('./observation-policy.cjs');
const { ProviderFailure } = require('./ai-provider.cjs');
const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const codes = new Set(['INVALID_REQUEST', 'RISK_PAUSED', 'AUTH_FAILED', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'STREAM_INTERRUPTED', 'TIMEOUT', 'CANCELLED']);

function registerManagementTextQuestionBridge({ ipcMain, isTrusted, provider }) {
  const active = new Map();
  const channels = [];
  const stop = () => { for (const operation of active.values()) operation.controller.abort(); };
  function handle(action, handler) {
    const channel = `nuanban:text-question:${action}`;
    channels.push(channel);
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrusted(event)) throw new Error('Untrusted text question source');
      return handler(event, args);
    });
  }
  handle('status', (_event, args) => {
    if (args.length) throw new ProviderFailure('INVALID_REQUEST');
    try { return { available: provider?.status()?.available === true }; }
    catch { return { available: false }; }
  });
  handle('cancel', (event, args) => {
    if (args.length !== 1 || typeof args[0] !== 'string' || !requestIdPattern.test(args[0])) throw new ProviderFailure('INVALID_REQUEST');
    const operation = active.get(event.sender);
    if (operation?.requestId !== args[0]) return false;
    operation.controller.abort();
    return true;
  });
  handle('answer', async (event, args) => {
    const input = args[0];
    const requestId = typeof input?.requestId === 'string' && requestIdPattern.test(input.requestId) ? input.requestId : '';
    const failed = (code, retryable = false) => ({ ok: false, requestId, code, retryable });
    if (args.length !== 1 || !requestId || active.has(event.sender) || typeof input.question !== 'string' || !input.question.trim() || input.question.length > 1500) return failed('INVALID_REQUEST');
    if (isRestrictedText(input.question)) return failed('RISK_PAUSED');
    if (!provider) return failed('PROVIDER_UNAVAILABLE');
    const operation = { requestId, controller: new AbortController() };
    active.set(event.sender, operation);
    const abort = () => operation.controller.abort();
    let rejectCancellation;
    const cancellation = new Promise((_resolve, reject) => { rejectCancellation = () => reject(new ProviderFailure('CANCELLED')); });
    operation.controller.signal.addEventListener('abort', rejectCancellation, { once: true });
    for (const name of ['destroyed', 'render-process-gone', 'did-start-navigation']) event.sender.once(name, abort);
    try {
      const result = await Promise.race([provider.answer({ question: input.question.trim(), signal: operation.controller.signal }), cancellation]);
      if (operation.controller.signal.aborted || !isTrusted(event)) return failed('CANCELLED');
      if (!result || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 24000) return failed('PROVIDER_UNAVAILABLE', true);
      return { ok: true, requestId, text: result.text.trim() };
    } catch (error) {
      if (operation.controller.signal.aborted) return failed('CANCELLED');
      return error instanceof ProviderFailure && codes.has(error.code) ? failed(error.code, error.retryable) : failed('PROVIDER_UNAVAILABLE', true);
    } finally {
      if (active.get(event.sender) === operation) active.delete(event.sender);
      operation.controller.signal.removeEventListener('abort', rejectCancellation);
      for (const name of ['destroyed', 'render-process-gone', 'did-start-navigation']) event.sender.removeListener(name, abort);
    }
  });
  return { stop, dispose() { stop(); for (const channel of channels.splice(0)) ipcMain.removeHandler(channel); } };
}

module.exports = { registerManagementTextQuestionBridge };
