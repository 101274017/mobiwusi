import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect } from '@playwright/test';
import { _electron } from 'playwright';

const workspace = path.resolve(import.meta.dirname, '..');
const output = path.join(workspace, '.cache', 'pet-client-isolation-' + Date.now());
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const version = require('electron/package.json').version;
const executablePath = [path.join(path.dirname(require.resolve('electron/package.json')), 'dist', 'electron.exe'),
  path.join(workspace, 'node_modules', '.pnpm', 'electron@' + version, 'node_modules', 'electron', 'dist', 'electron.exe')].find(existsSync);
assert(executablePath, 'The installed Electron binary is required; this check never downloads it');
const checks = [];
const pageErrors = [];
const application = await _electron.launch({ executablePath, args: [path.join(workspace, 'tests/helpers/standalone-electron-smoke.cjs')],
  env: { ...process.env, NUANBAN_SMOKE_USER_DATA: output, NUANBAN_ANYSEARCH_API_KEY: '' }, timeout: 30000 });
application.on('window', page => page.on('pageerror', error => pageErrors.push(error.message)));

async function verify(name, operation) {
  await operation();
  checks.push(name);
}

async function windowState() {
  return application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => ({
    id: window.id, title: window.getTitle(), url: window.webContents.getURL(), visible: window.isVisible(), loading: window.webContents.isLoading(),
  })));
}

function clientPage(page) {
  return page.url().includes('/ui/') || page.url().includes('/dist/');
}

