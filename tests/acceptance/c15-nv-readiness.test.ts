import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runReadinessCheck() {
  const result = spawnSync(process.execPath, ['scripts/check-c15-nv-readiness.mjs', '--no-write'], { cwd: process.cwd(), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe('C15 NV 证据准入审计', () => {
  it('覆盖 NV-01 到 NV-12，并将当前真实准入保持为阻塞', () => {
    const report = runReadinessCheck();

    expect(report.auditPassed).toBe(true);
    expect(report.status).toBe('blocked');
    expect(report.acceptance).toBe('preparatory_not_accepted');
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(report.generatedTimeZone).toBe('Asia/Shanghai');
    expect(report.goNoGoEligible).toBe(false);
    expect(report.checks).toHaveLength(12);
    expect(report.checks.map((check: { id: string }) => check.id)).toEqual([
      'NV-01', 'NV-02', 'NV-03', 'NV-04', 'NV-05', 'NV-06',
      'NV-07', 'NV-08', 'NV-09', 'NV-10', 'NV-11', 'NV-12',
    ]);
  });

  it('不把合成、契约或打包证据误判为独立复核就绪', () => {
    const report = runReadinessCheck();

    expect(report.deviceVerified).toBe(false);
    expect(report.supplierVerified).toBe(false);
    expect(report.checks.every((check: { status: string }) => check.status === 'blocked')).toBe(true);
    expect(report.checks.every((check: { readyForIndependentReview: boolean }) => !check.readyForIndependentReview)).toBe(true);
  });

  it('自动来源审计允许开发继续，设备与供应保持外部待项', () => {
    const report = runReadinessCheck();
    expect(report.development).toMatchObject({ eligible: true, verdict: 'DEV_READY_WITH_EXTERNAL_PENDING', validationScope: 'evidence_source_audit_only' });
    expect(report.verification).toMatchObject({ automated: 'checks_passed', native: 'external_pending', live_provider: 'external_pending' });
    expect(report.release).toMatchObject({ ready: false, verdict: 'EXTERNAL_PENDING' });
    expect(report.external.pending).toHaveLength(13);
    expect(report.external.pending.every((item: { production_enabled: boolean }) => item.production_enabled === false)).toBe(true);
  });

  it('保留逐项阻塞原因和统一证据记录字段', () => {
    const report = runReadinessCheck();

    expect(report.checks.every((check: { blockers: string[]; signals: unknown[] }) => check.blockers.length > 0 && check.signals.length > 0)).toBe(true);
    expect(report.recordSchema).toEqual([
      'date_and_timezone',
      'build_and_package_hash',
      'device_model_os_dpi',
      'case_and_synthetic_material_hash',
      'permissions_and_consent',
      'steps_expected_actual',
      'frame_encoding_send_receive_cache_counters',
      'screenshots_or_video_reference',
      'limitations_executor_independent_reviewer',
    ]);
    expect(report.provenanceSchema).toEqual([
      'source_path',
      'content_sha256',
      'declared_generated_at',
      'declared_generated_time_zone',
      'declared_source_descriptor',
      'metadata_quality_issues',
    ]);
    expect(report.evidenceQualityPassed).toBe(true);
    expect(report.evidenceInventory.every((item: { sourcePath: string; contentSha256: string }) => item.sourcePath.startsWith('docs/implementation/evidence/') && /^[0-9a-f]{64}$/.test(item.contentSha256))).toBe(true);
    expect(report.checks.every((check: { failedSignals: unknown[]; blockerRefs: Array<{ code: string }> }) => check.failedSignals.length > 0 && check.blockerRefs.some(ref => ref.code.endsWith('_EVIDENCE_GAP')))).toBe(true);
  });
});
