import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect } from '@playwright/test';
import { _electron } from 'playwright';

const workspace = path.resolve(import.meta.dirname, '..');
const output = path.join(workspace, '.cache', `client-visibility-${Date.now()}`);
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const executablePath = [path.join(workspace, 'apps', 'desktop', 'node_modules', 'electron', 'dist', 'electron.exe'),
  path.join(path.dirname(require.resolve('electron/package.json')), 'dist', 'electron.exe')].find(existsSync);
assert(executablePath, 'An installed Electron runtime is required; this check never downloads it');
const entry = path.join(workspace, 'tests', 'helpers', 'standalone-electron-smoke.cjs');
const env = { ...process.env, NUANBAN_SMOKE_USER_DATA: output };
delete env.ELECTRON_RUN_AS_NODE;
const checks = [];
const pageErrors = [];
const application = await _electron.launch({ executablePath, args: [entry, '--management'], env, timeout: 30000 });
application.on('window', page => page.on('pageerror', error => pageErrors.push(error.message)));

async function verify(name, operation) {
  await operation();
  checks.push(name);
}

async function clientState() {
  return application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(candidate => /\/(dist|ui)\/index\.html/.test(candidate.webContents.getURL()));
    return window ? { id: window.id, visible: window.isVisible(), minimized: window.isMinimized(), protected: window.isContentProtected() } : null;
  });
}

function launchSecondInstance(flags) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, [entry, ...flags], { cwd: workspace, env, windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Second-instance handoff timed out')); }, 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Second instance exited with ${code}`)); });
  });
}

try {
  await expect.poll(async () => (await application.windows()).find(page => /\/(dist|ui)\/index\.html/.test(page.url()))?.url(), { timeout: 15000 }).toBeTruthy();
  const management = (await application.windows()).find(page => /\/(dist|ui)\/index\.html/.test(page.url()));
  assert(management);
  const initialId = (await clientState()).id;
  await verify('management_startup_has_real_navigation_and_visible_native_window', async () => {
    await expect(management.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    assert.deepEqual(await clientState(), { id: initialId, visible: true, minimized: false, protected: true });
  });
  await verify('second_launch_restores_same_minimized_window_and_enables_explicit_compatibility', async () => {
    await application.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).minimize(), initialId);
    await expect.poll(async () => (await clientState()).minimized).toBe(true);
    await launchSecondInstance(['--management', '--client-display-compatible']);
    await expect.poll(clientState).toEqual({ id: initialId, visible: true, minimized: false, protected: false });
    await expect(management.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    assert.equal((await application.windows()).length, 4);
    await management.screenshot({ path: path.join(output, 'client-visible.png') });
  });
  await verify('pet_and_overlays_keep_capture_protection_and_renderer_security', async () => {
    const security = await application.evaluate(({ BrowserWindow }, clientId) => BrowserWindow.getAllWindows().map(window => {
      const preferences = window.webContents.getLastWebPreferences();
      return { client: window.id === clientId, protected: window.isContentProtected(), sandbox: preferences.sandbox,
        contextIsolation: preferences.contextIsolation, nodeIntegration: preferences.nodeIntegration, webSecurity: preferences.webSecurity };
    }), initialId);
    assert.equal(security.length, 4);
    assert(security.every(window => window.client ? !window.protected : window.protected));
    assert(security.every(window => window.sandbox && window.contextIsolation && !window.nodeIntegration && window.webSecurity));
  });
  await verify('pet_compatibility_is_explicit_and_survives_second_instance_without_duplicate_windows', async () => {
    await launchSecondInstance(['--pet-display-compatible']);
    const pet = (await application.windows()).find(page => page.url().endsWith('/pet.html'));
    assert(pet);
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(window => window.isContentProtected()).length)).toBe(2);
    const security = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => ({
      pet: window.webContents.getURL().endsWith('/pet.html'),
      overlay: /\/(guide|caption)\.html$/.test(window.webContents.getURL()),
      protected: window.isContentProtected(), visible: window.isVisible(), minimized: window.isMinimized(),
    })));
    assert.equal(security.length, 4);
    assert(security.every(window => window.overlay === window.protected));
    assert(security.some(window => window.pet && window.visible && !window.minimized));
    await pet.screenshot({ path: path.join(output, 'pet-recording-compatible.png') });
  });
  await verify('compatibility_survives_client_close_and_reopen_without_duplicates', async () => {
    await management.close();
    const pet = (await application.windows()).find(page => page.url().endsWith('/pet.html'));
    assert(pet);
    await pet.evaluate(() => window.nuanbanPet.openMain('/settings'));
    await expect.poll(async () => (await clientState())?.protected).toBe(false);
    await expect.poll(async () => (await clientState())?.visible).toBe(true);
    assert.equal((await application.windows()).length, 4);
  });
  await verify('no_screen_or_microphone_capture_started', async () => {
    const pet = (await application.windows()).find(page => page.url().endsWith('/pet.html'));
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert.equal(state.observation.captureActive, false);
    assert.equal(state.wake.microphoneActive, false);
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
    assert.deepEqual(pageErrors, []);
  });
  const report = { generatedAt: new Date().toISOString(), checks, pageErrors, screenRequestAttempts: 0,
    evidence: 'Isolated real Electron windows and a second native process; no user desktop or microphone capture' };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, report: path.join(output, 'results.json'), screenshot: path.join(output, 'client-visible.png') }));
} finally {
  await application.close();
}
