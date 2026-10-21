import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';

const require = createRequire(import.meta.url);
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(workspace, '.cache', `lili-smoke-${Date.now()}`);
await mkdir(output, { recursive: true });
assert.equal(process.platform, 'win32');
const electronPackage = createRequire(path.join(workspace, 'apps', 'desktop', 'package.json'));
const executablePath = path.join(path.dirname(electronPackage.resolve('electron/package.json')), 'dist', 'electron.exe');
assert(existsSync(executablePath), '请使用已经安装的 Electron');
const environment = { ...process.env, NUANBAN_LILI_TEST_USER_DATA: output };
delete environment.ELECTRON_RUN_AS_NODE;
const application = await _electron.launch({ executablePath,
  args: [path.join(workspace, 'tests', 'helpers', 'lili-electron-smoke.cjs'), '--pet-lili', '--pet-display-compatible'],
  env: environment, timeout: 30000 });
const checks = [];
const pageErrors = [];
const report = { date: new Date().toISOString(), platform: process.platform, system: (await import('node:os')).release(),
  electron: electronPackage('electron/package.json').version, userData: output, checks, pageErrors, status: 'running',
  notVerified: ['Windows 10 实机', '多显示器真实热插拔', '线上模型、语音与云端星云会话'] };
for (const page of await application.windows()) page.on('pageerror', error => pageErrors.push(error.message));
application.on('window', page => page.on('pageerror', error => pageErrors.push(error.message)));
async function verify(name, operation) {
  if (process.env.NUANBAN_LILI_TEST_FILTER && !name.includes(process.env.NUANBAN_LILI_TEST_FILTER)) return;
  await operation(); checks.push(name); console.log(`PASS ${name}`);
}

