import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e',
  testMatch: ['desktop-guide-overlay.spec.ts', 'desktop-pet-guidance.spec.ts', 'desktop-pet-single-frame.spec.ts'],
  outputDir: '../../.cache/guide-functional-views',
  fullyParallel: false,
  workers: 1,
  use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, trace: 'retain-on-failure' },
});