try {
  await expect.poll(async () => (await windowState()).filter(window => !window.loading && window.url.endsWith('.html')).length, { timeout: 20000 }).toBe(3);
  const pet = (await application.windows()).find(page => page.url().endsWith('/pet.html'));
  assert(pet);
  await pet.waitForLoadState('networkidle');
  await verify('standalone_starts_without_client_screen_or_microphone', async () => {
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert.equal(state.observation.captureActive, false);
    assert.equal(state.wake.microphoneActive, false);
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
  });
  await pet.evaluate(() => window.nuanbanPet.openMain('/chat/new'));
  const management = (await application.windows()).find(clientPage);
  assert(management);
  const draft = '客户端草稿：桌宠切页不能覆盖这句话';
  await verify('client_keeps_original_navigation_without_pet_header', async () => {
    await expect(management.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    await expect(management.getByRole('banner', { name: '桌宠工具小屋' })).toHaveCount(0);
    assert.equal(await management.evaluate(() => window.nuanbanWorkspace.status()), 'management');
    await management.locator('#question').fill(draft);
  });
  const managementUrl = management.url();
  await verify('archive_and_todos_stay_in_pet_without_opening_windows', async () => {
    for (const [route, section] of [['/notes', 'archive'], ['/todos', 'todos']]) {
      await pet.evaluate(route => window.nuanbanPet.openTool(route), route);
      await expect(pet.locator('#pet-panel')).toHaveAttribute('data-view', section);
      assert.equal((await application.windows()).length, 4);
      await expect(management).toHaveURL(managementUrl);
      await expect(management.locator('#question')).toHaveValue(draft);
    }
  });
  await verify('pet_library_uses_shared_local_data_without_client_navigation', async () => {
    await pet.evaluate(() => window.nuanbanPet.openTool('/notes'));
    await expect(pet.locator('#archive-add')).toBeEnabled();
    await pet.locator('#archive-add').click();
    await pet.locator('#archive-question').fill('本机学习档案验证');
    await pet.locator('#archive-summary').fill('这条笔记只写入隔离的自动化测试资料目录。');
    await pet.locator('#archive-save').click();
    await expect(pet.locator('#archive-status')).toHaveText('学习笔记已保存在本机。');
    const notes = await management.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('nuanban-demo-v1', 4);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const transaction = database.transaction('accounts', 'readonly');
        const request = transaction.objectStore('accounts').get('local-owner');
        transaction.oncomplete = () => { database.close(); resolve(request.result?.notes ?? []); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      });
    });
    assert(notes.some(note => note.question === '本机学习档案验证'));
    await expect(management).toHaveURL(managementUrl);
    await expect(management.locator('#question')).toHaveValue(draft);
    assert.equal((await application.windows()).length, 4);
    await pet.screenshot({ path: path.join(output, 'pet-learning-archive.png') });
  });
  await verify('pet_review_can_be_scheduled_and_completed_inside_pet', async () => {
    await pet.locator('#archive-list summary').click();
    await pet.getByRole('button', { name: '安排复习', exact: true }).click();
    await expect(pet.locator('#todos-view')).toHaveAttribute('aria-busy', 'false');
    await pet.locator('#todo-save').click();
    await expect(pet.locator('#todo-confirmation')).toBeVisible();
    await expect(pet.locator('#todos-list details')).toHaveCount(0);
    await pet.locator('#todo-save').click();
    await expect(pet.locator('#todos-list details')).toHaveCount(1);
    await pet.screenshot({ path: path.join(output, 'pet-review-todos.png') });
    await pet.locator('#todos-list summary').click();
    await pet.getByRole('button', { name: '我已复习，完成待办', exact: true }).click();
    await expect(pet.locator('#todos-status')).toContainText('掌握状态未改变');
    await expect(pet.locator('#todos-list details')).toHaveCount(0);
    await pet.locator('#todos-completed').click();
    await expect(pet.locator('#todos-list details')).toHaveCount(1);
    await expect(management.locator('#question')).toHaveValue(draft);
    assert.equal((await application.windows()).length, 4);
  });
  await pet.evaluate(() => window.nuanbanPet.openTool('/chat/new'));
  const tool = (await application.windows()).find(page => page !== management && clientPage(page));
  assert(tool);
  const toolTimeOrigin = await tool.evaluate(() => performance.timeOrigin);
  await verify('pet_uses_its_own_tool_window_and_never_replaces_client', async () => {
    await expect(tool.getByRole('banner', { name: '桌宠工具小屋' })).toBeVisible();
    await expect(tool.getByRole('navigation', { name: '主要导航', exact: true })).toBeHidden();
    assert.equal(await tool.evaluate(() => window.nuanbanWorkspace.status()), 'pet-tool');
    await expect(management).toHaveURL(managementUrl);
    await expect(management.locator('#question')).toHaveValue(draft);
    assert.equal((await application.windows()).length, 5);
    await management.screenshot({ path: path.join(output, 'management-unchanged.png') });
    await tool.screenshot({ path: path.join(output, 'pet-tool-independent.png') });
  });
  await verify('switching_pet_tools_keeps_client_route_and_draft', async () => {
    await pet.evaluate(() => window.nuanbanPet.openTool('/pets/draw'));
    await expect(tool).toHaveURL(/#\/pets\/draw$/);
    await expect(tool.getByRole('banner', { name: '桌宠工具小屋' })).toBeVisible();
    await expect(management).toHaveURL(managementUrl);
    await expect(management.locator('#question')).toHaveValue(draft);
    await expect(management.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    await expect(management.getByRole('banner', { name: '桌宠工具小屋' })).toHaveCount(0);
  });
  await verify('return_hides_only_pet_tool_and_reopen_keeps_its_renderer', async () => {
    await tool.getByRole('button', { name: '返回桌宠全部功能' }).click();
    await expect.poll(async () => (await windowState()).find(window => window.title === '微光指引桌宠 · 工具小屋')?.visible).toBe(false);
    const managementState = (await windowState()).find(window => window.url === management.url());
    assert.equal(managementState?.visible, true);
    assert.match(managementState.title, /^微光指引 · (?:管理中心|陪你慢慢学会)$/);
    await expect(management.locator('#question')).toHaveValue(draft);
    await pet.evaluate(() => window.nuanbanPet.openTool('/chat/new'));
    await expect(tool).toHaveURL(/#\/chat\/new$/);
    assert.equal(await tool.evaluate(() => performance.timeOrigin), toolTimeOrigin);
    assert.equal((await application.windows()).length, 5);
  });
  await verify('client_can_close_and_reopen_without_changing_pet_tool', async () => {
    await management.close();
    await expect.poll(async () => (await application.windows()).length).toBe(4);
    assert.equal(await tool.evaluate(() => window.nuanbanWorkspace.status()), 'pet-tool');
    await pet.evaluate(() => window.nuanbanPet.openMain('/notes'));
    const reopened = (await application.windows()).find(page => page !== tool && clientPage(page));
    assert(reopened);
    await expect(reopened.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    assert.equal(await reopened.evaluate(() => window.nuanbanWorkspace.status()), 'management');
    await tool.close();
    await expect.poll(async () => (await application.windows()).length).toBe(4);
    await expect(reopened.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    await reopened.close();
    await expect.poll(async () => (await application.windows()).length).toBe(3);
  });
  await verify('window_separation_does_not_enable_screen_or_microphone', async () => {
    const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
    assert.equal(state.observation.captureActive, false);
    assert.equal(state.wake.microphoneActive, false);
    assert.equal(await application.evaluate(() => global.__nuanbanSmoke.screenRequestAttempts), 0);
    assert.deepEqual(pageErrors, []);
  });
  const report = { generatedAt: new Date().toISOString(), evidence: 'Real Electron windows with isolated user data; no user screen or microphone authorization', checks, pageErrors, screenRequestAttempts: 0 };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, report: path.join(output, 'results.json'), managementScreenshot: path.join(output, 'management-unchanged.png'), toolScreenshot: path.join(output, 'pet-tool-independent.png') }));
} finally {
  await application.close();
}
