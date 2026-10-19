import { _electron, expect } from '@playwright/test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'apps', 'desktop');
const builtWeb = join(root, 'apps', 'web', 'dist');
if (!existsSync(join(builtWeb, 'index.html'))) throw new Error('请先运行 pnpm build');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'nuanban-artwork-check-'));
const desktop = join(temporaryRoot, 'desktop');
const developmentWeb = join(temporaryRoot, 'web', 'dist');
const profileParent = process.env.NUANBAN_ARTWORK_PROFILE_PARENT ? resolve(process.env.NUANBAN_ARTWORK_PROFILE_PARENT) : null;
const profile = profileParent ? mkdtempSync(join(profileParent, 'nuanban-artwork-profile-check-')) : join(temporaryRoot, 'profile');
const sessionData = join(temporaryRoot, 'session');
mkdirSync(desktop);
if (!profileParent) mkdirSync(profile);
mkdirSync(sessionData);
for (const entry of readdirSync(source, { withFileTypes: true })) {
  if (entry.isFile() && /\.(cjs|js|html|css)$/.test(entry.name)) cpSync(join(source, entry.name), join(desktop, entry.name));
}
for (const directory of ['observation', 'wake', 'model-runtime']) {
  if (existsSync(join(source, directory))) cpSync(join(source, directory), join(desktop, directory), { recursive: true });
}
cpSync(builtWeb, join(desktop, 'ui'), { recursive: true });
cpSync(builtWeb, developmentWeb, { recursive: true });
const entryPath = join(temporaryRoot, 'check-main.cjs');
writeFileSync(entryPath, "const { app } = require('electron');\napp.setPath('userData', " + JSON.stringify(profile)
  + ");\napp.setPath('sessionData', " + JSON.stringify(sessionData) + ");\nrequire(" + JSON.stringify(join(desktop, 'main.cjs')) + ");\n");
const requireDesktop = createRequire(join(source, 'package.json'));
const executablePath = requireDesktop('electron');
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
let application;

async function start() {
  console.log('启动独立临时 Electron，保留沙箱与 CSP…');
  application = await _electron.launch({ executablePath, args: [entryPath, '--management'], env: environment, timeout: 30000 });
  application.context().setDefaultTimeout(10000);
  application.context().setDefaultNavigationTimeout(15000);
  console.log('Electron 已连接，检查临时资料目录与独立窗口…');
  expect(await application.evaluate(({ app }) => app.getPath('userData'))).toBe(profile);
  await expect.poll(() => application.windows().some(page => /\/web\/dist\/index\.html/.test(page.url()))).toBe(true);
  await expect.poll(() => application.windows().some(page => page.url().endsWith('/pet.html'))).toBe(true);
  const management = application.windows().find(page => /\/web\/dist\/index\.html/.test(page.url()));
  const pet = application.windows().find(page => page.url().endsWith('/pet.html'));
  const diagnostics = [];
  management.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
  management.on('pageerror', error => diagnostics.push(error.message));
  await management.reload({ waitUntil: 'domcontentloaded' });
  await management.evaluate(() => { window.location.hash = '/pets/draw'; });
  try { await expect(management.getByRole('button', { name: '保存本机草稿' })).toBeEnabled(); }
  catch (error) {
    const bundle = readdirSync(join(builtWeb, 'assets')).find(name => /^bootstrap-.*\.js$/.test(name));
    const importError = await management.evaluate(async name => {
      return Promise.race([
        import('./assets/' + name).then(() => 'bootstrap import succeeded', failure => failure.stack ?? String(failure)),
        new Promise(resolve => setTimeout(() => resolve('bootstrap import timed out'), 3000)),
      ]);
    }, bundle);
    console.error(diagnostics.join('\n'), importError);
    throw error;
  }
  console.log('本机原画页面就绪。');
  return { management, pet };
}

