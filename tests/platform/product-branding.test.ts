import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && entry.name === 'assets') return [];
    const file = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(tsx?|kt|xml|css|html)$/.test(file) ? [file] : [];
  });
}

const desktopSurfaces = [
  'ai-provider.cjs', 'caption.html', 'guide.html', 'guide.js', 'main.cjs',
  'management-window-visibility.cjs', 'model-validator.html', 'notification-adapter.cjs',
  'pet-preload.cjs', 'pet-tool-window.cjs', 'pet.html', 'pet.js', 'realtime-voice-host.cjs',
  'realtime-voice.html', 'realtime-voice.js', 'runtime-coordinator.cjs', 'standalone-host.cjs',
  'observation/region-selector.cjs', 'observation/region-selector.html', 'voice/local-voice-host.cjs',
  'native-lab/canary.html', 'native-lab/control.html', 'native-lab/main.cjs', 'package.json',
].map(file => join('apps/desktop', file));

const surfaces = [
  'apps/web/index.html', ...sourceFiles('apps/web/src'), ...desktopSurfaces,
  ...sourceFiles('apps/android/app/src'), ...sourceFiles('apps/android/native-lab/src'),
  'apps/android/standalone/src/main/AndroidManifest.xml',
  'apps/server/src/desktop-voice.ts', 'packages/flow-library/src/index.ts',
];

describe('微光指引产品名称', () => {
  it.each(surfaces)('%s 不再显示旧产品名称', file => {
    expect(readFileSync(file, 'utf8')).not.toContain('暖伴');
  });

  it('保留内部桥接协议和本地语音唤醒词，避免更名破坏兼容性', () => {
    expect(readFileSync('apps/desktop/wake/windows-local-wake.cjs', 'utf8'))
      .toContain("new Set(['暖伴', '暖伴暖伴', '小暖'])");
    expect(readFileSync('apps/web/src/local-companion.ts', 'utf8')).toContain('window.nuanbanCompanion');
    expect(readFileSync('apps/desktop/notification-adapter.cjs', 'utf8')).toContain('nuanban:');
    expect(readFileSync('apps/android/standalone/build.gradle.kts', 'utf8'))
      .toContain('applicationId = "org.nuanban.assistant.standalone"');
  });

  it('将鹿角光标 Logo 接入网页、Windows 和 Android', () => {
    expect(readFileSync('apps/web/src/brand-mark.tsx', 'utf8')).toContain('./assets/brand-mark.svg');
    expect(readFileSync('apps/desktop/main.cjs', 'utf8')).toContain('PRODUCT_ICON_PATH');
    expect(readFileSync('apps/desktop/standalone-host.cjs', 'utf8')).toContain('nativeImage.createFromPath(PRODUCT_ICON_PATH)');
    expect(readFileSync('apps/android/app/src/main/AndroidManifest.xml', 'utf8')).toContain('android:icon="@mipmap/ic_launcher"');
    expect(existsSync('design/brand/nuanban-mark.svg')).toBe(true);
    expect(existsSync('apps/desktop/assets/brand/icon.ico')).toBe(true);
    expect(existsSync('apps/android/app/src/main/res/mipmap-mdpi/ic_launcher.png')).toBe(true);
  });

  it('网页与桌面图标使用设计源文件的同一份 Logo', () => {
    expect(readFileSync('apps/web/src/assets/brand-mark.svg'))
      .toEqual(readFileSync('design/brand/nuanban-icon-square.svg'));
    expect(readFileSync('apps/desktop/assets/brand/icon.png'))
      .toEqual(readFileSync('design/brand/png/nuanban-icon-square-512.png'));
    const icon = readFileSync('apps/desktop/assets/brand/icon.ico');
    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    expect(icon.readUInt16LE(4)).toBeGreaterThan(0);
  });

  it.each([
    ['mdpi', 48, 108, 24], ['hdpi', 72, 162, 36], ['xhdpi', 96, 216, 48],
    ['xxhdpi', 144, 324, 72], ['xxxhdpi', 192, 432, 96],
  ] as const)('Android %s 具有正确尺寸的启动器、前景与通知图标', (density, launcherSize, foregroundSize, notificationSize) => {
    const resources = 'apps/android/app/src/main/res';
    for (const [file, size] of [
      [`mipmap-${density}/ic_launcher.png`, launcherSize],
      [`mipmap-${density}/ic_launcher_round.png`, launcherSize],
      [`mipmap-${density}/ic_launcher_foreground.png`, foregroundSize],
      [`drawable-${density}/ic_stat_nuanban.png`, notificationSize],
    ] as const) {
      const image = readFileSync(join(resources, file));
      expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([size, size]);
    }
  });
});
