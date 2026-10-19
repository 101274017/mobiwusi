import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const sdkFixture = `export default class SyntheticAvatar {
  constructor(options) {
    this.options = options;
    window.avatarAudit.options = { audio: options.audio, reconnect: options.reconnect, sentry: options.sentry };
    window.avatarAudit.dimensions = { width: options.container.offsetWidth, height: options.container.offsetHeight };
  }
  setVolume(value) { window.avatarAudit.volume = value; }
  async init({onDownloadProgress}) {
    await fetch(this.options.gatewayServer, { method: 'POST', body: JSON.stringify({ request_id: 'synthetic-request' }) });
    onDownloadProgress(100);
    if (window.avatarMode === 'pending') await new Promise(resolve => window.addEventListener('synthetic-avatar-resolve', resolve, { once: true }));
    if (window.avatarMode === 'error') { this.options.agentCallbacks.onError({ code: 'synthetic-error' }); throw new Error('synthetic-error'); }
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
    this.options.container.append(canvas);
    this.options.onRenderChange('rendering');
  }
  async destroy() { window.avatarAudit.destroyed++; this.options.container.replaceChildren(); }
}`;

async function fixture(page: Page, mode = 'ready') {
  await page.route('http://127.0.0.1:41874/**', async route => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (filename === 'avatar-runtime/default-pet.json') return route.fulfill({ body: 'export default ' + readFileSync(new URL('../../apps/desktop/default-pet.json', import.meta.url), 'utf8'), contentType: 'text/javascript' });
    if (filename === 'assets/xingyun-monkey-preview.png') return route.fulfill({ body: readFileSync(new URL('../../apps/desktop/assets/xingyun-monkey-preview.png', import.meta.url)), contentType: 'image/png' });
    if (filename === 'avatar-runtime/sdk-fixture.js') return route.fulfill({ body: sdkFixture, contentType: 'text/javascript' });
    if (filename === 'avatar-runtime/xingyun-renderer.js') return route.fulfill({ body: readFileSync(new URL('../../apps/desktop/xingyun-renderer.js', import.meta.url), 'utf8').replace("'@xmov/avatar/agent'", "'./sdk-fixture.js'"), contentType: 'text/javascript' });
    if (!['pet.html', 'pet.css', 'pet.js', 'pet-artwork.js'].includes(filename)) return route.abort();
    return route.fulfill({ body: readFileSync(new URL('../../apps/desktop/' + filename, import.meta.url)), contentType: filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css' : 'text/javascript' });
  });
  await page.addInitScript(({ mode }) => {
    const audit = { begins: 0, exchanges: 0, stops: 0, failures: 0, destroyed: 0, management: 0, microphones: 0 };
    let listener: ((value: unknown) => void) | undefined;
    let state = { configured: true, phase: 'idle', message: '本机应用已配置', appId: 'synthetic-application' };
    const publish = (phase: string, message: string) => { state = { ...state, phase, message }; listener?.(state); return state; };
    const runtime = { observation: { state: 'off', generation: 1, captureActive: false }, task: { state: 'idle' }, analysis: { state: 'idle' }, captions: { enabled: false }, wake: { state: 'disabled', microphoneActive: false }, voice: { active: false, microphoneActive: false } };
    Object.assign(window, { avatarAudit: audit, avatarMode: mode, nuanbanPet: {
      snapshot: async () => runtime, onState: () => () => {}, onPanel: () => () => {}, command: async () => ({ ok: true }),
      openMain: async () => { audit.management++; }, openTool: async () => { audit.management++; }, dictate: async () => { audit.microphones++; }, showMenu: async () => true,
    }, nuanbanAvatar: {
      status: async () => state, onState: (callback: (value: unknown) => void) => { listener = callback; return () => { listener = undefined; }; },
      begin: async (consent: boolean) => { if (!consent) throw new Error('consent required'); audit.begins++; publish('connecting', '正在连接'); return { lease: 'synthetic-lease', appId: state.appId, gatewayServer: 'https://nuanban-xingyun.invalid/session' }; },
      exchange: async () => { audit.exchanges++; return { status: 200, body: { error_code: 0, data: { resource_pack: {} } } }; },
      ready: async () => { publish('ready', '小猴子已启用'); return true; },
      fail: async () => { audit.failures++; return publish('error', '加载失败；不会自动重连'); },
      stop: async () => { audit.stops++; publish('stopping', '正在停止'); return { stopped: true, ...publish('idle', '云端会话已停止，恢复本机桌宠') }; },
    } });
  }, { mode });
  await page.goto('http://127.0.0.1:41874/pet.html');
  await page.waitForLoadState('networkidle');
  await page.locator('#pet-toggle').click();
  await page.locator('#feature-avatar').click();
  await expect(page.locator('#avatar-view')).toBeVisible();
}

async function audit(page: Page) { return page.evaluate(() => (window as unknown as { avatarAudit: Record<string, unknown> }).avatarAudit); }

test('独立形象页面浏览和切页不会连接云端或打开客户端', async ({ page }) => {
  await fixture(page);
  await expect(page.locator('#feature-home')).toBeHidden();
  await expect(page.locator('#lesson-card')).toBeHidden();
  await expect(page.locator('#voice-section')).toBeHidden();
  await expect(page.locator('#avatar-start')).toBeDisabled();
  await expect(page.locator('#builtin-pet')).toBeVisible();
  await expect(page.locator('#builtin-pet')).toHaveAttribute('data-avatar-id', 'xingyun-monkey');
  expect(await page.locator('#builtin-pet').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#fallback-cat-pet')).toBeHidden();
  await page.locator('#view-features').click();
  await expect(page.locator('#avatar-view')).toBeHidden();
  await page.locator('#feature-avatar').click();
  expect(await audit(page)).toMatchObject({ begins: 0, exchanges: 0, management: 0, microphones: 0 });
});

test('明确启用才显示形象，容器非零；停止恢复原桌宠且重新要求确认', async ({ page }) => {
  await fixture(page);
  await page.locator('#avatar-consent').check();
  await page.locator('#avatar-start').click();
  await expect(page.locator('#avatar-status')).toHaveAttribute('data-phase', 'ready');
  await expect(page.locator('#xingyun-pet')).toBeVisible();
  await expect(page.locator('#builtin-pet')).toBeHidden();
  const running = await audit(page);
  expect(running).toMatchObject({ begins: 1, exchanges: 1, volume: 0, options: { audio: { inputEnabled: false }, reconnect: { enabled: false, maxAttempts: 0 }, sentry: { enabled: false } } });
  expect((running.dimensions as { width: number }).width).toBeGreaterThan(0);
  expect((running.dimensions as { height: number }).height).toBeGreaterThan(0);
  await page.locator('#avatar-stop').click();
  await expect(page.locator('#xingyun-pet')).toBeHidden();
  await expect(page.locator('#builtin-pet')).toBeVisible();
  await expect(page.locator('#avatar-start')).toBeDisabled();
  expect(await audit(page)).toMatchObject({ begins: 1, destroyed: 1, stops: 1, microphones: 0 });
});

test('资源失败退回原桌宠，不自动重连', async ({ page }) => {
  await fixture(page, 'error');
  await page.locator('#avatar-consent').check();
  await page.locator('#avatar-start').click();
  await expect(page.locator('#avatar-status')).toHaveAttribute('data-phase', 'error');
  await expect(page.locator('#xingyun-pet')).toBeHidden();
  await expect(page.locator('#builtin-pet')).toBeVisible();
  await page.waitForTimeout(700);
  expect(await audit(page)).toMatchObject({ begins: 1, exchanges: 1, failures: 1, destroyed: 1 });
  await expect(page.locator('#avatar-start')).toBeDisabled();
});

test('加载中停止，迟到的初始化结果不能重新显示或创建会话', async ({ page }) => {
  await fixture(page, 'pending');
  await page.locator('#avatar-consent').check();
  await page.locator('#avatar-start').click();
  await expect.poll(async () => (await audit(page)).exchanges).toBe(1);
  await page.locator('#avatar-stop').click();
  await page.evaluate(() => window.dispatchEvent(new Event('synthetic-avatar-resolve')));
  await expect(page.locator('#avatar-status')).toHaveAttribute('data-phase', 'idle');
  await expect(page.locator('#xingyun-pet')).toBeHidden();
  await expect(page.locator('#builtin-pet')).toBeVisible();
  expect(await audit(page)).toMatchObject({ begins: 1, destroyed: 1, stops: 1 });
});
