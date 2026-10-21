import { readdirSync, readFileSync } from 'node:fs';
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
});
