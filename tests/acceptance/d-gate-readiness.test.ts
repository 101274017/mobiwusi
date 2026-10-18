import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runDGateCheck() {
  const result = spawnSync(process.execPath, ['scripts/check-d-gate-readiness.mjs', '--no-write'], { cwd: process.cwd(), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe('D 关口预备审计', () => {
  it('覆盖 D01-D08 并保持未准入状态', () => {
    const report = runDGateCheck();
    expect(report.auditPassed).toBe(true);
    expect(report.status).toBe('blocked');
    expect(report.acceptance).toBe('preparatory_not_accepted');
    expect(report.goNoGoEligible).toBe(false);
    expect(report.eAfterDEligible).toBe(false);
    expect(report.eStarted).toBe(false);
    expect(report.fStarted).toBe(false);
    expect(report.development).toMatchObject({ verdict: 'DEV_READY_WITH_EXTERNAL_PENDING', eligible: true });
    expect(report.release).toMatchObject({ verdict: 'EXTERNAL_PENDING', ready: false });
    expect(report.checks.map((check: { id: string }) => check.id)).toEqual(['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08']);
    expect(report.checks.every((check: { status: string }) => check.status === 'blocked')).toBe(true);
  });

  it('保留 C15/C16 和人工签收前置条件', () => {
    const report = runDGateCheck();
    expect(report.checks.find((check: { id: string }) => check.id === 'D01').missing).toEqual(expect.arrayContaining([
      '缺少 B07/B10/B11 负责人和参与者人工签收记录',
    ]));
    expect(report.checks.find((check: { id: string }) => check.id === 'D07').missing).toEqual(expect.arrayContaining([
      'C16 decisionReady=false，真实授权、试点和参与者输入仍为外部待项',
    ]));
  });

  it('不把未接真实后端误列为 D02 冻结前置', () => {
    const report = runDGateCheck();
    const d02 = report.checks.find((check: { id: string }) => check.id === 'D02');

    expect(d02.status).toBe('blocked');
    expect(d02.details.realBackendConnected).toBe(false);
    expect(d02.details.realBackendRequiredForD02).toBe(false);
    expect(d02.missing).not.toContain('真实 HTTP/SSE/WS、认证、媒体中继和生产数据库尚未接入');
    expect(d02.details.contractsFrozen).toBe(true);
    expect(d02.details.c14DevelopmentVerdict).toBe('DEV_READY_WITH_EXTERNAL_PENDING');
    expect(d02.missing).toContain('缺少 A02/C14 独立评审记录或签收字段');
  });

  it('不把缺字段的人工签收或独立评审文件当作有效证据', () => {
    const report = runDGateCheck();
    const d01 = report.checks.find((check: { id: string }) => check.id === 'D01');
    const d02 = report.checks.find((check: { id: string }) => check.id === 'D02');

    expect(d01.details.manualSignoff).toBe(false);
    expect(d01.missing).toContain('缺少 B07/B10/B11 负责人和参与者人工签收记录');
    expect(d02.details.independentReviewRecord).toBe(false);
    expect(d02.missing).toContain('缺少 A02/C14 独立评审记录或签收字段');
  });
});
