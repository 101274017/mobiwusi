import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type DeliveryReport = {
  mode: string;
  status: string;
  success: boolean;
  acceptance: string;
  realEvidenceComplete: boolean;
  formalDeliveryAllowed: boolean;
  realNetworkEnabled: boolean;
  deviceAccessEnabled: boolean;
  realAccountsEnabled: boolean;
  productionDataEnabled: boolean;
  providerAccessEnabled: boolean;
  offline: boolean;
  synthetic: boolean;
  executionPolicy: {
    network: string;
    data: string;
    environment: string;
    networkCalls: number;
    deviceOperations: number;
    accountOperations: number;
    productionDataReads: number;
    supplierCalls: number;
    writesToExistingTaskCards: boolean;
    writesToD07Decision: boolean;
    existingFDevelopmentRunnerInvoked: boolean;
  };
  stateProtection: {
    passed: boolean;
    dGatePreserved: boolean;
    formalD07Go: boolean;
    writes: {
      d07Decision: boolean;
      fTaskCards: boolean;
      existingFDevelopmentRunner: boolean;
    };
  };
  taskMatrix: {
    total: number;
    delivery: number;
    complete: boolean;
    allStatesPreserved: boolean;
  };
  taskCoverage: Array<{
    id: string;
    status: string;
    acceptance: string;
    executionStarted: boolean;
    fStarted: boolean;
    localChecksPassed: boolean;
    realEvidenceMissing: string[];
  }>;
  checks: {
    demoPackage: { passed: boolean; presentCount: number; requiredCount: number; missing: string[] };
    contractAudit: { passed: boolean; generatedArtifactCount: number; artifactMismatches: string[]; generatorCheck: { passed: boolean }; schemaCheck: { passed: boolean } };
    backupRestoreRollback: { passed: boolean; rollbackMatchesBackup: boolean; restoreMatchesBackup: boolean; rollbackMatchesExpectedState: boolean; restoreMatchesExpectedState: boolean; deletedRecordRemainsDeleted: boolean; permissionsPreserved: boolean; rawFileCopyIsUnsafe: boolean; cleanedUp: boolean };
    androidCandidate: { passed: boolean; candidatePresent: boolean; signingEvidencePresent: boolean; installationEvidencePresent: boolean; formalCandidateAccepted: boolean };
    windowsCandidate: { passed: boolean; candidatePresent: boolean; signingEvidencePresent: boolean; installationEvidencePresent: boolean; formalCandidateAccepted: boolean; candidateComparison: { success: boolean; status: string | null } };
    codeHandoff: { passed: boolean; localVerified: boolean; independentReviewPresent: boolean; formalContractFrozen: boolean };
    supplierHandoff: { passed: boolean; localVerified: boolean; realCredentialState: string; productionReady: boolean; formalSupplierHandoffAccepted: boolean };
    finalEvidenceReview: { passed: boolean; localEvidenceComplete: boolean; realEvidenceComplete: boolean; formalDeliveryAllowed: boolean };
  };
  realEvidenceMissing: Array<{ code: string; taskIds: string[]; status: string; evidence: string[]; reason: string }>;
};

function runDelivery(): DeliveryReport {
  const output = execFileSync(process.execPath, ['scripts/f-development/delivery.mjs', '--no-write'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60_000,
  });
  return JSON.parse(output) as DeliveryReport;
}

function fileHash(relativePath: string): string {
  return createHash('sha256').update(readFileSync(relativePath)).digest('hex');
}

