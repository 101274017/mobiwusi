import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const script = join(root, 'scripts', 'check-c17-assembly.mjs');

function runAudit() {
  const directory = mkdtempSync(join(tmpdir(), 'nuanban-c17-'));
  const evidence = join(directory, 'c17.json');
  try {
    execFileSync(process.execPath, [script, '--evidence', evidence], { cwd: root, encoding: 'utf8' });
    return JSON.parse(readFileSync(evidence, 'utf8')) as {
      auditPassed: boolean;
      status: string;
      checks: Array<{ id: string; status: string }>;
      evidenceInventory: Array<{ file: string; exists: boolean; contentSha256: string | null }>;
      commandResults: Array<{ command: string; passed: boolean; exitCode: number }>;
      nativeBridgeVerified: string;
      browserStorageVerified: string;
      desktopStoreVerified: string;
      desktopNotificationVerified: string;
      highRiskCapabilitiesEnabled: boolean;
      goNoGoEligible: boolean;
      blockers: string[];
      development: { verdict: string; eligible: boolean };
      release: { verdict: string; ready: boolean };
      external: { pending: Array<{ id: string; production_enabled: boolean }> };
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('C17 共享仓储与桥接装配预备审计', { timeout: 30_000 }, () => {
  it('静态组合根、仓储隔离和桥接安全边界全部可追踪', () => {
    const report = runAudit();
    expect(report.auditPassed).toBe(true);
    expect(report.checks).toHaveLength(9);
    expect(report.checks.every(check => check.status === 'passed')).toBe(true);
    for (const file of ['scripts/check-c17-assembly.mjs', 'packages/privacy/src/index.ts', 'packages/media-relay/src/index.ts', 'packages/provider-sandbox/src/index.ts', 'packages/config/src/index.ts',
      'apps/desktop/standalone-host.cjs', 'apps/desktop/runtime-coordinator.cjs', 'apps/desktop/observation/controlled-screen-capture.cjs',
      'apps/desktop/wake/windows-local-wake.cjs', 'apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/PetSessions.kt',
      ...['AndroidLocalScreenDetector', 'AndroidGuidanceRuntime', 'StandaloneGuidanceClient', 'AndroidCaptureGeometry']
        .map(name => `apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/${name}.kt`), 'apps/android/check-standalone-packaging.ps1']) {
      expect(report.evidenceInventory.find(item => item.file === file)).toMatchObject({ exists: true, contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }
    expect(report.commandResults[0]).toMatchObject({ passed: true, exitCode: 0 });
    expect(report.commandResults[0].command).toContain('tests/privacy/c03-gate.test.ts');
    expect(report.commandResults[0].command).toContain('tests/privacy/c04-media-relay.test.ts');
    expect(report.commandResults[0].command).toContain('tests/platform/desktop-standalone-host.test.ts');
    expect(report.commandResults[0].command).toContain('tests/platform/android-standalone-runtime.test.ts');
  });

  it('只报告合成预备层，不把 IndexedDB 或消息模拟当作真实平台验收', () => {
    const report = runAudit();
    expect(report.status).toBe('ready_for_development');
    expect(report.development).toMatchObject({ verdict: 'DEV_READY_WITH_EXTERNAL_PENDING', eligible: true });
    expect(report.release).toMatchObject({ verdict: 'EXTERNAL_PENDING', ready: false });
    expect(report.browserStorageVerified).toBe('synthetic_only');
    expect(report.nativeBridgeVerified).toBe('synthetic_only');
    expect(report.desktopStoreVerified).toBe('static_only');
    expect(report.desktopNotificationVerified).toBe('synthetic_only');
    expect(report.highRiskCapabilitiesEnabled).toBe(false);
  });

  it('明确不能正式发布并保留设备外部待项，不能全局阻断开发', () => {
    const report = runAudit();
    expect(report.goNoGoEligible).toBe(false);
    expect(report.external.pending.map(item => item.id)).toEqual(['C17_WEBVIEW_DEVICE', 'C17_DESKTOP_RUNTIME', 'C17_INDEPENDENT_REVIEW']);
    expect(report.external.pending.every(item => item.production_enabled === false)).toBe(true);
  });
});
