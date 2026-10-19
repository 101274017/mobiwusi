import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e',
  testMatch: ['desktop-pet-features.spec.ts', 'desktop-pet-search.spec.ts', 'desktop-pet-avatar.spec.ts'],
  outputDir: '../../.cache/pet-functional-views',
  fullyParallel: false,
  workers: 1,
  use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'pet-desktop', use: { viewport: { width: 400, height: 760 } } },
    { name: 'pet-compact', use: { viewport: { width: 330, height: 520 } } },
  ],
});
