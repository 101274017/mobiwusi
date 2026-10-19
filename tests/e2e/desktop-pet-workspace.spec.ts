import { expect, test, type Page } from '@playwright/test';

type WorkspaceTestWindow = Window & {
  syntheticWorkspace: { returning: number; subscribed: boolean; change(mode: 'management' | 'pet-tool'): void; resolveStatus?: (mode: 'management' | 'pet-tool') => void };
};

async function workspaceFixture(page: Page, delayed = false, failReturn = false, mode: 'management' | 'pet-tool' = 'pet-tool') {
  await page.addInitScript(({ delayed, failReturn, mode }) => {
    const current = window as unknown as WorkspaceTestWindow;
    let listener: ((mode: 'management' | 'pet-tool') => void) | undefined;
    const audit: WorkspaceTestWindow['syntheticWorkspace'] = { returning: 0, subscribed: false, change: mode => listener?.(mode) };
    current.syntheticWorkspace = audit;
    current.nuanbanWorkspace = {
      status: () => delayed ? new Promise(resolve => { audit.resolveStatus = resolve; }) : Promise.resolve(mode),
      onMode: callback => { listener = callback; audit.subscribed = true; return () => { listener = undefined; }; },
      returnToPet: async () => { audit.returning++; if (failReturn) throw new Error('synthetic failure'); return true; },
    };
  }, { delayed, failReturn, mode });
  await page.goto('/#/notes');
}

test('桌宠工具保留页面能力，隐藏客户端导航并能返回桌宠功能页', async ({ page }) => {
  await workspaceFixture(page);
  await expect(page.getByRole('banner', { name: '桌宠工具小屋' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主要导航', exact: true })).toBeHidden();
  const tools = page.getByRole('navigation', { name: '桌宠工具快捷入口' });
  await tools.getByRole('link', { name: '待办复习' }).click();
  await expect(page).toHaveURL(/#\/todos$/);
  await expect(page.getByRole('banner', { name: '桌宠工具小屋' })).toBeVisible();
  await page.getByRole('button', { name: '返回桌宠全部功能' }).click();
  expect(await page.evaluate(() => (window as unknown as WorkspaceTestWindow).syntheticWorkspace.returning)).toBe(1);
});

test('独立桌宠工具切页和返回不改变客户端导航、页面或布局', async ({ page }) => {
  const management = await page.context().newPage();
  try {
    await workspaceFixture(management, false, false, 'management');
    await workspaceFixture(page);
    await expect(management.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    await expect(management.locator('.app')).not.toHaveClass(/pet-tool-workspace/);
    await expect(page.locator('.app')).toHaveClass(/pet-tool-workspace/);
    await page.getByRole('navigation', { name: '桌宠工具快捷入口' }).getByRole('link', { name: '待办复习' }).click();
    await expect(page).toHaveURL(/#\/todos$/);
    await page.getByRole('button', { name: '返回桌宠全部功能' }).click();
    await expect(management).toHaveURL(/#\/notes$/);
    await expect(management.locator('.app')).not.toHaveClass(/pet-tool-workspace/);
    await expect(management.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
    await expect(management.getByRole('banner', { name: '桌宠工具小屋' })).toHaveCount(0);
    expect(await management.evaluate(() => (window as unknown as WorkspaceTestWindow).syntheticWorkspace.returning)).toBe(0);
  } finally { await management.close(); }
});

test('迟到的旧模式查询不能覆盖新的桌宠工具事件', async ({ page }) => {
  await workspaceFixture(page, true);
  await page.waitForFunction(() => (window as unknown as WorkspaceTestWindow).syntheticWorkspace.subscribed);
  await page.evaluate(() => {
    const current = (window as unknown as WorkspaceTestWindow).syntheticWorkspace;
    current.change('pet-tool');
    current.resolveStatus?.('management');
  });
  await expect(page.locator('.app')).toHaveClass(/pet-tool-workspace/);
});

test('返回桌宠失败时保留当前工具、页面和明确错误，不伪报返回成功', async ({ page }) => {
  await workspaceFixture(page, false, true);
  await page.getByRole('button', { name: '返回桌宠全部功能' }).click();
  await expect(page.getByRole('alert')).toContainText('未能返回桌宠');
  await expect(page).toHaveURL(/#\/notes$/);
  await expect(page.getByRole('button', { name: '返回桌宠全部功能' })).toBeEnabled();
});
