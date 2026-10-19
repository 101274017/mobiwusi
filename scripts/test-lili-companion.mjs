import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(workspace, '.cache', `lili-companion-${Date.now()}`);
const desktopPackage = createRequire(path.join(workspace, 'apps', 'desktop', 'package.json'));
const executablePath = path.join(path.dirname(desktopPackage.resolve('electron/package.json')), 'dist', 'electron.exe');
assert.equal(process.platform, 'win32', '此验收针对真实 Windows 客户端');
assert(existsSync(executablePath), '请先安装项目已有 Electron 依赖');
assert(existsSync(path.join(workspace, 'apps', 'web', 'dist', 'index.html')), '请先构建管理端页面');
await mkdir(output, { recursive: true });
const environment = { ...process.env, NUANBAN_LILI_TEST_USER_DATA: output, NUANBAN_DESKTOP_PET: '' };
delete environment.ELECTRON_RUN_AS_NODE;
const application = await _electron.launch({ executablePath, env: environment, timeout: 30000,
  args: [path.join(workspace, 'tests', 'helpers', 'lili-electron-smoke.cjs'), '--management', '--pet-display-compatible', '--client-display-compatible'] });
const checks = [];
const pageErrors = [];
const report = { date: new Date().toISOString(), platform: process.platform, electron: desktopPackage('electron/package.json').version,
  checks, pageErrors, status: 'running', notVerified: ['Windows 10 实机', '发布免安装包', '云端同步'] };
for (const page of await application.windows()) page.on('pageerror', error => pageErrors.push(error.message));
application.on('window', page => page.on('pageerror', error => pageErrors.push(error.message)));

try {
  let management;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    management = (await application.windows()).find(page => /\/(?:dist|ui)\/index\.html/.test(page.url()));
    if (management) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(management, '管理窗口未打开');
  await management.goto(management.url().split('#')[0] + '#/pets');
  await management.waitForLoadState('networkidle');
  const option = management.getByRole('button', { name: '栗栗小鹿', exact: true });
  await option.click();
  await management.waitForFunction(() => document.querySelector('.pet-editor-candidate img')?.naturalWidth === 384);
  const preview = await management.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 384;
    const context = canvas.getContext('2d');
    context.drawImage(document.querySelector('.pet-editor-candidate img'), 0, 0);
    return { cornerAlpha: context.getImageData(0, 0, 1, 1).data[3],
      disabled: [...document.querySelectorAll('.pet-tuning-fields select, .pet-tuning-fields input')].every(element => element.disabled) };
  });
  assert.equal(preview.cornerAlpha, 0);
  assert.equal(preview.disabled, true);
  assert.equal(await application.evaluate(() => global.__liliSmoke.host.lili.snapshot().enabled), false);
  await management.screenshot({ path: path.join(output, 'my-companion-lili.png'), fullPage: true });
  checks.push('客户端栗栗透明预览、固定形象与选择不影响桌宠');

  await management.getByRole('button', { name: '预览满意，确认应用' }).click();
  await management.getByRole('button', { name: '确认应用到本机' }).click();
  await management.getByRole('dialog').waitFor({ state: 'hidden' });
  await management.reload();
  await management.waitForFunction(() => [...document.querySelectorAll('.pet-kind-options button')].some(button => button.textContent === '栗栗小鹿' && button.getAttribute('aria-pressed') === 'true'));
  checks.push('确认保存后刷新保持栗栗角色');

  await management.getByRole('button', { name: '调用栗栗桌宠' }).click();
  await management.getByText('栗栗 1.0.0 已切换并显示在桌面。', { exact: true }).waitFor();
  const pet = (await application.windows()).find(page => page.url().endsWith('/pet.html'));
  assert(pet, '独立桌宠窗口不存在');
  await pet.locator('#lili-pet[data-ready="true"]').waitFor({ state: 'visible' });
  assert.equal((await pet.evaluate(() => window.nuanbanLili.command({ type: 'resource.describe' }))).resource.id, 'lili');
  assert.equal(await application.evaluate(() => global.__liliSmoke.host.getPetWindow().isVisible()), true);
  await pet.screenshot({ path: path.join(output, 'lili-called.png'), omitBackground: true });
  checks.push('真实管理 preload/IPC 切换并渲染既有栗栗桌宠');

  const hidden = await pet.evaluate(() => window.nuanbanLili.command({ type: 'display.set', options: { visible: false, clickThrough: true } }));
  assert.equal(hidden.ok, true);
  assert.equal(await application.evaluate(() => global.__liliSmoke.host.getPetWindow().isVisible()), false);
  await management.getByRole('button', { name: '调用栗栗桌宠' }).click();
  await management.getByText('栗栗 1.0.0 已切换并显示在桌面。', { exact: true }).waitFor();
  const revived = await application.evaluate(() => ({ visible: global.__liliSmoke.host.getPetWindow().isVisible(), view: global.__liliSmoke.host.lili.snapshot().view }));
  assert.equal(revived.visible, true);
  assert.equal(revived.view.clickThrough, false);
  checks.push('再次调用恢复隐藏角色并关闭鼠标穿透');

  await management.getByRole('button', { name: '撤回上次应用' }).click();
  await management.getByRole('button', { name: '确认撤回', exact: true }).click();
  await management.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await management.getByRole('button', { name: '小橘猫', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await application.evaluate(() => global.__liliSmoke.host.lili.snapshot().enabled), true);
  checks.push('伙伴撤回恢复原配置，与显式桌宠调用互不混淆');
  assert.equal(await application.evaluate(() => global.__liliSmoke.screenRequests), 0);
  assert.deepEqual(pageErrors, []);
  checks.push('未触发屏幕采集，页面无未处理错误');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack || error.message;
  process.exitCode = 1;
} finally {
  await application.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, output }, null, 2));
}
