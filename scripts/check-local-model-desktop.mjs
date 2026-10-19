import { _electron, expect } from '@playwright/test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createBinaryFbx, createModelFbx, createModelGlb, createModelTexturePng, createModelVrm, modelDocument } from '../tests/fixtures/local-models.ts';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'apps/desktop');
const builtWeb = join(root, 'apps/web/dist');
if (!existsSync(join(builtWeb, 'index.html')) || !existsSync(join(source, 'model-runtime/model-renderer.js'))) throw new Error('请先运行 pnpm --filter @nuanban/web build');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'nuanban-model-check-'));
const desktop = join(temporaryRoot, 'desktop');
const profileParent = process.env.NUANBAN_MODEL_PROFILE_PARENT ? resolve(process.env.NUANBAN_MODEL_PROFILE_PARENT) : null;
const profile = profileParent ? mkdtempSync(join(profileParent, 'nuanban-model-profile-check-')) : join(temporaryRoot, 'profile');
const sessionData = join(temporaryRoot, 'session');
mkdirSync(desktop); if (!profileParent) mkdirSync(profile); mkdirSync(sessionData);
for (const entry of readdirSync(source, { withFileTypes: true })) if (entry.isFile() && /\.(cjs|js|html|css)$/.test(entry.name)) cpSync(join(source, entry.name), join(desktop, entry.name));
for (const directory of ['observation', 'wake', 'model-runtime']) cpSync(join(source, directory), join(desktop, directory), { recursive: true });
cpSync(builtWeb, join(desktop, 'ui'), { recursive: true });
cpSync(builtWeb, join(temporaryRoot, 'web/dist'), { recursive: true });
const entryPath = join(temporaryRoot, 'check-main.cjs');
writeFileSync(entryPath, "const { app } = require('electron');\napp.setPath('userData', " + JSON.stringify(profile)
  + ");\napp.setPath('sessionData', " + JSON.stringify(sessionData) + ");\nrequire(" + JSON.stringify(join(desktop, 'main.cjs')) + ");\n");
const texturedDocument = modelDocument();
texturedDocument.images = [{ uri: 'data:image/png;base64,' + createModelTexturePng().toString('base64') }];
texturedDocument.textures = [{ source: 0 }];
texturedDocument.materials = [{ pbrMetallicRoughness: { baseColorFactor: [0.85, 0.42, 0.2, 1], baseColorTexture: { index: 0 }, roughnessFactor: 0.7 } }];
const fixtures = [
  ['static.glb', createModelGlb()], ['animated.glb', createModelGlb(modelDocument(true))],
  ['ascii.fbx', createModelFbx()], ['binary.fbx', createBinaryFbx()],
  ['humanoid-v1.vrm', createModelVrm('1')], ['humanoid-v0.vrm', createModelVrm('0')],
  ['humanoid-mtoon.vrm', createModelVrm('1', true)], ['textured.glb', createModelGlb(texturedDocument)],
];
for (const [fileName, bytes] of fixtures) writeFileSync(join(temporaryRoot, fileName), bytes);
const badDocument = modelDocument(); badDocument.images = [{ uri: 'https://example.invalid/never-request.png' }];
writeFileSync(join(temporaryRoot, 'external.glb'), createModelGlb(badDocument));
writeFileSync(join(temporaryRoot, 'broken.glb'), 'not a model');
const environment = { ...process.env }; delete environment.ELECTRON_RUN_AS_NODE;
const executablePath = createRequire(join(source, 'package.json'))('electron');
let application;
let management;
let pet;
const diagnostics = [];
async function start() {
  application = await _electron.launch({ executablePath, args: [entryPath, '--management'], env: environment, timeout: 30000 });
  application.context().setDefaultTimeout(15000);
  await expect.poll(() => application.windows().some(page => page.url().endsWith('/pet.html'))).toBe(true);
  await expect.poll(() => application.windows().some(page => page.url().includes('/web/dist/index.html'))).toBe(true);
  management = application.windows().find(page => page.url().includes('/web/dist/index.html'));
  pet = application.windows().find(page => page.url().endsWith('/pet.html'));
  for (const page of [management, pet]) page.on('pageerror', error => diagnostics.push(error.message));
  application.on('window', page => {
    page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
    page.on('pageerror', error => diagnostics.push(error.message));
  });
  expect(await application.evaluate(({ app }) => app.getPath('userData'))).toBe(profile);
  await management.evaluate(() => { location.hash = '/pets'; });
  await expect(management.getByRole('heading', { name: '让你的 3D 伙伴，来到桌面。' })).toBeVisible();
  console.log('临时客户端已启动，沙箱、CSP 和本机模型界面已加载。');
}
async function select(fileName) {
  await application.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, join(temporaryRoot, fileName));
  await management.getByRole('button', { name: '选择本地 3D 模型' }).click();
}
async function checkNoCapture() {
  const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
  expect(state.observation.captureActive).toBe(false);
  expect(state.wake.microphoneActive).not.toBe(true);
}

