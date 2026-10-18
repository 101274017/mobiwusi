const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function run(host) {
  const directory = process.env.NUANBAN_C02_EVIDENCE_DIR;
  if (!directory || !path.isAbsolute(directory)) throw new Error('Self-test requires an explicit absolute evidence directory');
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(path.join(directory, 'screenshots'), { recursive: true });
  const cases = [];
  async function verify(name, action) {
    console.log(`C02 check: ${name}`);
    try { const detail = await action(); cases.push({ name, passed: true, ...detail }); }
    catch (error) { throw new Error(`C02 check failed: ${name}`, { cause: error }); }
  }
  async function waitFor(predicate) {
    const deadline = performance.now() + 4_000;
    while (!predicate()) { if (performance.now() >= deadline) throw new Error('Native self-test timed out'); await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  async function captureHidden(window) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const image = await window.webContents.capturePage(undefined, { stayHidden: true });
        if (!image.isEmpty()) return image;
      } catch (error) {
        lastError = error;
      }
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    throw lastError ?? new Error('隐藏窗口截图为空');
  }
  async function evaluate(script) { return host.control.webContents.executeJavaScript(script); }
  async function syntheticRun() {
    const ticket = await evaluate('window.nuanbanC02.begin({consent:true,overlay:true})');
    assert.ok(host.capture.grant({ trusted: true, userGesture: true, videoRequested: true, audioRequested: false, ownSourceId: host.canary.getMediaSourceId() }));
    assert.equal(host.capture.started(ticket, { videoTracks: 1, audioTracks: 0, width: 320, height: 240 }), true);
    await evaluate(`(() => { const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240; canvas.getContext('2d').fillRect(0,0,320,240); const stream = canvas.captureStream(2); window.__syntheticTrack = stream.getVideoTracks()[0]; active = {ticket:${JSON.stringify(ticket)},stream,pending:false,stopped:false,frameHandle:null,sequence:0}; return true; })()`);
    return ticket;
  }
  await verify('no automatic display capture and all windows hidden', async () => {
    assert.equal(host.getCounters().displayRequestCount, 0);
    assert.equal(host.control.isVisible(), false);
    assert.equal(host.canary.isVisible(), false);
    assert.equal(host.capture.snapshot().frames, 0);
    return { displayCaptureRequested: false };
  });
  await verify('sandboxed renderer and no bridge in synthetic source', async () => {
    assert.deepEqual(await evaluate('({node:typeof require,process:typeof process,bridge:typeof window.nuanbanC02})'), { node: 'undefined', process: 'undefined', bridge: 'object' });
    assert.equal(await host.canary.webContents.executeJavaScript('typeof window.nuanbanC02'), 'undefined');
  });
  await verify('start without purpose consent does not request capture', async () => {
    await evaluate("document.getElementById('start').click()");
    assert.match(await evaluate("document.getElementById('message').textContent"), /请先阅读/);
    assert.equal(host.getCounters().displayRequestCount, 0);
  });
  await verify('extra IPC fields are rejected before consent state', async () => {
    assert.equal(await evaluate("window.nuanbanC02.begin({consent:true,overlay:false,sourceId:'screen:0:0'}).then(()=>false,()=>true)"), true);
  });
  for (const width of [1160, 760]) {
    await verify(`native hidden UI render ${width} DIP`, async () => {
      host.control.setContentSize(width, 940);
      await new Promise(resolve => setTimeout(resolve, 80));
      const layout = await evaluate('({width:innerWidth,documentWidth:document.documentElement.scrollWidth,heading:document.querySelector("h1").textContent})');
      assert.equal(layout.width, width);
      assert.ok(layout.documentWidth <= width);
      const image = await captureHidden(host.control);
      assert.equal(image.isEmpty(), false);
      assert.equal(host.control.isVisible(), false);
      const name = `desktop-lab-control-${width}.png`;
      fs.writeFileSync(path.join(directory, 'screenshots', name), image.toPNG());
      return { screenshot: `screenshots/${name}`, image: image.getSize(), externalScreenCapture: false };
    });
  }
  await verify('canary buttons use synthetic state only', async () => {
    await host.canary.webContents.executeJavaScript("document.getElementById('target').click()");
    assert.equal(await host.canary.webContents.executeJavaScript("document.getElementById('count').textContent"), '1');
    const image = await captureHidden(host.canary);
    assert.equal(image.isEmpty(), false);
    fs.writeFileSync(path.join(directory, 'screenshots', 'desktop-lab-canary.png'), image.toPNG());
    return { screenshot: 'screenshots/desktop-lab-canary.png', nativeHitPassVerified: false };
  });
  await verify('native DIP conversion round trip in current environment', async () => {
    const geometry = host.snapshot().geometry;
    assert.ok(Math.abs(geometry.centerDip.x - geometry.roundTripDip.x) <= 1);
    assert.ok(Math.abs(geometry.centerDip.y - geometry.roundTripDip.y) <= 1);
    return { geometry, mixedDpiMovementVerified: false, negativeOriginMovementVerified: false };
  });
  await verify('transparent topmost native windows, no visible overlay', async () => {
    const ticket = await syntheticRun();
    await host.createOverlays(ticket);
    const { marker, stopWindow } = host.getOverlays();
    assert.equal(marker.isVisible(), false);
    assert.equal(stopWindow.isVisible(), false);
    assert.equal(marker.isFocusable(), false);
    assert.equal(marker.isAlwaysOnTop(), true);
    assert.equal(marker.getNativeWindowHandle().length > 0, true);
    assert.equal(await stopWindow.webContents.executeJavaScript('window.nuanbanC02.read().then(()=>false,()=>true)'), true);
    const image = await captureHidden(marker);
    assert.equal(image.isEmpty(), false);
    const pixels = image.toBitmap();
    let transparent = 0;
    for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] === 0) transparent += 1;
    assert.ok(transparent > 0);
    fs.writeFileSync(path.join(directory, 'screenshots', 'desktop-lab-marker.png'), image.toPNG());
    void stopWindow.webContents.executeJavaScript("document.getElementById('stop').click(); true").catch(() => undefined);
    await waitFor(() => host.capture.snapshot().phase === 'stopped');
    assert.equal(await evaluate('window.__syntheticTrack.readyState'), 'ended');
    assert.equal(host.getOverlays().marker, null);
    return { fixture: 'canvas MediaStreamTrack; not desktop media', transparentRenderPixels: transparent, mousePassThroughConfigured: true, mousePassThroughVerified: false };
  });
  await verify('pending late stream cannot restart a stopped generation', async () => {
    const ticket = await syntheticRun();
    await evaluate('active.pending = true');
    host.requestStop('user');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(host.capture.snapshot().cleanupPending, true);
    assert.equal(await evaluate("document.getElementById('start').disabled"), true);
    await evaluate('active.pending = false; endLocal(active)');
    await waitFor(() => host.capture.snapshot().phase === 'stopped');
    assert.equal(await evaluate('window.__syntheticTrack.readyState'), 'ended');
    assert.equal(host.capture.started(ticket, { videoTracks: 1, audioTracks: 0, width: 320, height: 240 }), false);
  });
  await verify('real display capture was never requested by automation', async () => {
    assert.equal(host.getCounters().displayRequestCount, 0);
    assert.equal(host.getCounters().pageErrors.length, 0);
  });
  await verify('renderer error observer has a positive synthetic control', async () => {
    await evaluate("console.error('C02_SYNTHETIC_ERROR_CANARY')");
    await waitFor(() => host.getCounters().pageErrors.length === 1);
    assert.deepEqual(host.getCounters().pageErrors, ['renderer-console-error']);
  });
  const report = { passed: true, generatedAt: new Date().toISOString(), generatedTimeZone: 'Asia/Shanghai', scope: 'hidden-Electron-native-windows-own-synthetic-render-and-canvas-track-only', electron: process.versions.electron, platform: process.platform, cases, counters: host.getCounters(), expectedErrorCanaries: 1, unexpectedPageErrors: host.getCounters().pageErrors.length - 1, displays: host.snapshot().displays.map(({ bounds, workArea, scaleFactor, rotation }) => ({ bounds, workArea, scaleFactor, rotation })), actualDisplayCaptureVerified: false, externalApplicationCaptureVerified: false, mousePassThroughVerified: false, mixedDpiMovementVerified: false, negativeOriginMovementVerified: false, independentAcceptance: false, limitations: ['仅覆盖隐藏 Electron 的自有合成窗口、画布轨道、DIP/显示器几何和停止逻辑。', '没有真实跨应用捕获、系统权限、鼠标穿透、混合 DPI 或人工独立复核记录。'] };
  fs.writeFileSync(path.join(directory, 'desktop-lab-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, cases: cases.length, realDisplayMediaRequests: host.getCounters().displayRequestCount }));
}

module.exports = { run };
