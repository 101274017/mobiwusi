import { expect, test } from '@playwright/test';

const question = '我不会调整手机字体，怎么学？';
async function openScenario(page: import('@playwright/test').Page, scenario: string, route = '/chat/new') {
  await page.goto('/?scenario=' + scenario + '#' + route);
}
async function ask(page: import('@playwright/test').Page) {
  await page.getByLabel('想问暖伴的问题').fill(question);
  await page.getByRole('button', { name: '发送', exact: true }).click();
}
async function openAssistFixture(page: import('@playwright/test').Page, fixture: 'normal' | 'unanswered') {
  await page.goto('/?scenario=success&assist=' + fixture + '#/family');
  await page.getByRole('button', { name: '添加演示家属' }).click();
  await page.getByRole('button', { name: '确认添加演示关系' }).click();
  await page.getByRole('link', { name: '协助状态演示' }).click();
  await expect(page.getByRole('heading', { name: '亲情协助状态演示', exact: true })).toBeVisible();
}

test('验收台列出 13 个可重放场景且移动端无溢出', async ({ page }) => {
  await openScenario(page, 'success', '/development/scenarios');
  await expect(page.getByRole('heading', { name: '开发验收场景', exact: true })).toBeVisible();
  await expect(page.locator('.scenario-card')).toHaveCount(13);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('验收台切换使用同文档地址，新场景优先于旧查询参数', async ({ page }) => {
  await openScenario(page, 'success', '/development/scenarios');
  await page.getByRole('link', { name: '切换到网络断开', exact: true }).click();
  await expect(page.getByRole('heading', { name: '和暖伴说说', exact: true })).toBeVisible();
  await ask(page);
  await expect(page.getByRole('alert', { name: '讲解未完成' })).toContainText('网络暂时连不上');
});

for (const [scenario, expected] of [
  ['timeout', '讲解等待超时了'], ['offline', '网络暂时连不上'],
  ['provider-quota', '演示配额不足'], ['stream-interrupted', '讲解中途断开了'],
  ['partial-failure', '只完成了部分讲解'],
]) {
  test(scenario + ' 保留输入，不保存未完成笔记', async ({ page }) => {
    await openScenario(page, scenario);
    await ask(page);
    await expect(page.getByRole('alert', { name: '讲解未完成' })).toContainText(expected);
    await expect(page.getByLabel('想问暖伴的问题')).toHaveValue(question);
    await expect(page.getByRole('button', { name: '再讲一遍' })).toBeDisabled();
    await page.getByRole('button', { name: '重试这个问题' }).click();
    await expect(page.getByRole('alert', { name: '讲解未完成' })).toContainText(expected);
    await page.goto('/?scenario=' + scenario + '#/notes');
    await expect(page.getByRole('heading', { name: question, exact: true })).toHaveCount(0);
  });
}

test('权限拒绝提供替代入口，不声称获得系统权限', async ({ page }) => {
  await openScenario(page, 'permission-denied');
  await ask(page);
  const error = page.getByRole('alert', { name: '讲解未完成' });
  await expect(error).toContainText('不代表系统权限状态');
  await expect(error.getByRole('link', { name: '先做本机练习' })).toBeVisible();
  await expect(error.getByRole('button', { name: '重试这个问题' })).toHaveCount(0);
});

test('长等待停止后无迟到回复或自动笔记', async ({ page }) => {
  await openScenario(page, 'loading');
  await ask(page);
  await expect(page.getByRole('button', { name: '讲解中', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '随时停止', exact: true }).click();
  await expect(page.locator('.caption')).toHaveText('已停止，本次讲解不会自动恢复。');
  await expect(page.locator('.message[data-state="stopped"]')).toHaveCount(1);
  await page.waitForTimeout(800);
  await expect(page.locator('.caption')).toHaveText('已停止，本次讲解不会自动恢复。');
  await page.goto('/?scenario=loading#/notes');
  await expect(page.getByRole('heading', { name: question, exact: true })).toHaveCount(0);
});

test('敏感文字本机拦截且不出现在消息历史', async ({ page }) => {
  await openScenario(page, 'offline');
  await page.getByLabel('想问暖伴的问题').fill('验证码是123456，要怎么付款？');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.caption')).toContainText('暖伴不会指导这类操作');
  await expect(page.locator('.messages')).not.toContainText('123456');
  await expect(page.locator('.messages')).toContainText('已在本机拦截，未发送');
  await expect(page.getByRole('alert', { name: '讲解未完成' })).toHaveCount(0);
});

test('空资料场景不影响正常场景且只重置本场景', async ({ page }) => {
  await openScenario(page, 'empty', '/notes');
  await expect(page.getByRole('heading', { name: '这里还没有笔记' })).toBeVisible();
  await openScenario(page, 'success', '/notes');
  await expect(page.getByRole('heading', { name: '把手机字体调大', exact: true })).toBeVisible();
  await openScenario(page, 'empty', '/development/scenarios');
  await page.getByRole('button', { name: '重置当前场景', exact: true }).click();
  await page.getByRole('button', { name: '确认重置当前场景', exact: true }).click();
  await expect(page.getByRole('heading', { name: '开发验收场景', exact: true })).toBeVisible();
  await openScenario(page, 'empty', '/notes');
  await expect(page.getByRole('heading', { name: '这里还没有笔记' })).toBeVisible();
  await openScenario(page, 'success', '/notes');
  await expect(page.getByRole('heading', { name: '把手机字体调大', exact: true })).toBeVisible();
});

test('低置信不显示目标，停止后不复活', async ({ page }) => {
  await openScenario(page, 'low-confidence', '/overlay/guide');
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '确认开始练习', exact: true }).click();
  await expect(page.getByText('这一步需要帮助', { exact: true })).toBeVisible();
  await expect(page.locator('.target-glow')).toHaveCount(0);
  await page.getByRole('button', { name: '随时停止', exact: true }).click();
  await expect(page.getByText('教学已停止', { exact: true })).toBeVisible();
});

test('风险夹具只有明确确认后才能恢复教学', async ({ page }) => {
  await openScenario(page, 'risk-pause', '/overlay/guide');
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '确认开始练习', exact: true }).click();
  await expect(page.getByText('安全暂停', { exact: true })).toBeVisible();
  await expect(page.locator('.target-glow')).toHaveCount(0);
  await page.getByRole('button', { name: '我已离开风险场景，重新确认' }).click();
  await expect(page.getByRole('dialog', { name: '开始应用内练习？' })).toBeVisible();
  await page.getByRole('button', { name: '确认开始练习', exact: true }).click();
  await expect(page.getByTestId('guide-done')).toBeVisible();
  await expect(page.getByText('等你亲手点一下', { exact: true })).toBeVisible();
});