try {
  await start();
  expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => {
    const preferences = window.webContents.getLastWebPreferences();
    return preferences.sandbox === true && preferences.contextIsolation === true && preferences.nodeIntegration === false;
  }))).toBe(true);
  await expect(pet.locator('#builtin-pet')).toBeVisible();
  expect(await management.evaluate(() => window.nuanbanModel.read())).toEqual({ kind: 'none' });
  await application.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
  await management.getByRole('button', { name: '选择本地 3D 模型' }).click();
  await expect(management.getByText('已取消选择，当前桌宠未更换。')).toBeVisible();
  for (const [fileName] of fixtures) {
    console.log('检查真实解析、WebGL 预览和浮层热切换：' + fileName);
    await select(fileName);
    await expect(management.getByRole('button', { name: '确认设为独立桌宠' })).toBeEnabled({ timeout: 30000 });
    await expect(management.locator('.model-preview canvas')).toBeVisible();
    const before = await management.evaluate(() => window.nuanbanModel.read());
    if (fileName === 'static.glb') expect(before.kind).toBe('none');
    else expect(before.fileName).not.toBe(fileName);
    await management.getByRole('button', { name: '确认设为独立桌宠' }).click();
    await expect(pet.locator('#model-pet')).toBeVisible();
    await expect(pet.locator('#model-pet')).toHaveAttribute('data-format', fileName.endsWith('.vrm') ? 'vrm' : fileName.endsWith('.fbx') ? 'fbx' : 'glb');
    const active = await management.evaluate(() => window.nuanbanModel.read());
    await expect(pet.locator('#model-pet')).toHaveAttribute('data-model-id', active.id);
    await expect(pet.locator('#builtin-pet')).toBeHidden(); await expect(pet.locator('#custom-pet')).toBeHidden();
    expect(active.summary.triangles).toBeGreaterThan(0);
    if (fileName === 'animated.glb') expect(active.summary.animations).toBe(1);
    if (fileName === 'textured.glb') expect(active.summary.textures).toEqual([{ width: 1, height: 1 }]);
    if (fileName === 'static.glb') {
      const image = await pet.locator('#model-pet').screenshot({ omitBackground: true });
      const visiblePixels = await application.evaluate(({ nativeImage }, encoded) => {
        const bitmap = nativeImage.createFromBuffer(Buffer.from(encoded, 'base64')).toBitmap();
        let count = 0;
        for (let offset = 3; offset < bitmap.length; offset += 4) if (bitmap[offset] > 20) count++;
        return count;
      }, image.toString('base64'));
      expect(visiblePixels).toBeGreaterThan(100);
      if (process.env.NUANBAN_MODEL_SCREENSHOT) writeFileSync(resolve(process.env.NUANBAN_MODEL_SCREENSHOT), image);
      if (process.env.NUANBAN_MODEL_PREVIEW_SCREENSHOT) await management.locator('.local-model-panel').screenshot({ path: resolve(process.env.NUANBAN_MODEL_PREVIEW_SCREENSHOT) });
    }
    await checkNoCapture();
  }
  const current = await management.evaluate(() => window.nuanbanModel.read());
  for (const fileName of ['external.glb', 'broken.glb']) {
    await select(fileName);
    await expect(management.locator('.local-model-panel [role="alert"]')).toBeVisible();
    await expect(management.getByRole('button', { name: '确认设为独立桌宠' })).toBeDisabled();
    expect((await management.evaluate(() => window.nuanbanModel.read())).id).toBe(current.id);
    await expect(pet.locator('#model-pet')).toBeVisible();
  }
  console.log('检查关闭管理窗口后桌宠独立运行…');
  await management.close(); await expect(pet.locator('#model-pet canvas')).toBeVisible();
  await application.close(); application = undefined;
  await start();
  console.log('检查重启恢复，以及 3D / 原画双向切换…');
  await expect(pet.locator('#model-pet')).toHaveAttribute('data-model-id', current.id);
  const dataUrl = await application.evaluate(({ nativeImage }) => nativeImage.createFromBitmap(Buffer.from([0, 128, 255, 255]), { width: 1, height: 1 }).toDataURL());
  await management.evaluate(dataUrl => window.nuanbanArtwork.apply({ dataUrl, width: 1, height: 1 }), dataUrl);
  await expect(pet.locator('#custom-pet')).toBeVisible(); await expect(pet.locator('#model-pet')).toBeHidden();
  expect(await management.evaluate(() => window.nuanbanModel.read())).toEqual({ kind: 'none' });
  await select('static.glb'); await expect(management.getByRole('button', { name: '确认设为独立桌宠' })).toBeEnabled({ timeout: 30000 });
  await management.getByRole('button', { name: '确认设为独立桌宠' }).click(); await expect(pet.locator('#model-pet')).toBeVisible();
  await management.getByRole('button', { name: '切回原画 / 内置桌宠' }).click();
  await management.getByRole('button', { name: '确认切回', exact: true }).click();
  await expect(pet.locator('#custom-pet')).toBeVisible(); await expect(pet.locator('#model-pet')).toBeHidden();
  expect((await management.evaluate(() => window.nuanbanArtwork.read())).kind).toBe('drawing');
  await checkNoCapture();
  expect(diagnostics.filter(message => /Content Security Policy|Refused to|Uncaught/.test(message))).toEqual([]);
  console.log('通过：GLB / 动画 / VRM 0.x / VRM 1.0 / ASCII FBX / 压缩二进制 FBX、本地热切换、取消和坏文件回退、关闭管理独立运行、重启恢复及原画保留。');
} catch (error) {
  console.error(diagnostics.join('\n'));
  if (management && !management.isClosed()) console.error((await management.locator('.local-model-panel').innerText().catch(() => '')).slice(-2500));
  throw error;
} finally {
  if (application) await application.close().catch(() => {});
  if (profileParent && dirname(profile) === profileParent && basename(profile).startsWith('nuanban-model-profile-check-')) rmSync(profile, { recursive: true, force: true });
  if (resolve(temporaryRoot).startsWith(resolve(tmpdir()) + '\\') || resolve(temporaryRoot).startsWith(resolve(tmpdir()) + '/')) rmSync(temporaryRoot, { recursive: true, force: true });
}