try {
  let { management, pet } = await start();
  const sandbox = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => {
    const preferences = window.webContents.getLastWebPreferences();
    return preferences.sandbox === true && preferences.contextIsolation === true && preferences.nodeIntegration === false;
  }));
  expect(sandbox).toBe(true);
  const validationMessage = await management.evaluate(async () => {
    try { await window.nuanbanArtwork.apply({ dataUrl: 'https://example.invalid/never-fetch.png', width: 1, height: 1 }); }
    catch (error) { return error.message; }
    return '';
  });
  expect(validationMessage).toContain('只接受本机预览产生的 PNG 原画');
  expect(validationMessage).not.toContain('Error invoking remote method');
  await expect(pet.locator('#builtin-pet')).toBeVisible();
  const canvas = management.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('原画画布未就绪');
  await management.mouse.move(bounds.x + 80, bounds.y + 80);
  await management.mouse.down();
  await management.mouse.move(bounds.x + 150, bounds.y + 130, { steps: 8 });
  await management.mouse.move(bounds.x + 210, bounds.y + 75, { steps: 8 });
  await management.mouse.up();
  await management.getByRole('button', { name: '保存本机草稿' }).click();
  await management.getByRole('button', { name: '预览原画桌宠' }).click();
  await expect(management.getByRole('dialog', { name: '原画桌宠预览' })).toBeVisible();
  await expect(pet.locator('#custom-pet')).toBeHidden();
  if (process.env.NUANBAN_ARTWORK_SCREENSHOT_DIR) {
    mkdirSync(process.env.NUANBAN_ARTWORK_SCREENSHOT_DIR, { recursive: true });
    await management.screenshot({ path: join(process.env.NUANBAN_ARTWORK_SCREENSHOT_DIR, 'local-artwork-preview.png') });
  }
  await management.getByRole('button', { name: '直接设为桌宠', exact: true }).click();
  await expect(management.getByRole('dialog')).toHaveCount(0);
  await expect(pet.locator('#custom-pet')).toBeVisible();
  await expect(pet.locator('#builtin-pet')).toBeHidden();
  expect(await pet.locator('#custom-pet').evaluate(image => image.naturalWidth > 0 && image.complete)).toBe(true);
  expect(existsSync(join(profile, 'nuanban-original-pet.png'))).toBe(true);
  const firstImage = await pet.locator('#custom-pet').getAttribute('src');
  await canvas.scrollIntoViewIfNeeded();
  const nextBounds = await canvas.boundingBox();
  if (!nextBounds) throw new Error('再次绘画前画布不可见');
  await management.mouse.move(nextBounds.x + 80, nextBounds.y + 160);
  await management.mouse.down();
  await management.mouse.move(nextBounds.x + 190, nextBounds.y + 210, { steps: 8 });
  await management.mouse.up();
  await expect(management.getByRole('button', { name: '预览原画桌宠' })).toBeDisabled();
  await management.getByRole('button', { name: '保存本机草稿' }).click();
  await management.getByRole('button', { name: '预览原画桌宠' }).click();
  await expect(management.getByRole('dialog', { name: '原画桌宠预览' })).toBeVisible();
  expect(await pet.locator('#custom-pet').getAttribute('src')).toBe(firstImage);
  await management.getByRole('button', { name: '直接设为桌宠', exact: true }).click();
  await expect(management.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => await pet.locator('#custom-pet').getAttribute('src') === firstImage).toBe(false);
  expect(existsSync(join(profile, 'nuanban-original-pet.png.previous'))).toBe(false);
  await pet.locator('#pet-toggle').click();
  await expect(pet.locator('#pet-panel')).toBeVisible();
  await pet.locator('#collapse-panel').click();
  await expect(pet.locator('#pet-panel')).toBeHidden();
  if (process.env.NUANBAN_ARTWORK_SCREENSHOT_DIR) await pet.screenshot({ path: join(process.env.NUANBAN_ARTWORK_SCREENSHOT_DIR, 'local-artwork-floating-pet.png') });
  await management.close();
  await expect(pet.locator('#custom-pet')).toBeVisible();
  const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
  expect(state.observation.captureActive).toBe(false);
  console.log('应用与热切换通过，检查重启持久化…');
  await application.close();
  application = undefined;
  ({ management, pet } = await start());
  await expect(pet.locator('#custom-pet')).toBeVisible();
  await expect(management.getByAltText('当前悬浮桌宠原画')).toBeVisible();
  await expect(management.getByRole('button', { name: '撤销', exact: true })).toBeEnabled();
  await management.getByRole('button', { name: '恢复内置桌宠' }).click();
  await expect(pet.locator('#custom-pet')).toBeHidden();
  await expect(pet.locator('#builtin-pet')).toBeVisible();
  await expect(management.getByRole('button', { name: '撤销', exact: true })).toBeEnabled();
  expect(existsSync(join(profile, 'nuanban-original-pet.png'))).toBe(false);
  console.log('本机 Electron 原画流程通过：保存 → 透明预览 → 确认应用 → 再次替换 → 悬浮热切换 → 关闭管理页仍运行 → 重启恢复 → 恢复内置。使用独立临时资料，未开启屏幕或麦克风采集。');
} finally {
  if (application) await application.close();
  if (profileParent) {
    if (dirname(resolve(profile)) !== profileParent || !basename(profile).startsWith('nuanban-artwork-profile-check-')) throw new Error('临时资料目录边界不符，停止清理');
    rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
  }
  if (dirname(resolve(temporaryRoot)) !== resolve(tmpdir()) || !basename(temporaryRoot).startsWith('nuanban-artwork-check-')) throw new Error('临时测试目录边界不符，停止清理');
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
}
