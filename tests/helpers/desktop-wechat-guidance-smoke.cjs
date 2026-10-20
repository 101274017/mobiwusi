const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, desktopCapturer, nativeImage, screen, session } = require('electron');
const { createWindowsLocalDetector } = require('../../apps/desktop/observation/windows-local-detector.cjs');
const { createProviderAnalysisClient } = require('../../apps/desktop/provider-analysis.cjs');
const { createDesktopRuntime } = require('../../apps/desktop/runtime-coordinator.cjs');

const userData = path.resolve(__dirname, '../../.cache', `wechat-guidance-smoke-${Date.now()}-${process.pid}`);
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
desktopCapturer.getSources = async () => { throw new Error('Real desktop capture is prohibited'); };
let runtime;
let syntheticWindow;
let guideWindow;
const deadline = setTimeout(() => app.exit(1), 60000);
const report = { syntheticOnly: true, realWindowsOcr: true, model: 'synthetic', captures: 0, modelCalls: 0, supplementalWords: 0, hasWeChatElement: false, arrowVisible: false, nativeGuidePainted: false };

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
  const display = screen.getPrimaryDisplay();
  guideWindow = new BrowserWindow({ ...display.bounds, show: false, transparent: true, frame: false, skipTaskbar: true, focusable: false, alwaysOnTop: true,
    webPreferences: { preload: path.resolve(__dirname, '../../apps/desktop/guide-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  guideWindow.setContentProtection(true);
  guideWindow.setIgnoreMouseEvents(true, { forward: true });
  await guideWindow.loadFile(path.resolve(__dirname, '../../apps/desktop/guide.html'));
  syntheticWindow = new BrowserWindow({ show: false, width: 1692, height: 1025, useContentSize: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const painted = new Promise(resolve => syntheticWindow.once('ready-to-show', resolve));
  const labels = ['此电脑', '回收站', '微信', '设置', '浏览器', '返回', '文件', '编辑', '查看', '帮助',
    '示例文件夹', '示例工具', '示例图片', '示例应用', '示例项目'];
  const content = '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#263b49;color:white;font:28px "Microsoft YaHei";display:grid;grid-template-columns:repeat(5,180px);gap:44px;padding:50px}.icon{height:94px;width:94px;background:#45a969;border-radius:20px;margin:0 auto 14px}article{height:170px;text-align:center}</style>'
    + labels.map(label => `<article><div class="icon"></div><span>${label}</span></article>`).join('');
  await syntheticWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
  await painted;
  const detector = createWindowsLocalDetector({ nativeImage });
  const analyzer = createProviderAnalysisClient({ provider: { answer: async input => {
    report.modelCalls++;
    const context = JSON.parse(input.instructions.split('当前最小上下文：')[1]);
    const target = context.elements.find(element => element.label === '微信');
    assert.ok(target, 'The actual local OCR result must admit WeChat; no synthetic target coordinates');
    assert.equal(context.surface, 'computer_screen');
    assert.equal(context.view, 'controls_only_layout');
    report.hasWeChatElement = true;
    return { text: JSON.stringify({ kind: 'step', instruction: '请亲手双击微信图标。', target_id: target.id, presentation: 'confirmed', expected_labels: ['发现'] }) };
  } } });
  runtime = createDesktopRuntime({ source: {
    capture: async () => {
      const image = await syntheticWindow.webContents.capturePage();
      const png = image.toPNG();
      const { width, height } = image.getSize(1);
      const contentBounds = syntheticWindow.getContentBounds();
      report.captures++;
      return { png, frameHash: createHash('sha256').update(png).digest('hex'), width, height, frameId: `synthetic-${report.captures}`,
        sourceId: 'screen:777:0', displayId: '777', capturedAt: Date.now(),
        geometry: { coordinateSpace: 'screen-dip', x: display.bounds.x, y: display.bounds.y, width: contentBounds.width, height: contentBounds.height,
          pixelX: 0, pixelY: 0, pixelWidth: width, pixelHeight: height, scaleFactor: width / contentBounds.width, rotation: 0 } };
    },
    detect: async (frame, options) => {
      const detection = await detector.detect(frame, options);
      assert.equal(detection.status, 'complete', detection.reason);
      report.supplementalWords = Math.max(report.supplementalWords, detection.words.filter(word => word.ocrPass === 1).length);
      return detection;
    },
    stop: () => detector.stop(),
  }, analyzer, intervalMs: 60000, onTarget: target => {
    if (!target?.visible) { guideWindow.webContents.send('nuanban:guide:state', { visible: false }); guideWindow.hide(); return; }
    guideWindow.webContents.send('nuanban:guide:state', { ...target,
      rect: { ...target.rect, x: target.rect.x - display.bounds.x, y: target.rect.y - display.bounds.y } });
    guideWindow.showInactive();
    if (target.label === '微信') report.arrowVisible = true;
    return true;
  } });
  await runtime.startObservation({ actor: 'owner', confirmed: true, sourceId: 'screen:777:0', sourceName: '合成桌面，不读取真实屏幕', cloudConsent: true });
  await runtime.whenIdle();
  await runtime.ask('帮我找到微信');
  await runtime.whenIdle();
  assert.ok(report.supplementalWords > 0, 'Local enlarged OCR must run');
  assert.equal(report.modelCalls, 1);
  assert.equal(report.hasWeChatElement, true);
  assert.equal(report.arrowVisible, true);
  assert.equal(runtime.snapshot().task.state, 'awaiting_action');
  assert.equal(runtime.snapshot().captions.enabled, false);
  const rendered = await guideWindow.webContents.executeJavaScript(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    const root = document.getElementById('guide-root');
    const arrow = document.getElementById('guide-arrow');
    const target = document.getElementById('guide-target').getBoundingClientRect();
    resolve({ visible: !root.hidden, arrowVisible: !arrow.hidden, label: document.getElementById('guide-label').textContent,
      width: target.width, height: target.height, withinScreen: target.left >= 0 && target.top >= 0 && target.right <= innerWidth && target.bottom <= innerHeight });
  })))`);
  assert.equal(rendered.visible, true);
  assert.equal(rendered.arrowVisible, true);
  assert.equal(rendered.label, '微信');
  assert.equal(rendered.withinScreen, true);
  assert.ok(rendered.width > 0 && rendered.height > 0);
  const pixels = (await guideWindow.webContents.capturePage()).toBitmap();
  try {
    let markerPixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] === 38 && pixels[offset + 1] === 90 && pixels[offset + 2] === 180 && pixels[offset + 3] > 0) markerPixels++;
    }
    assert.ok(markerPixels > 20, 'The real native guide must paint its arrow/target, not merely receive an onTarget callback');
    report.nativeGuidePainted = true;
  } finally { pixels.fill(0); }
  console.log(JSON.stringify({ ...report, passed: true }, null, 2));
}).catch(error => { console.error(error.message, JSON.stringify({ observation: runtime?.snapshot().observation, analysis: runtime?.snapshot().analysis, report })); process.exitCode = 1; }).finally(async () => {
  await runtime?.dispose('test');
  syntheticWindow?.destroy();
  guideWindow?.destroy();
  clearTimeout(deadline);
  app.exit(process.exitCode ?? 0);
});
