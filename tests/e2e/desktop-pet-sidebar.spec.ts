import { expect, test, type Page } from '@playwright/test';
import type { LocalObservationStatus } from '../../apps/web/src/local-observation';

type SidebarPetWindow = Window & {
  syntheticSidebarPetAudit: { shows: number; starts: number; resumes: number; stops: number };
  finishSyntheticSidebarPet?: () => void;
};

async function installBridge(page: Page, mode: 'success' | 'failure' | 'pending' = 'success') {
  await page.addInitScript(({ mode }) => {
    const current = window as unknown as SidebarPetWindow;
    const status: LocalObservationStatus = { state: 'off', captureActive: false, sourceName: '', cloudConfigured: false };
    const audit = { shows: 0, starts: 0, resumes: 0, stops: 0 };
    current.syntheticSidebarPetAudit = audit;
    window.nuanbanObservation = {
      status: async () => ({ ...status }),
      start: async () => { audit.starts++; return { ...status }; },
      resume: async () => { audit.resumes++; return { ...status }; },
      stop: async () => { audit.stops++; return { ...status }; },
      showPet: async () => {
        audit.shows++;
        if (mode === 'failure') throw new Error('合成测试：桌宠恢复失败');
        if (mode === 'pending') await new Promise<void>(resolve => { current.finishSyntheticSidebarPet = resolve; });
        return { ...status };
      },
    };
  }, { mode });
}

async function openSidebar(page: Page) {
  await page.goto('/#/notes');
  await expect(page.locator('.sidebar')).toBeAttached();
  const menu = page.getByRole('button', { name: '展开导航', exact: true });
  if (await menu.isVisible()) await menu.click();
  return page.getByRole('navigation', { name: '主要导航', exact: true }).getByRole('button', { name: '打开桌宠', exact: true });
}

test('左侧可直接显示桌宠，不跳转页面或开启采集，移动端成功后收起导航', async ({ page }) => {
  await installBridge(page);
  const button = await openSidebar(page);
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole('status')).toContainText('桌宠已显示在桌面');
  await expect(page).toHaveURL(/#\/notes$/);
  expect(await page.evaluate(() => (window as unknown as SidebarPetWindow).syntheticSidebarPetAudit)).toEqual({ shows: 1, starts: 0, resumes: 0, stops: 0 });
  await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
});

test('打开桌宠支持键盘操作', async ({ page }) => {
  await installBridge(page);
  const button = await openSidebar(page);
  await button.focus();
  await button.press('Enter');
  await expect(page.getByRole('status')).toContainText('桌宠已显示在桌面');
  expect(await page.evaluate(() => (window as unknown as SidebarPetWindow).syntheticSidebarPetAudit.shows)).toBe(1);
});

test('等待恢复期间禁用按钮，不重复打开', async ({ page }) => {
  await installBridge(page, 'pending');
  const button = await openSidebar(page);
  await button.click();
  const pending = page.getByRole('button', { name: '正在打开桌宠…', exact: true });
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute('aria-busy', 'true');
  expect(await page.evaluate(() => (window as unknown as SidebarPetWindow).syntheticSidebarPetAudit.shows)).toBe(1);
  await page.evaluate(() => (window as unknown as SidebarPetWindow).finishSyntheticSidebarPet?.());
  await expect(page.getByRole('status')).toContainText('桌宠已显示在桌面');
});

test('恢复失败显示错误，不伪报桌宠已经打开', async ({ page }) => {
  await installBridge(page, 'failure');
  const button = await openSidebar(page);
  await button.click();
  await expect(page.getByRole('alert')).toContainText('合成测试：桌宠恢复失败');
  await expect(button).toBeEnabled();
  await expect(page.getByText('桌宠已显示在桌面。', { exact: true })).toHaveCount(0);
});

test('浏览器显示当前页面陪伴，并明确不替换系统桌宠', async ({ page }) => {
  const button = await openSidebar(page);
  await button.click();
  await expect(page.locator('[aria-label="网页陪伴：小橘猫"]')).toContainText('小橘猫在这里陪你');
  await expect(page.getByRole('status')).toContainText('小橘猫已显示在当前页面');
  await expect(page.locator('[aria-label="网页陪伴：小橘猫"]')).toContainText('不会替换系统桌宠');
});
