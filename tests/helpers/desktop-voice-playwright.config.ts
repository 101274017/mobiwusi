import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e',
  testMatch: 'desktop-realtime-voice.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true },
});
