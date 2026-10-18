import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type RunnerReport = {
  success: boolean;
  mode: string;
  status: string;
  d07Bypassed: boolean;
  formalD07Go: boolean;
  developmentOverride: boolean;
  developmentAuthorization: string;
  automatedDecisionEligible: boolean;
  realNetworkEnabled: boolean;
  productionDataEnabled: boolean;
  fStarted: boolean;
  formalFExecutionStarted: boolean;
  jobs: Array<{ id: string; exitCode: number | null }>;
};

function runRunner() {
  const output = execFileSync(process.execPath, [
    'scripts/run-f-development.mjs',
    '--bypass-d07',
    '--no-write',
    '--only',
    'f-matrix,f-dependencies,gate-protection',
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000, windowsHide: true });
  return JSON.parse(output) as RunnerReport;
}

function runWithoutBypass() {
  return JSON.parse(execFileSync(process.execPath, ['scripts/run-f-development.mjs', '--no-write', '--only', 'f-matrix'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  })) as RunnerReport;
}

describe('F 自动开发门禁本机运行器', { timeout: 30_000 }, () => {
  it('兼容旧 bypass 参数但仍需实际自动开发门禁通过', () => {
    const report = runRunner();

    expect(report.success).toBe(true);
    expect(report.mode).toBe('development_only');
    expect(report.status).toBe('development_checks_passed');
    expect(report.d07Bypassed).toBe(true);
    expect(report.formalD07Go).toBe(false);
    expect(report.developmentOverride).toBe(true);
    expect(report.realNetworkEnabled).toBe(false);
    expect(report.productionDataEnabled).toBe(false);
    expect(report.fStarted).toBe(false);
    expect(report.formalFExecutionStarted).toBe(false);
    expect(report.jobs.map(job => job.id).sort()).toEqual(['f-dependencies', 'f-matrix', 'gate-protection'].sort());
    expect(report.jobs.every(job => job.exitCode === 0)).toBe(true);
  });

  it('V1.2 无需额外 bypass 即可执行本地开发检查', () => {
    const report = runWithoutBypass();
    expect(report.success).toBe(true);
    expect(report.d07Bypassed).toBe(false);
    expect(report.developmentAuthorization).toBe('automated_d07');
    expect(report.automatedDecisionEligible).toBe(true);
    expect(report.formalD07Go).toBe(false);
    expect(report.formalFExecutionStarted).toBe(false);
  });
});
