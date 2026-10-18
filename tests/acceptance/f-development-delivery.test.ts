import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type FDevelopmentReport = {
  success: boolean;
  tasks: Array<{
    id: string;
    stage: string;
    statePreserved: boolean;
    safetyFlagsClosed: boolean;
    localEvidencePresent: boolean;
    localTestsPresent: boolean;
  }>;
  matrix: {
    total: number;
    early: number;
    delivery: number;
    complete: boolean;
  };
};

function runCheck() {
  const output = execFileSync(process.execPath, ['scripts/check-f-development.mjs', '--no-write'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return JSON.parse(output) as FDevelopmentReport;
}

describe('F13-F24 开发级交付矩阵', () => {
  it('完整登记交付 F 任务而不把准备层当作正式交付', () => {
    const report = runCheck();
    const deliveryIds = report.tasks.filter(task => task.stage === 'delivery').map(task => task.id);

    expect(report.success).toBe(true);
    expect(report.matrix).toEqual({ total: 24, early: 12, delivery: 12, complete: true });
    expect(deliveryIds).toEqual(Array.from({ length: 12 }, (_, index) => `F${String(index + 13).padStart(2, '0')}`));
    expect(report.tasks.filter(task => task.stage === 'delivery').every(task => (
      task.statePreserved
      && task.safetyFlagsClosed
      && task.localEvidencePresent
      && task.localTestsPresent
    ))).toBe(true);
  });
});
