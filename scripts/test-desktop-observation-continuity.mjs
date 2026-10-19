import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { _electron } from 'playwright';

const workspace = path.resolve(import.meta.dirname, '..');
const output = path.join(workspace, '.cache', `observation-continuity-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...process.env, NUANBAN_SMOKE_USER_DATA: output };
delete env.ELECTRON_RUN_AS_NODE;
const application = await _electron.launch({ executablePath: path.join(workspace, 'apps/desktop/node_modules/electron/dist/electron.exe'),
  args: [path.join(workspace, 'tests/helpers/standalone-electron-smoke.cjs')], env, timeout: 30000 });

try {
  const report = await application.evaluate(async ({ BrowserWindow, nativeImage }, root) => {
    const require = process.getBuiltinModule('node:module').createRequire(root + '/apps/desktop/main.cjs');
    const assert = require('node:assert/strict');
    const { createHash } = require('node:crypto');
    const { createWindowsLocalDetector } = require('./observation/windows-local-detector.cjs');
    const { evaluateLocalFrame } = require('./observation-policy.cjs');
    const { createDesktopRuntime } = require('./runtime-coordinator.cjs');
    const sourceWindow = new BrowserWindow({ show: false, width: 1620, height: 1120,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    const detector = createWindowsLocalDetector({ nativeImage });
    const checks = [];
    const frames = [];
    let cloudCalls = 0;
    let captureCalls = 0;
    let runtime;
    try {
      await sourceWindow.loadURL('data:text/html,<html><body style="margin:0"><canvas width="1600" height="1000"></canvas></body></html>');
      await sourceWindow.webContents.executeJavaScript(`(() => {
        const canvas = document.querySelector('canvas');
        const context = canvas.getContext('2d');
        context.fillStyle = 'white'; context.fillRect(0, 0, 1600, 1000);
        context.fillStyle = 'black'; context.font = '36px sans-serif';
        ['文件', '编辑', '查看', '设置', '显示', '文本大小'].forEach((label, index) => context.fillText(label, 30, 70 + index * 80));
        const pixels = context.createImageData(1180, 1000);
        let state = 123456789;
        for (let offset = 0; offset < pixels.data.length; offset += 4) {
          for (let channel = 0; channel < 3; channel += 1) {
            state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
            pixels.data[offset + channel] = state & 255;
          }
          pixels.data[offset + 3] = 255;
        }
        context.putImageData(pixels, 420, 0);
      })()`);
      const source = {
        async capture() {
          captureCalls += 1;
          const image = await sourceWindow.webContents.capturePage({ x: 0, y: 0, width: 1600, height: 1000 });
          const png = image.toPNG();
          return { sourceId: 'screen:0:0', sourceIdentity: '0'.repeat(64), frameId: `synthetic_${captureCalls}`,
            png, ...image.getSize(), geometry: null, capturedAt: Date.now(), frameHash: createHash('sha256').update(png).digest('hex') };
        },
        async detect(frame, options) {
          const start = Date.now();
          const detection = await detector.detect(frame, options);
          const admitted = evaluateLocalFrame(frame, detection);
          frames.push({ width: frame.width, height: frame.height, elapsedMs: Date.now() - start, status: detection.status,
            words: detection.words.length, sanitizedBytes: detection.sanitizedPng?.length,
            decision: admitted.decision, reason: admitted.reason, scene: admitted.scene, outboundBytes: admitted.sanitizedPng?.length });
          admitted.sanitizedPng?.fill(0);
          return detection;
        },
        stop: () => detector.stop(),
      };
      runtime = createDesktopRuntime({ source, intervalMs: 100, analyzer: { async analyze() { cloudCalls += 1; throw new Error('Cloud access is forbidden in this test'); } } });
      await runtime.startObservation({ actor: 'owner', confirmed: true, sourceId: 'screen:0:0', cloudConsent: false });
      for (let iteration = 0; iteration < 3; iteration += 1) {
        await runtime.whenIdle();
        assert.equal(runtime.snapshot().observation.state, 'observing');
        assert.equal(runtime.snapshot().observation.reason, 'controls_only');
        if (iteration < 2) await new Promise(resolve => setTimeout(resolve, 150));
      }
      assert(frames.length >= 3);
      assert(frames.every(frame => frame.status === 'complete' && frame.sanitizedBytes > 2_000_000
        && frame.decision === 'allow' && frame.scene === 'controls_only' && frame.outboundBytes <= 2_000_000));
      checks.push('complete_large_frames_remain_observing_across_three_real_native_checks');
      await runtime.stopObservation('user');
      assert.equal(runtime.snapshot().observation.captureActive, false);
      checks.push('stop_waits_for_native_detector_cleanup');
      await sourceWindow.webContents.executeJavaScript(`(() => {
        const context = document.querySelector('canvas').getContext('2d');
        context.fillStyle = 'black'; context.font = '36px sans-serif'; context.fillText('私人聊天', 30, 700);
      })()`);
      await runtime.startObservation({ actor: 'owner', confirmed: true, sourceId: 'screen:0:0', cloudConsent: false });
      await runtime.whenIdle();
      assert.equal(runtime.snapshot().observation.state, 'privacy_paused');
      assert.equal(runtime.snapshot().observation.reason, 'sensitive_screen');
      assert.equal(runtime.snapshot().observation.captureActive, false);
      const pausedCaptures = captureCalls;
      await new Promise(resolve => setTimeout(resolve, 400));
      assert.equal(captureCalls, pausedCaptures);
      checks.push('sensitive_synthetic_text_still_stops_capture_without_automatic_resume');
      assert.equal(cloudCalls, 0);
      assert.equal(global.__nuanbanSmoke.screenRequestAttempts, 0);
      checks.push('no_user_desktop_capture_or_cloud_calls');
      return { generatedAt: new Date().toISOString(), checks, frames, cloudCalls, desktopCaptureAttempts: 0,
        evidence: 'Real Windows OCR and face detector over a synthetic app-owned canvas only; no user desktop, microphone, or cloud access' };
    } finally {
      await runtime?.dispose();
      await detector.stop();
      sourceWindow.destroy();
    }
  }, workspace);
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.checks.length, report: path.join(output, 'results.json'), frames: report.frames,
    desktopCaptureAttempts: report.desktopCaptureAttempts, cloudCalls: report.cloudCalls }));
} finally {
  await application.close();
}
