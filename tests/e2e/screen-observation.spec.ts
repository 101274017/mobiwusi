import { expect, test, type Page } from '@playwright/test';
import type { LocalObservationStatus } from '../../apps/web/src/local-observation';

async function installSyntheticBridge(page: Page, initialState: 'off' | 'privacy_paused' | 'observing' = 'off', failStop = false) {
  await page.addInitScript(({ initialState, failStop }) => {
    let status: LocalObservationStatus = { state: initialState, captureActive: initialState === 'observing', sourceName: '合成测试屏幕', cloudConfigured: false };
    const audit = { starts: 0, resumes: 0, stops: 0, shows: 0 };
    Object.defineProperty(window, 'syntheticObservationAudit', { value: audit });
    window.nuanbanObservation = {
      status: async () => ({ ...status }),
      start: async () => { audit.starts++; status = { ...status, state: 'observing', captureActive: true }; return { ...status }; },
      resume: async () => { audit.resumes++; status = { ...status, state: 'observing', captureActive: true }; return { ...status }; },
      stop: async () => { audit.stops++; if (failStop) throw new Error('synthetic-stop-failure'); status = { ...status, state: 'stopped', captureActive: false }; return { ...status }; },
      showPet: async () => { audit.shows++; return { ...status }; },
    };
  }, { initialState, failStop });
}

async function openScreenPanel(page: Page) {
  await page.goto('/#/chat/new');
  await page.getByRole('button', { name: '屏幕', exact: true }).click();
  return page.getByRole('dialog', { name: '真实屏幕观察', exact: true });
}

test('普通浏览器明确引导桌宠，不伪装真实采集', async ({ page }) => {
  const dialog = await openScreenPanel(page);
  await expect(dialog).toContainText('真实屏幕观察由独立 Windows 桌宠提供');
  await expect(dialog.getByRole('button', { name: '选择屏幕并开启真实观察' })).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: '返回文字问答' })).toBeVisible();
});

test('合成桥接验证本人显式开启、关闭说明后仍观察、主动停止；不捕获屏幕', async ({ page }) => {
  await installSyntheticBridge(page);
  const dialog = await openScreenPanel(page);
  const start = dialog.getByRole('button', { name: '选择屏幕并开启真实观察' });
  await expect(start).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { syntheticObservationAudit: { starts: number } }).syntheticObservationAudit.starts)).toBe(0);
  await start.click();
  await expect(dialog.getByText('真实屏幕正在本地观察', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('未配置，不会使用模拟答案替代');
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.getByRole('button', { name: '屏幕', exact: true }).click();
  await expect(dialog.getByText('真实屏幕正在本地观察', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '停止真实观察', exact: true }).click();
  await expect(dialog).toContainText('观察已停止，不会自动恢复');
  expect(await page.evaluate(() => (window as unknown as { syntheticObservationAudit: { starts: number; stops: number } }).syntheticObservationAudit)).toMatchObject({ starts: 1, stops: 1 });
});

test('隐私暂停不会自动恢复，必须本人选择继续', async ({ page }) => {
  await installSyntheticBridge(page, 'privacy_paused');
  const dialog = await openScreenPanel(page);
  await expect(dialog).toContainText('隐私保护已暂停采集和发送');
  await page.waitForTimeout(2100);
  expect(await page.evaluate(() => (window as unknown as { syntheticObservationAudit: { resumes: number } }).syntheticObservationAudit.resumes)).toBe(0);
  await dialog.getByRole('button', { name: '本人确认继续共享', exact: true }).click();
  await expect(dialog.getByText('真实屏幕正在本地观察', { exact: true })).toBeVisible();
});

test('停止失败不会显示停止成功，轮询不能擦掉失败提示', async ({ page }) => {
  await installSyntheticBridge(page, 'observing', true);
  const dialog = await openScreenPanel(page);
  await expect(dialog.getByText('真实屏幕正在本地观察', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '停止真实观察', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('停止未确认');
  await page.waitForTimeout(2100);
  await expect(dialog.getByRole('alert')).toContainText('停止未确认');
  await expect(dialog.getByText('真实屏幕正在本地观察', { exact: true })).toBeVisible();
});