describe('F13-F24 本机开发级交付/证据执行器', { timeout: 60_000 }, () => {
  it('输出离线、合成、development_only 报告并保留正式阻塞', () => {
    const report = runDelivery();

    expect(report.success).toBe(true);
    expect(report.mode).toBe('development_only');
    expect(report.status).toBe('development_checks_passed');
    expect(report.acceptance).toBe('preparatory_not_accepted');
    expect(report.offline).toBe(true);
    expect(report.synthetic).toBe(true);
    expect(report.realNetworkEnabled).toBe(false);
    expect(report.deviceAccessEnabled).toBe(false);
    expect(report.realAccountsEnabled).toBe(false);
    expect(report.productionDataEnabled).toBe(false);
    expect(report.providerAccessEnabled).toBe(false);
    expect(report.executionPolicy).toMatchObject({
      network: 'offline',
      data: 'synthetic_only',
      environment: 'development_only',
      networkCalls: 0,
      deviceOperations: 0,
      accountOperations: 0,
      productionDataReads: 0,
      supplierCalls: 0,
      writesToExistingTaskCards: false,
      writesToD07Decision: false,
      existingFDevelopmentRunnerInvoked: false,
    });
    expect(report.realEvidenceComplete).toBe(false);
    expect(report.formalDeliveryAllowed).toBe(false);
    expect(report.realEvidenceMissing.length).toBeGreaterThanOrEqual(12);
    expect(report.realEvidenceMissing.map(item => item.code)).toContain('F20_ANDROID_SIGNED_DELIVERY');
    expect(report.realEvidenceMissing.map(item => item.code)).toContain('F23_SUPPLIER_TERMS');
  });

  it('覆盖 F13-F24、契约审计、候选包边界和备份恢复回滚夹具', () => {
    const report = runDelivery();

    expect(report.taskMatrix).toEqual({ total: 12, delivery: 12, complete: true, allStatesPreserved: true });
    expect(report.taskCoverage.map(task => task.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `F${String(index + 13).padStart(2, '0')}`),
    );
    expect(report.taskCoverage.every(task => (
      task.status === 'blocked'
      && task.acceptance === 'preparatory_not_accepted'
      && task.executionStarted === false
      && task.fStarted === false
      && task.localChecksPassed
      && task.realEvidenceMissing.length > 0
    ))).toBe(true);

    expect(report.checks.demoPackage.passed).toBe(true);
    expect(report.checks.demoPackage.presentCount).toBe(report.checks.demoPackage.requiredCount);
    expect(report.checks.demoPackage.missing).toEqual([]);

    expect(report.checks.contractAudit.passed).toBe(true);
    expect(report.checks.contractAudit.generatedArtifactCount).toBeGreaterThan(0);
    expect(report.checks.contractAudit.artifactMismatches).toEqual([]);
    expect(report.checks.contractAudit.generatorCheck.passed).toBe(true);
    expect(report.checks.contractAudit.schemaCheck.passed).toBe(true);

    expect(report.checks.backupRestoreRollback).toMatchObject({
      passed: true,
      rollbackMatchesBackup: false,
      restoreMatchesBackup: true,
      rollbackMatchesExpectedState: true,
      restoreMatchesExpectedState: true,
      deletedRecordRemainsDeleted: true,
      permissionsPreserved: true,
      rawFileCopyIsUnsafe: true,
      cleanedUp: true,
    });

    expect(report.checks.androidCandidate).toMatchObject({
      passed: true,
      candidatePresent: true,
      signingEvidencePresent: false,
      installationEvidencePresent: false,
      formalCandidateAccepted: false,
    });
    expect(report.checks.windowsCandidate).toMatchObject({
      passed: true,
      candidatePresent: true,
      signingEvidencePresent: false,
      installationEvidencePresent: false,
      formalCandidateAccepted: false,
    });
    expect(report.checks.codeHandoff).toMatchObject({
      passed: true,
      localVerified: true,
      independentReviewPresent: false,
      formalContractFrozen: false,
    });
    expect(report.checks.supplierHandoff).toMatchObject({
      passed: true,
      localVerified: true,
      realCredentialState: 'missing',
      productionReady: false,
      formalSupplierHandoffAccepted: false,
    });
    expect(report.checks.finalEvidenceReview).toMatchObject({
      passed: true,
      localEvidenceComplete: true,
      realEvidenceComplete: false,
      formalDeliveryAllowed: false,
    });
  });

  it('只读运行，不修改 D07、F13/F24 任务卡或既有 F 运行器', () => {
    const protectedFiles = [
      'docs/implementation/evidence/d-gate-readiness-results.json',
      'docs/execution/tasks/F13.md',
      'docs/execution/tasks/F24.md',
      'scripts/run-f-development.mjs',
    ];
    const before = protectedFiles.map(file => fileHash(file));
    const report = runDelivery();
    const after = protectedFiles.map(file => fileHash(file));

    expect(after).toEqual(before);
    expect(report.stateProtection).toMatchObject({
      passed: true,
      dGatePreserved: true,
      formalD07Go: false,
      writes: {
        d07Decision: false,
        fTaskCards: false,
        existingFDevelopmentRunner: false,
      },
    });
  });
});
