import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page) {
  await page.route('http://127.0.0.1:41876/**', async route => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!['guide.html', 'guide.css', 'guide.js'].includes(filename)) return route.abort();
    await route.fulfill({ body: readFileSync(new URL(`../../apps/desktop/${filename}`, import.meta.url)),
      contentType: filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css' : 'text/javascript' });
  });
  await page.addInitScript(() => {
    let listener: ((state: unknown) => void) | undefined;
    Object.assign(window, { nuanbanGuide: { onState: (callback: typeof listener) => { listener = callback; return () => { listener = undefined; }; } } });
    window.addEventListener('test-guide-state', event => listener?.((event as CustomEvent).detail));
  });
  await page.clock.install();
  await page.goto('http://127.0.0.1:41876/guide.html');
}

async function showTarget(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test-guide-state', { detail: {
    visible: true, rect: { x: 640, y: 500, width: 60, height: 60 }, label: '微信',
    instruction: '请核对图标后亲手双击微信。', presentation: 'uncertain_candidate', expiresAt: Date.now() + 5000,
  } })));
}

test('窗口扩展到整屏前收到坐标，扩展后仍会绘制箭头和目标框', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  await fixture(page);
  await showTarget(page);
  await expect(page.locator('#guide-root')).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#guide-arrow')).toBeVisible();
  await expect(page.locator('#guide-target')).toHaveCSS('left', '640px');
  await expect(page.locator('#guide-target')).toHaveCSS('top', '500px');
});

test('整屏展开前取消的坐标不能在展开后重新出现', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  await fixture(page);
  await showTarget(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test-guide-state', { detail: { visible: false } })));
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#guide-root')).toBeHidden();
});

test('整屏展开前已过期的坐标不能重新出现', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  await fixture(page);
  await showTarget(page);
  await page.clock.fastForward(5001);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#guide-root')).toBeHidden();
});
