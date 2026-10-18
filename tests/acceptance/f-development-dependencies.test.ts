import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type DependencyReport = {
  success: boolean;
  mode: string;
  status: string;
  developmentOverride: boolean;
  d07Bypassed: boolean;
  formalD07Go: boolean;
  developmentExecutionAllowed: boolean;
  realExecutionAllowed: boolean;
  realNetworkEnabled: boolean;
  productionDataEnabled: boolean;
  dGate: { preserved: boolean; goNoGoEligible: boolean; eStarted: boolean; fStarted: boolean };
  matrix: { total: number; early: number; delivery: number; complete: boolean };
  tasks: Array<{
    id: string;
    dependency: string;
    prerequisites: Array<{ id: string; relation: string }>;
    blockers: string[];
    status: string;
    developmentOnly: boolean;
    realExecutionAllowed: boolean;
  }>;
};

function runMatrix() {
  const output = execFileSync(process.execPath, ['scripts/f-development/dependency-matrix.mjs', '--no-write'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return JSON.parse(output) as DependencyReport;
}

describe('F01-F24 自动开发依赖矩阵', () => {
  it('按自动开发决定保留 24 项依赖与 D07 正式阻断', () => {
    const report = runMatrix();

    expect(report.success).toBe(true);
    expect(report.mode).toBe('development_only');
    expect(report.status).toBe('development_ready');
    expect(report.developmentOverride).toBe(true);
    expect(report.d07Bypassed).toBe(false);
    expect(report.formalD07Go).toBe(false);
    expect(report.developmentExecutionAllowed).toBe(true);
    expect(report.realExecutionAllowed).toBe(false);
    expect(report.matrix).toEqual({ total: 24, early: 12, delivery: 12, complete: true });
    expect(report.tasks.map(task => task.id)).toEqual(Array.from({ length: 24 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`));
  });

  it('每项仍有可追踪 blocker，并关闭真实能力', () => {
    const report = runMatrix();

    expect(report.dGate.preserved).toBe(true);
    expect(report.dGate.goNoGoEligible).toBe(false);
    expect(report.dGate.eStarted).toBe(false);
    expect(report.dGate.fStarted).toBe(false);
    expect(report.realNetworkEnabled).toBe(false);
    expect(report.productionDataEnabled).toBe(false);
    expect(report.tasks.every(task => (
      task.status === 'development_ready'
      && task.developmentOnly
      && task.realExecutionAllowed === false
      && task.blockers.some(blocker => blocker.includes('D07'))
      && task.prerequisites.length > 0
    ))).toBe(true);
  });
});