test('演示版本冲突不覆盖掌握状态', async ({ page }) => {
  await openScenario(page, 'version-conflict', '/notes/demo-note-font');
  await page.getByRole('button', { name: '我确认已经掌握' }).click();
  await page.getByRole('button', { name: '确认更改状态' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('修改未保存');
  await page.getByRole('button', { name: '关闭窗口' }).click();
  await expect(page.getByText('还想再练练', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('还想再练练', { exact: true })).toBeVisible();
});

test('正常邀请必须接听并确认当次演示后才进入连接状态', async ({ page }) => {
  await openAssistFixture(page, 'normal');
  await page.getByRole('button', { name: '开始模拟邀请' }).click();
  await expect(page.getByText('等待演示接听', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '模拟家属接听' }).click();
  await expect(page.getByText('模拟已接听，等待你确认', { exact: true })).toBeVisible();
  const confirm = page.getByRole('button', { name: '确认本次演示' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: '我了解这只是界面演示' }).check();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByText('模拟连接状态 · 没有真实媒体', { exact: true })).toBeVisible();
});

test('无人接听结束后可以重新发起，且不会自动接通', async ({ page }) => {
  await openAssistFixture(page, 'unanswered');
  await page.getByRole('button', { name: '开始模拟邀请' }).click();
  await expect(page.getByText('无人接听，邀请已结束', { exact: true })).toBeVisible({ timeout: 2_000 });
  await expect(page.getByRole('button', { name: '模拟家属接听' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '确认本次演示' })).toHaveCount(0);
  await page.getByRole('button', { name: '重新发起演示邀请' }).click();
  await expect(page.getByText('准备邀请', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '开始模拟邀请' }).click();
  await expect(page.getByText('无人接听，邀请已结束', { exact: true })).toBeVisible({ timeout: 2_000 });
  await expect(page.getByRole('button', { name: '模拟家属接听' })).toHaveCount(0);
});

test('过期邀请不能接听或自动建立媒体', async ({ page }) => {
  await openScenario(page, 'invite-expired', '/assist/demo-family');
  await page.getByRole('button', { name: '开始模拟邀请' }).click();
  await expect(page.getByText('演示邀请已过期，请重新发起', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '模拟家属接听' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '确认本次演示' })).toHaveCount(0);
});

test('未知场景给出可恢复错误，不静默正常运行', async ({ page }) => {
  await openScenario(page, 'not-a-scenario');
  await expect(page.getByRole('heading', { name: '启动配置不可用' })).toBeVisible();
  await page.getByRole('link', { name: '移除场景参数后重试' }).click();
  await expect(page.getByRole('heading', { name: '你好，今天也有暖伴陪着你。' })).toBeVisible();
});
