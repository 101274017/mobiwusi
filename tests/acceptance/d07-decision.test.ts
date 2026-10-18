import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inspectD07EvidenceInventory, runD07DecisionCheck, validateDevelopmentDecision } from '../../scripts/check-d07-decision.mjs';

describe('D07 开发与正式发布双门禁', () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'nuanban-d07-test-')); });
  afterEach(() => {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('nuanban-d07-test-')) throw new Error('Unexpected D07 fixture path');
    rmSync(directory, { recursive: true, force: true });
  });

  it('源码变化或删除使旧安全证据失效，不能复用旧 ready', () => {
    const contents = 'synthetic safety source before change';
    const sourcePath = join(directory, 'safety.ts');
    writeFileSync(sourcePath, contents);
    const reports = { c17: { value: { evidenceInventory: [{ file: 'safety.ts', exists: true, contentSha256: createHash('sha256').update(contents).digest('hex') }] } } };
    expect(inspectD07EvidenceInventory(reports, directory).errors).toEqual([]);
    writeFileSync(sourcePath, 'synthetic changed safety source');
    expect(inspectD07EvidenceInventory(reports, directory).errors).toEqual(['Stale or missing c17 source evidence: safety.ts']);
    unlinkSync(sourcePath);
    expect(inspectD07EvidenceInventory(reports, directory).errors).toEqual(['Stale or missing c17 source evidence: safety.ts']);
  });

  it('哈希缺失或损坏不算来源版本已验证', () => {
    writeFileSync(join(directory, 'safety.ts'), 'synthetic safety source');
    for (const contentSha256 of [null, 'invalid', '0'.repeat(64)]) {
      const reports = { c17: { value: { sourceInventory: [{ path: 'safety.ts', exists: true, contentSha256 }] } } };
      expect(inspectD07EvidenceInventory(reports, directory).errors).toHaveLength(1);
    }
  });

  it('原缺失外部输入新增时必须重新审计，而非继续引用缺失快照', () => {
    const reports = { c16: { value: { sourceInventory: [{ path: 'external.json', exists: false, contentSha256: null }] } } };
    expect(inspectD07EvidenceInventory(reports, directory).errors).toEqual([]);
    writeFileSync(join(directory, 'external.json'), '{}');
    expect(inspectD07EvidenceInventory(reports, directory).errors).toEqual(['Changed c16 external input requires a new audit: external.json']);
  });

  it('没有人工决策也能依据自动证据继续开发，但不得正式发布', () => {
    const decisionPath = join(directory, 'decision.json');
    const report = runD07DecisionCheck({ decisionPath });

    expect(report.status).toBe('development_ready');
    expect(report.eligible).toBe(true);
    expect(report.development.verdict).toBe('DEV_READY_WITH_EXTERNAL_PENDING');
    expect(report.release).toMatchObject({ verdict: 'EXTERNAL_PENDING', ready: false });
    expect(report.formalDecisionPresent).toBe(false);
    expect(report.generatedDecision).toMatchObject({ decisionMode: 'development', review_type: 'automated', decision: 'go' });
    expect(report.generatedDecision).not.toHaveProperty('signoffs');
    expect(report.releaseBlockers).toContain('D07 formal decision record is missing');
  });

  it('release 模式不使用 development go 代替真实批准', () => {
    const report = runD07DecisionCheck({ mode: 'release', decisionPath: join(directory, 'decision.json') });
    expect(report.eligible).toBe(false);
    expect(report.status).toBe('release_pending');
    expect(report.blockers).toContain('C15 is not ready_for_independent_review with all NV checks ready');
    expect(report.writes.decision.written).toBe(false);
  });

  it('自动证据幂等落盘，重复检查不改决定文件或报告', () => {
    const decisionPath = join(directory, 'decision.json');
    const evidencePath = join(directory, 'report.json');
    const first = runD07DecisionCheck({ decisionPath, evidencePath, write: true });
    const decisionBefore = readFileSync(decisionPath, 'utf8');
    const reportBefore = readFileSync(evidencePath, 'utf8');
    const second = runD07DecisionCheck({ decisionPath, evidencePath, write: true });

    expect(first.writes.decision.written).toBe(true);
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    expect(second.writes).toMatchObject({ decision: { written: false, idempotent: true }, evidence: { written: false, idempotent: true } });
    expect(readFileSync(decisionPath, 'utf8')).toBe(decisionBefore);
    expect(readFileSync(evidencePath, 'utf8')).toBe(reportBefore);
  });

  it('不覆盖人工或用户自有证据，损坏人工字段不造成异常放行', () => {
    const decisionPath = join(directory, 'decision.json');
    const formal = JSON.stringify({ schemaVersion: 'd07-decision/v1', decision: 'no_go', evidenceRefs: 'malformed' });
    writeFileSync(decisionPath, formal);
    const report = runD07DecisionCheck({ decisionPath, write: true });
    expect(report.development.eligible).toBe(true);
    expect(report.release.ready).toBe(false);
    expect(readFileSync(decisionPath, 'utf8')).toBe(formal);
    writeFileSync(decisionPath, '{"owner":"user"}');
    expect(() => runD07DecisionCheck({ decisionPath, write: true })).toThrow('Refusing to overwrite non-generated evidence');
    expect(readFileSync(decisionPath, 'utf8')).toBe('{"owner":"user"}');
  });

  it('拒绝未知门禁模式', () => {
    expect(() => runD07DecisionCheck({ mode: 'unknown' as never })).toThrow('Unknown gate mode');
  });

  it('校验自动决定 Schema，不让损坏状态或伪造生产就绪通过', () => {
    const report = runD07DecisionCheck({ decisionPath: join(directory, 'decision.json') });
    expect(validateDevelopmentDecision(report.generatedDecision)).toEqual([]);
    expect(validateDevelopmentDecision({ ...report.generatedDecision, decisionMode: 'release' })).not.toEqual([]);
    expect(validateDevelopmentDecision({ ...report.generatedDecision, decision: 'no_go' })).not.toEqual([]);
    expect(validateDevelopmentDecision({ ...report.generatedDecision, release: { verdict: 'READY', ready: true, reasonRefs: [], formalDecision: null } })).not.toEqual([]);
    const invalidPath = join(directory, 'broken.json');
    writeFileSync(invalidPath, '{"schemaVersion":"d07-decision/v2","decision":"go"}');
    const invalid = runD07DecisionCheck({ decisionPath: invalidPath });
    expect(invalid.development.verdict).toBe('DEV_BLOCKED');
    expect(invalid.eligible).toBe(false);
    expect(invalid.blockers.some(error => error.includes('Invalid existing D07 development decision'))).toBe(true);
  });
});
