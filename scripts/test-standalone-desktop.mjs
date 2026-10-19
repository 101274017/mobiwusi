import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(workspace, '.cache', `standalone-smoke-${Date.now()}`);
await mkdir(output, { recursive: true });
assert.equal(process.platform, 'win32', 'This smoke check targets the Windows standalone host');
const require = createRequire(import.meta.url);
const electronVersion = require('electron/package.json').version;
const executablePath = [path.join(path.dirname(require.resolve('electron/package.json')), 'dist', 'electron.exe'),
  path.join(workspace, 'node_modules', '.pnpm', `electron@${electronVersion}`, 'node_modules', 'electron', 'dist', 'electron.exe')].find(existsSync);
assert(executablePath, 'The pinned Electron binary must already be installed; this check never downloads it');
const pageErrors = [];
const checks = [];
const application = await _electron.launch({ executablePath, args: [path.join(workspace, 'tests', 'helpers', 'standalone-electron-smoke.cjs')],
  env: { ...process.env, NUANBAN_SMOKE_USER_DATA: output }, timeout: 30000 });
application.on('window', window => window.on('pageerror', error => pageErrors.push(error.message)));

async function verify(name, operation) {
  await operation();
  checks.push(name);
}

try {
  await verify('standalone_pet_starts_without_management', async () => {
    await application.waitForEvent('window', { predicate: window => window.url().endsWith('/pet.html'), timeout: 10000 }).catch(() => undefined);
    const windows = await application.windows();
    assert.equal(windows.length, 3);
    assert(windows.every(window => !window.url().includes('/ui/') && !window.url().includes('/dist/')));
  });
  const pet = (await application.windows()).find(window => window.url().endsWith('/pet.html'));
  assert(pet);
  await pet.waitForLoadState('networkidle');
  await verify('default_off_and_no_external_capture_attempt', async () => {
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert.equal(state.observation.state, 'off');
    assert.notEqual(state.wake.state, 'listening');
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
  });
  await verify('sandboxed_content_protected_windows', async () => {
    const security = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => {
      const preferences = window.webContents.getLastWebPreferences();
      return { sandbox: preferences.sandbox, contextIsolation: preferences.contextIsolation, nodeIntegration: preferences.nodeIntegration,
        protected: window.isContentProtected(), title: window.getTitle() };
    }));
    assert(security.every(window => window.sandbox && window.contextIsolation && !window.nodeIntegration && window.protected));
  });
  await verify('pet_direct_text_question_without_management_or_capture', async () => {
    await pet.locator('#pet-toggle').click();
    await pet.locator('#question').fill('请教我调整显示文字大小');
    await pet.locator('#send-question').click();
    await pet.waitForFunction(async () => (await window.nuanbanPet.snapshot()).task.question === '请教我调整显示文字大小');
    assert.equal((await application.windows()).length, 3);
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
  });
  await verify('management_closes_while_pet_runtime_survives', async () => {
    await pet.evaluate(() => window.nuanbanPet.openMain('/settings'));
    const management = (await application.windows()).find(window => window.url().includes('/ui/') || window.url().includes('/dist/'));
    assert(management);
    await management.close();
    assert.equal((await application.windows()).length, 3);
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert(['off', 'stopped'].includes(state.observation.state));
    assert.equal(state.observation.captureActive, false);
    assert.equal(state.wake.microphoneActive, false);
  });
  await verify('unfinished_teaching_saved_unmastered_in_local_encrypted_store', async () => {
    await pet.evaluate(() => window.nuanbanPet.command({ type: 'guidance.finish' }));
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert.equal(state.learning.note.question, '请教我调整显示文字大小');
    assert.equal(state.learning.note.result, 'unfinished');
    assert.equal(state.learning.note.mastery, 'unmastered');
    assert(!state.learningError);
  });
  await verify('management_sidebar_restores_minimized_pet_without_capture', async () => {
    await pet.evaluate(() => window.nuanbanPet.openMain('/notes'));
    const management = (await application.windows()).find(window => window.url().includes('/ui/') || window.url().includes('/dist/'));
    assert(management);
    await management.waitForLoadState('networkidle');
    await application.evaluate(({ BrowserWindow }) => {
      const petWindow = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/pet.html'));
      petWindow.minimize();
      petWindow.hide();
    });
    await management.getByRole('navigation', { name: '主要导航', exact: true }).getByRole('button', { name: '打开桌宠', exact: true }).click();
    await management.waitForFunction(() => document.querySelector('.desktop-pet-button')?.getAttribute('aria-busy') === 'false');
    const state = await application.evaluate(({ BrowserWindow }) => {
      const petWindow = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/pet.html'));
      return { visible: petWindow.isVisible(), minimized: petWindow.isMinimized(), windows: BrowserWindow.getAllWindows().length };
    });
    assert.deepEqual(state, { visible: true, minimized: false, windows: 4 });
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
  });
  await verify('management_sidebar_reopens_closed_pet_without_exiting_client', async () => {
    const management = (await application.windows()).find(window => window.url().includes('/ui/') || window.url().includes('/dist/'));
    assert(management);
    assert.equal(await pet.evaluate(() => window.nuanbanPet.close()), true);
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/pet.html')).isVisible()), false);
    await management.getByRole('navigation', { name: '主要导航', exact: true }).getByRole('button', { name: '打开桌宠', exact: true }).click();
    await management.waitForFunction(() => document.querySelector('.desktop-pet-button')?.getAttribute('aria-busy') === 'false');
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/pet.html')).isVisible()), true);
    assert.equal((await application.windows()).length, 4);
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert.equal(state.observation.captureActive, false);
    assert.equal(state.wake.microphoneActive, false);
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
    await management.screenshot({ path: path.join(output, 'management.png') });
    await management.close();
    assert.equal((await application.windows()).length, 3);
  });
  await verify('native_panel_event_and_short_work_area_controls', async () => {
    await application.evaluate(({ BrowserWindow }) => {
      const petWindow = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/pet.html'));
      petWindow.webContents.send('nuanban:pet:panel', { expanded: true, focusInput: false, section: 'learning' });
    });
    await pet.locator('#learning-summary').waitFor({ state: 'visible' });
    assert(await pet.locator('#stop-observation').isVisible());
    assert(await pet.locator('#question').isVisible());
  });
  await pet.screenshot({ path: path.join(output, 'pet.png') });
  await verify('stop_really_reports_no_capture', async () => {
    const result = await pet.evaluate(() => window.nuanbanPet.command({ type: 'observation.stop' }));
    assert.equal(result.snapshot.observation.state, 'stopped');
    assert.equal(result.snapshot.observation.captureActive, false);
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
  });
  assert.deepEqual(pageErrors, []);
  const report = { generatedAt: new Date().toISOString(), evidence: 'real Electron lifecycle and own UI only; no user screen or microphone authorization',
    checks, pageErrors, screenRequestAttempts: 0, realThirdPartyCaptureAccepted: false, realProviderAccepted: false };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, report: path.join(output, 'results.json'), screenshot: path.join(output, 'pet.png'), managementScreenshot: path.join(output, 'management.png') }));
} finally {
  await application.close();
}