try {
  let pet;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    pet = (await application.windows()).find(page => page.url().endsWith('/pet.html'));
    if (pet) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(pet, '微光指引桌宠窗口未启动');
  await pet.waitForLoadState('networkidle');
  await pet.locator('#lili-pet[data-ready="true"]').waitFor({ state: 'visible', timeout: 15000 });

  await verify('真实微光指引首帧、透明画布与本地资源', async () => {
    assert.equal((await application.windows()).length, 3);
    const data = await pet.evaluate(async () => {
      const canvas = document.getElementById('lili-pet');
      const pixels = canvas.getContext('2d').getImageData(0, 0, 384, 384).data;
      return { resource: await window.nuanbanLili.command({ type: 'resource.describe' }),
        cornerAlpha: pixels[3], opaquePixels: pixels.filter((value, index) => index % 4 === 3 && value > 0).length,
        hiddenBuiltin: getComputedStyle(document.getElementById('builtin-pet')).display };
    });
    assert.equal(data.resource.resource.id, 'lili');
    assert.equal(data.cornerAlpha, 0);
    assert(data.opaquePixels > 10000);
    assert.equal(data.hiddenBuiltin, 'none');
    await pet.screenshot({ path: path.join(output, 'lili-first-frame.png'), omitBackground: true });
  });

  await verify('默认关闭观察与麦克风，保留沙盒和内容保护边界', async () => {
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert.equal(state.observation.state, 'off');
    assert.equal(state.wake.microphoneActive, false);
    assert.equal(state.voice.microphoneActive, false);
    assert.equal(await application.evaluate(() => global.__liliSmoke.screenRequests), 0);
    const security = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => {
      const settings = window.webContents.getLastWebPreferences();
      return settings.sandbox && settings.contextIsolation && !settings.nodeIntegration;
    }));
    assert(security.every(Boolean));
    await application.evaluate(() => global.__liliSmoke.host.setPetDisplayCompatibility(false));
    assert.equal(await application.evaluate(() => global.__liliSmoke.host.getPetWindow().isContentProtected()), true);
    await application.evaluate(() => global.__liliSmoke.host.setPetDisplayCompatibility(true));
  });

  await verify('点击招手、面板展开和收起', async () => {
    await pet.evaluate(() => { window.__liliEvents = []; window.__releaseLili = window.nuanbanLili.onEvent(event => window.__liliEvents.push(event)); });
    await pet.locator('#pet-toggle').click();
    await pet.locator('#pet-panel').waitFor({ state: 'visible' });
    await pet.waitForFunction(() => document.getElementById('lili-pet').dataset.clip === 'wave');
    await pet.locator('#collapse-panel').click();
    await pet.locator('#pet-panel').waitFor({ state: 'hidden' });
    await pet.waitForFunction(() => window.__liliEvents.some(event => event.type === 'action.completed' && event.action === 'wave'), null, { timeout: 7000 });
  });

  await verify('六动作控制、休息进入循环和安全起身', async () => {
    for (const action of ['guide', 'success', 'sign']) {
      assert.equal((await pet.evaluate(action => window.nuanbanLili.command({ type: 'action.play', action }), action)).ok, true);
      await pet.waitForFunction(action => document.getElementById('lili-pet').dataset.clip === action, action);
      await pet.waitForFunction(() => document.getElementById('lili-pet').dataset.clip === 'idle', null, { timeout: 12000 });
    }
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'action.play', action: 'rest' }));
    await pet.waitForFunction(() => document.getElementById('lili-pet').dataset.clip === 'rest_loop', null, { timeout: 7000 });
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'action.stop' }));
    await pet.waitForFunction(() => document.getElementById('lili-pet').dataset.clip === 'rest_exit');
    await pet.waitForFunction(() => document.getElementById('lili-pet').dataset.clip === 'idle', null, { timeout: 7000 });
  });

  await verify('六表情、暂停和减少动态', async () => {
    for (const expression of ['smile', 'blink', 'listening', 'happy', 'sleepy', 'concern']) {
      assert.equal((await pet.evaluate(expression => window.nuanbanLili.command({ type: 'expression.set', expression, intensity: 0.8 }), expression)).ok, true);
      await pet.waitForFunction(expression => document.getElementById('lili-pet').dataset.expression === expression, expression);
    }
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'animation.configure', options: { paused: true } }));
    const first = await pet.evaluate(() => window.nuanbanLili.command({ type: 'state.get' }));
    await pet.waitForTimeout(250);
    const second = await pet.evaluate(() => window.nuanbanLili.command({ type: 'state.get' }));
    assert.equal(first.state.animation.frame, second.state.animation.frame);
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'animation.configure', options: { paused: false, reducedMotion: true } }));
    await pet.waitForFunction(() => document.getElementById('lili-pet').dataset.frame === '0');
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'animation.configure', options: { reducedMotion: false } }));
  });

  await verify('微光指引语义事件和业务文字气泡，无云端请求', async () => {
    const example = await pet.evaluate(async () => {
      const { runLiliExample } = await import(new URL('./examples/lili-control.js', document.baseURI).href);
      window.__liliExampleEvents = [];
      const result = await runLiliExample(window.nuanbanLili, event => window.__liliExampleEvents.push(event));
      window.__releaseLiliExample = result.unsubscribe;
      return { resource: result.resource, action: result.action };
    });
    assert.equal(example.resource.id, 'lili');
    await pet.waitForFunction(() => document.getElementById('lili-bubble').textContent === '我在认真听，慢慢来。');
    await pet.screenshot({ path: path.join(output, 'lili-bubble.png'), omitBackground: true });
    await pet.waitForFunction(() => window.__liliExampleEvents.some(event => event.type === 'action.completed' && event.action === 'wave'), null, { timeout: 7000 });
    await pet.evaluate(() => window.__releaseLiliExample());
    await pet.evaluate(() => window.nuanbanPet.ask('请告诉我如何转账'));
    await pet.waitForFunction(() => document.getElementById('lili-bubble').textContent.includes('涉及支付'));
    assert.equal((await pet.evaluate(() => window.nuanbanPet.snapshot())).task.result, 'risk_blocked');
    assert.equal(await application.evaluate(() => global.__liliSmoke.screenRequests), 0);
  });

  await verify('实际拖动、缩放、置顶、透明度和位置记录', async () => {
    await application.evaluate(() => { global.__liliSmoke.host.getPetWindow().moveTop(); global.__liliSmoke.host.getPetWindow().focus(); });
    await pet.bringToFront();
    await pet.waitForTimeout(300);
    await pet.evaluate(() => {
      window.__dragEvents = [];
      for (const name of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(name, event => {
        window.__dragEvents.push({ name, x: event.screenX, y: event.screenY, target: event.target.id, buttons: event.buttons });
      });
    });
    const before = await application.evaluate(() => global.__liliSmoke.host.getPetWindow().getBounds());
    const box = await pet.locator('#pet-toggle').boundingBox();
    const cursor = await application.evaluate(({ screen }, point) => {
      const bounds = global.__liliSmoke.host.getPetWindow().getBounds();
      return screen.dipToScreenPoint({ x: Math.round(bounds.x + point.x), y: Math.round(bounds.y + point.y) });
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const originalCursor = await application.evaluate(({ screen }) => screen.dipToScreenPoint(screen.getCursorScreenPoint()));
    const centerAlpha = await pet.evaluate(() => Array.from(document.getElementById('lili-pet').getContext('2d').getImageData(192, 192, 1, 1).data));
    const nativeDrag = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class LiliMouse { [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context); [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra); [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key); }'
[LiliMouse]::SetThreadDpiAwarenessContext([IntPtr]::new(-4)) | Out-Null
[LiliMouse]::SetCursorPos(${cursor.x}, ${cursor.y}) | Out-Null
Start-Sleep -Milliseconds 120
[LiliMouse]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 250
Write-Output ([LiliMouse]::GetAsyncKeyState(1))
try { for ($step = 1; $step -le 12; $step++) { [LiliMouse]::SetCursorPos((${cursor.x} - 8 * $step), (${cursor.y} - 5 * $step)) | Out-Null; Start-Sleep -Milliseconds 35 } }
finally { [LiliMouse]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero); [LiliMouse]::SetCursorPos(${originalCursor.x}, ${originalCursor.y}) | Out-Null }
`;
    const nativeOutput = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(nativeDrag, 'utf16le').toString('base64')], { windowsHide: true, timeout: 10000, encoding: 'utf8' });
    await pet.waitForTimeout(200);
    const after = await application.evaluate(() => global.__liliSmoke.host.getPetWindow().getBounds());
    const dragEvents = await pet.evaluate(() => window.__dragEvents);
    report.drag = { before, after, box, cursor, centerAlpha, nativeOutput, events: dragEvents };
    assert(before.x !== after.x || before.y !== after.y, '实际窗口未移动：' + JSON.stringify(report.drag));
    assert.equal((await pet.evaluate(() => window.nuanbanLili.command({ type: 'display.set', options: { size: 160, opacity: 0.8, alwaysOnTop: false } }))).ok, true);
    const settings = await application.evaluate(() => ({ opacity: global.__liliSmoke.host.getPetWindow().getOpacity(), top: global.__liliSmoke.host.getPetWindow().isAlwaysOnTop() }));
    assert(Math.abs(settings.opacity - 0.8) < 0.02);
    assert.equal(settings.top, false);
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'display.set', options: { size: 240, opacity: 1, alwaysOnTop: true } }));
  });

  await verify('鼠标穿透、隐藏和可恢复托盘', async () => {
    assert.equal((await pet.evaluate(() => window.nuanbanLili.command({ type: 'display.set', options: { clickThrough: true } }))).ok, true);
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'display.set', options: { clickThrough: false, visible: false } }));
    assert.equal(await application.evaluate(() => global.__liliSmoke.host.getPetWindow().isVisible()), false);
    await application.evaluate(() => global.__liliSmoke.host.lili.command({ type: 'display.set', options: { visible: true, clickThrough: false } }));
    assert.equal(await application.evaluate(() => global.__liliSmoke.host.getPetWindow().isVisible()), true);
  });

  await verify('右键原生菜单与原有花环水獭回归', async () => {
    await pet.locator('#pet-toggle').click({ button: 'right' });
    await pet.keyboard.press('Escape');
    assert.equal((await pet.evaluate(() => window.nuanbanLili.select(false))).ok, true);
    await pet.locator('#lili-pet').waitFor({ state: 'hidden' });
    await pet.locator('#builtin-pet').waitFor({ state: 'visible' });
    await pet.screenshot({ path: path.join(output, 'original-pet-regression.png'), omitBackground: true });
    await pet.evaluate(() => window.nuanbanLili.select(true));
    await pet.locator('#lili-pet[data-ready="true"]').waitFor({ state: 'visible' });
  });

  await verify('未知方向明确降级、外部内容不进入气泡 HTML、没有页面错误', async () => {
    assert.equal((await pet.evaluate(() => window.nuanbanLili.command({ type: 'display.set', options: { facing: 'left' } }))).code, 'unsupported_facing');
    await pet.evaluate(() => window.nuanbanLili.command({ type: 'ui.bubble', text: '<img src=x onerror=alert(1)>' }));
    await pet.waitForFunction(() => document.getElementById('lili-bubble').textContent.includes('<img'));
    assert.equal(await pet.locator('#lili-bubble img').count(), 0);
    assert.deepEqual(pageErrors, []);
  });
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  for (const page of await application.windows()) if (page.url().endsWith('/pet.html')) await page.screenshot({ path: path.join(output, 'failure.png'), omitBackground: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, output, error: report.error }, null, 2));
  await application.close();
}
