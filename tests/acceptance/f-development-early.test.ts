import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type FDevelopmentReport = {
  success: boolean;
  mode: string;
  status: string;
  acceptance: string;
  fStarted: boolean;
  realNetworkEnabled: boolean;
  productionDataEnabled: boolean;
  dGate: {
    preserved: boolean;
    status: string;
    goNoGoEligible: boolean;
    eStarted: boolean;
    fStarted: boolean;
  };
  d07: {
    goGuardPassed: boolean;
  };
  matrix: {
    total: number;
    early: number;
    delivery: number;
    complete: boolean;
  };
  tasks: Array<{
    id: string;
    stage: string;
    statePreserved: boolean;
    safetyFlagsClosed: boolean;
    localEvidencePresent: boolean;
    localTestsPresent: boolean;
  }>;
};

function runCheck() {
  const output = execFileSync(process.execPath, ['scripts/check-f-development.mjs', '--no-write'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return JSON.parse(output) as FDevelopmentReport;
}

describe('F01-F12 开发级任务矩阵', () => {
  it('完整登记早期 F 任务而不改变阻塞状态', () => {
    const report = runCheck();
    const earlyIds = report.tasks.filter(task => task.stage === 'early').map(task => task.id);

    expect(report.success).toBe(true);
    expect(report.mode).toBe('development_only');
    expect(report.status).toBe('development_ready');
    expect(report.acceptance).toBe('development_verified_formal_pending');
    expect(report.matrix).toEqual({ total: 24, early: 12, delivery: 12, complete: true });
    expect(earlyIds).toEqual(Array.from({ length: 12 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`));
    expect(report.tasks.filter(task => task.stage === 'early').every(task => (
      task.statePreserved
      && task.safetyFlagsClosed
      && task.localEvidencePresent
      && task.localTestsPresent
    ))).toBe(true);
  });

  it('保持 D07 阻断和真实网络/生产数据关闭', () => {
    const report = runCheck();

    expect(report.dGate.preserved).toBe(true);
    expect(report.dGate.status).toBe('blocked');
    expect(report.dGate.goNoGoEligible).toBe(false);
    expect(report.dGate.eStarted).toBe(false);
    expect(report.dGate.fStarted).toBe(false);
    expect(report.d07.goGuardPassed).toBe(true);
    expect(report.fStarted).toBe(false);
    expect(report.realNetworkEnabled).toBe(false);
    expect(report.productionDataEnabled).toBe(false);
  });
});
