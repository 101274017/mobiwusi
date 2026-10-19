const { spawn: nodeSpawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { externalScriptPath } = require('../external-script-path.cjs');

function speechError(code) { return Object.assign(new Error(code), { code }); }

function createWindowsLocalSpeech({ spawn = nodeSpawn, platform = process.platform, probeTimeoutMs = 8000, speechTimeoutMs = 90000 } = {}) {
  if (![probeTimeoutMs, speechTimeoutMs].every(value => Number.isSafeInteger(value) && value >= 100 && value <= 120000)) throw new RangeError('speech_limits_invalid');
  let active = null;

  function cancel(operation, code = 'speech_cancelled') {
    operation.failure ??= code;
    try { operation.child?.kill(); } catch {}
  }

  async function run(op, text, signal) {
    if (platform !== 'win32') throw speechError('speech_windows_unavailable');
    if (active) throw speechError('speech_busy');
    if (signal?.aborted) throw speechError('speech_cancelled');
    const operation = { token: randomUUID(), child: null, failure: null, bytes: 0, output: [], closed: false };
    operation.completion = new Promise(resolve => { operation.resolve = resolve; });
    active = operation;
    const abort = () => cancel(operation);
    const timer = setTimeout(() => cancel(operation, 'speech_timeout'), op === 'probe' ? probeTimeoutMs : speechTimeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    const closed = code => {
      if (operation.closed) return;
      operation.closed = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (code !== 0) operation.failure ??= 'speech_engine_unavailable';
      if (active === operation) active = null;
      operation.resolve();
    };
    try {
      const executable = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', externalScriptPath(path.join(__dirname, 'windows-local-speech.ps1'))], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      operation.child = child;
      child.on('close', closed);
      child.on('error', () => cancel(operation, 'speech_spawn_unavailable'));
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on('error', () => cancel(operation, 'speech_pipe_failed'));
      child.stdout.on('data', chunk => {
        operation.bytes += chunk.length;
        if (operation.bytes > 16384) cancel(operation, 'speech_output_invalid');
        else operation.output.push(Buffer.from(chunk));
      });
      child.stderr.on('data', chunk => { operation.bytes += chunk.length; if (operation.bytes > 16384) cancel(operation, 'speech_output_invalid'); });
      child.stdin.end(JSON.stringify({ token: operation.token, op, ...(op === 'speak' ? { text } : {}) }) + '\n');
      if (signal?.aborted) abort();
    } catch {
      if (operation.child) cancel(operation, 'speech_spawn_unavailable');
      else { operation.failure = 'speech_spawn_unavailable'; closed(1); }
    }
    await operation.completion;
    try {
      if (operation.failure) throw speechError(operation.failure);
      let packet;
      try { packet = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(operation.output))); } catch { throw speechError('speech_output_invalid'); }
      if (packet?.token !== operation.token || packet.kind !== 'complete' || packet.localOnly !== true || !/^zh-(CN|Hans-CN)$/u.test(packet.culture)) throw speechError('speech_engine_unavailable');
      return Object.freeze({ status: 'complete', localOnly: true, culture: packet.culture, audioPlayed: op === 'speak' });
    } finally { for (const chunk of operation.output) chunk.fill(0); }
  }

  return Object.freeze({
    probe: ({ signal } = {}) => run('probe', undefined, signal),
    speak(text, { signal } = {}) {
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) return Promise.reject(speechError('speech_request_invalid'));
      return run('speak', text, signal);
    },
    async stop() { const previous = active; if (previous) { cancel(previous); await previous.completion; } return { stopped: true }; },
    snapshot: () => ({ active: Boolean(active), localOnly: true }),
  });
}

module.exports = { createWindowsLocalSpeech };
