import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runHandoffCheck() {
  const result = spawnSync(process.execPath, ['scripts/check-c14-handoff.mjs', '--no-write'], { cwd: process.cwd(), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe('C14 契约交接证据审计', () => {
  it('自动技术冻结允许本地开发，独立评审和真实供应另记发布待项', () => {
    const report = runHandoffCheck();

    expect(report.success).toBe(true);
    expect(report.status).toBe('frozen');
    expect(report.technicalFreeze).toMatchObject({ freezeType: 'automated_technical', independentReviewPresent: false });
    expect(report.development.verdict).toBe('DEV_READY_WITH_EXTERNAL_PENDING');
    expect(report.release).toMatchObject({ verdict: 'EXTERNAL_PENDING', ready: false });
    expect(report.backendStarted).toBe(false);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(report.generatedTimeZone).toBe('Asia/Shanghai');
    expect(report.sourceInventory).toHaveLength(6);
    expect(report.sourceInventory.every((source: { exists: boolean; contentSha256: string }) => source.exists && /^[0-9a-f]{64}$/.test(source.contentSha256))).toBe(true);
    expect(report.blockerRefs.map((ref: { code: string }) => ref.code)).toEqual([
      'A02_INDEPENDENT_REVIEW',
      'C12_REAL_SUPPLIER_EVIDENCE',
      'BACKEND_NOT_CONNECTED',
    ]);
  });
});
