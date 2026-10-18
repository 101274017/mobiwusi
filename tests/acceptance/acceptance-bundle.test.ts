import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type AcceptanceBundleReport = {
  success: boolean;
  status: string;
  acceptance: string;
  goNoGoEligible: boolean;
  checks: Array<{ id: string; status: string; details: Record<string, unknown> }>;
  limitations: string[];
};

function runAcceptanceBundle(): AcceptanceBundleReport {
  const output = execFileSync(process.execPath, ['scripts/check-acceptance-bundle.mjs', '--no-write'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return JSON.parse(output) as AcceptanceBundleReport;
}

describe('FE-13 前端验收交接包预检', () => {
  it('检查文档、自动验证、预备证据和桌面包内容', () => {
    const report = runAcceptanceBundle();

    expect(report.success).toBe(true);
    expect(report.status).toBe('preparatory_ready');
    expect(report.acceptance).toBe('preparatory_not_accepted');
    expect(report.goNoGoEligible).toBe(false);
    expect(report.checks).toHaveLength(8);
    expect(report.checks.every(check => check.status === 'passed')).toBe(true);
    expect(report.checks.find(check => check.id === 'FE13-05')?.details).toMatchObject({
      status: 'ready_for_development',
      developmentVerdict: 'DEV_READY_WITH_EXTERNAL_PENDING',
      developmentEligible: true,
      releaseReady: false,
      highRiskCapabilitiesEnabled: false,
    });
    expect(report.checks.find(check => check.id === 'FE13-02')?.details.passedTests).toBeGreaterThanOrEqual(633);
    expect(report.checks.find(check => check.id === 'FE13-03')?.details).toMatchObject({
      expected: 96,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    });
    expect(report.checks.find(check => check.id === 'FE13-07')?.details.scripts).toMatchObject({
      'acceptance:check': expect.any(String),
      'd:gate:check': expect.any(String),
    });
    expect(report.checks.find(check => check.id === 'FE13-06')?.details.packagedFiles).toEqual(expect.arrayContaining([
      '/reminder-notification-bridge.cjs',
    ]));
    expect(report.checks.find(check => check.id === 'FE13-08')?.details).toMatchObject({
      status: 'blocked',
      eStarted: false,
      fStarted: false,
    });
  });

  it('保留真实设备与独立复核限制，不把交接包升级为 D 验收', () => {
    const report = runAcceptanceBundle();

    expect(report.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining('B07/B11'),
      expect.stringContaining('C15/D'),
      expect.stringContaining('D01-D08'),
      expect.stringContaining('真实账号'),
    ]));
  });

  it('release 和未知模式不能静默返回开发通过', () => {
    const release = spawnSync(process.execPath, ['scripts/check-acceptance-bundle.mjs', '--mode', 'release', '--no-write'], { encoding: 'utf8' });
    expect(release.status).toBe(1);
    expect(JSON.parse(release.stdout).release).toMatchObject({ ready: false, verdict: 'EXTERNAL_PENDING' });
    const invalid = spawnSync(process.execPath, ['scripts/check-acceptance-bundle.mjs', '--mode', 'invalid', '--no-write'], { encoding: 'utf8' });
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain('Unknown gate mode');
  });
});
