import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runC16DecisionReadinessCheck, validateDecisionInput, type C16DecisionReadinessResult } from '../../scripts/check-c16-decision-readiness.mjs';
import { readImplementationPlan } from '../../scripts/implementation-plan.mjs';

const planPath = '暖伴AI公益助手-项目实施计划-Codex高效续作版.md';
const baselinePath = 'docs/implementation/baseline.md';
const inputPath = 'docs/implementation/evidence/c16-decision-input.json';
const defaultsPath = 'docs/implementation/c16-development-defaults.json';
const candidatesPath = 'docs/implementation/c16-top20-candidates.json';
const evidencePath = 'docs/implementation/evidence/c16-decision-readiness-results.json';
const currentPlan = readImplementationPlan(process.cwd());
const plan = currentPlan.text;
const baseline = readFileSync(baselinePath, 'utf8');
const fixtureDirectories: string[] = [];

function fixture(options: { plan?: string | null; baseline?: string | null; input?: string } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'nuanban-c16-'));
  fixtureDirectories.push(directory);
  for (const [relativePath, contents] of [
    [planPath, options.plan === undefined ? plan : options.plan],
    [baselinePath, options.baseline === undefined ? baseline : options.baseline],
    [inputPath, options.input],
  ]) {
    if (typeof contents !== 'string') continue;
    const absolutePath = join(directory, relativePath as string);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, 'utf8');
  }
  return directory;
}

function fingerprint(path: string) {
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
}

function fixtureChecker(directory: string, ...arguments_: string[]) {
  const scriptPath = join(directory, 'scripts/check-c16-decision-readiness.mjs');
  mkdirSync(dirname(scriptPath), { recursive: true });
  writeFileSync(scriptPath, readFileSync('scripts/check-c16-decision-readiness.mjs'));
  writeFileSync(join(directory, 'scripts/implementation-plan.mjs'), readFileSync('scripts/implementation-plan.mjs'));
  return spawnSync(process.execPath, [scriptPath, ...arguments_], { cwd: directory, encoding: 'utf8' });
}

afterEach(() => {
  for (const directory of fixtureDirectories.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('nuanban-c16-')) throw new Error('Unexpected C16 fixture path');
    rmSync(directory, { recursive: true, force: true });
  }
});

function runDecisionCheck() {
  const result = spawnSync(process.execPath, ['scripts/check-c16-decision-readiness.mjs', '--no-write'], { cwd: process.cwd(), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as C16DecisionReadinessResult;
}

function syntheticDecisionInput() {
  const input = JSON.parse(readFileSync('docs/implementation/evidence/c16-decision-input.template.json', 'utf8')) as {
    generatedAt: string;
    source: string;
    decisions: Record<string, Record<string, unknown>>;
    top20Slots: Record<string, unknown>[];
    signoff: Record<string, unknown>;
  };
  input.generatedAt = '2026-10-17T11:00:00+08:00';
  input.source = 'synthetic unit fixture only; not a real decision or signoff';
  for (const decision of Object.values(input.decisions)) {
    for (const field of Object.keys(decision)) {
      decision[field] = field === 'decisionDate' ? '2026-10-17' : `synthetic ${field}`;
    }
  }
  for (const slot of input.top20Slots) {
    for (const field of ['name', 'applicationVersion', 'riskBoundary', 'consent', 'flowPackageVersion', 'fallbackPlan']) {
      slot[field] = `synthetic ${field} ${slot.slot}`;
    }
  }
  input.signoff = {
    owner: 'synthetic owner',
    reviewer: 'synthetic independent reviewer',
    pilotPartner: 'synthetic pilot partner',
    signedAt: '2026-10-17T11:00:00+08:00',
    evidenceRefs: ['synthetic://unit-fixture/not-acceptance'],
  };
  return input;
}

describe('C16 V1.2 自动开发与正式决策分离', () => {
  it('自动覆盖五个 Q 项但不代替正式确认', () => {
    const report = runDecisionCheck();

    expect(report.auditPassed).toBe(true);
    expect(report.sourceAuditPassed).toBe(true);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(report.generatedTimeZone).toBe('Asia/Shanghai');
    expect(report.status).toBe('blocked');
    expect(report.decisionState).toBe('unconfirmed');
    expect(report.decisionReady).toBe(false);
    expect(report.pilotEligible).toBe(false);
    expect(report.development).toMatchObject({ eligible: true, verdict: 'DEV_READY_WITH_EXTERNAL_PENDING', failedChecks: [] });
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.checks.every(check => check.passed && check.status === 'passed')).toBe(true);
    expect(report.verification).toMatchObject({ automated: 'passed', external: 'external_pending', release: 'EXTERNAL_PENDING', humanConsentOccurred: false, independentSignoffVerified: false });
    expect(report.decisions.map((decision: { id: string }) => decision.id)).toEqual(['Q-02', 'Q-05', 'Q-10', 'Q-11', 'Q-14']);
    expect(report.decisions.every((decision: { status: string; confirmedFields: string[] }) => decision.status === 'unconfirmed' && decision.confirmedFields.length === 0)).toBe(true);
  });

  it('从计划生成恰好 20 个具体候选，不伪造应用版本、真人同意或真机适配', () => {
    const report = runDecisionCheck();

    expect(report.top20Slots).toHaveLength(20);
    expect(report.top20Approved).toBe(false);
    expect(report.top20Slots.map(candidate => candidate.name)).toEqual([
      '字体大小', '显示大小', '屏幕亮度', '深色模式', '媒体音量', '响铃/静音', '自动旋转', '手电筒入口', 'Wi-Fi设置入口（不教密码）', '蓝牙设置入口（不含敏感配对证明）',
      '文字大小', '显示缩放', '屏幕亮度（设备支持时）', '浅色/深色主题', '系统音量', '输出设备选择', '夜间模式', '鼠标指针大小', '放大镜', '浏览器页面缩放',
    ]);
    expect(report.top20Slots.filter(candidate => candidate.platform === 'Android')).toHaveLength(10);
    expect(report.top20Slots.filter(candidate => candidate.platform === 'Windows')).toHaveLength(10);
    expect(new Set(report.top20Slots.map(candidate => candidate.id)).size).toBe(20);
    for (const candidate of report.top20Slots) {
      expect(candidate).toMatchObject({ generatedBy: 'automated', mode: 'development', status: 'candidate', verification: 'external_pending', applicationVersion: null, flowPackageVersion: null, consent: null, consentGranted: false, targetVerified: false });
      expect(candidate.riskBoundary).toContain('立即暂停');
      expect(candidate.fallbackPlan).toContain('external_pending');
      const line = Number(candidate.sourceReference.split('#L')[1]);
      expect(plan.split(/\r?\n/)[line - 1]).toContain(candidate.name);
      expect(candidate.sourceReference.split('#L')[0]).toBe(currentPlan.path);
      expect(candidate.sourceHash).toBe(fingerprint(currentPlan.path));
    }
    expect(report.top20Candidates.candidates).toEqual(report.top20Slots);
  });

  it('缺少外部 JSON 或签字仍生成开发默认方案，不允许真实试点或真实数据处理', () => {
    const report = runC16DecisionReadinessCheck({ rootDirectory: fixture() });

    expect(report.decisionInputProvided).toBe(false);
    expect(report.decisionInputValid).toBe(false);
    expect(report.decisionInputQualityPassed).toBe(false);
    expect(report.decisionInputErrors).toContain('c16 decision input file is missing');
    expect(report.sourceInventory[0].path).toBe('docs/implementation/baseline.md');
    expect(report.sourceInventory[0].contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.blockers.length).toBeGreaterThanOrEqual(4);
    expect(report.blockerRefs.some((ref: { code: string }) => ref.code === 'C16_DECISION_INPUT_MISSING')).toBe(true);
    expect(report.decisions.every(decision => decision.sourcePresent && /^[0-9a-f]{64}$/.test(decision.sourceHash ?? '') && decision.missingFields.length > 0)).toBe(true);
    expect(report.allowedUntilDecision).toContain('不发布 Top20 已适配清单、不处理真实儿童/家庭数据、不启动真实试点。');
    expect(report.development.eligible).toBe(true);
    expect(report.developmentDefaults.decisions.map(decision => decision.id)).toEqual(['Q-02', 'Q-05', 'Q-10', 'Q-11', 'Q-14']);
    expect(report.developmentDefaults.decisions.every(decision => decision.generatedBy === 'automated' && decision.mode === 'development' && decision.status === 'candidate' && !decision.formallyApproved && decision.sourcePolicy.length > 0 && decision.sourceReferences.length === 2)).toBe(true);
    const defaults = Object.fromEntries(report.developmentDefaults.decisions.map(decision => [decision.id, decision.choice]));
    expect(defaults['Q-02']).toMatchObject({ unknownPageAction: 'pause', realApplicationAdaptationApproved: false, requiredPrdFlowsMustBePreserved: true });
    expect(defaults['Q-02'].candidateIds).toHaveLength(20);
    expect(defaults['Q-05']).toMatchObject({ consentGranted: false, defaultScopes: [], childDataMode: 'synthetic_only', grantChecks: ['scope', 'revocation', 'expiry', 'current_version'] });
    expect(defaults['Q-10']).toMatchObject({ dataMode: 'synthetic_only', rawRealtimeMediaPersistence: false, approvedRetentionPeriods: null, supplierRetentionTerms: null, supplierProcessingEnabled: false });
    expect(defaults['Q-11']).toMatchObject({ aiRole: 'suggest_only', assistedActionsCountAsUnprompted: false, effectivenessClaimsEnabled: false });
    expect(defaults['Q-14']).toMatchObject({ defaultScopes: [], realFamilyDataEnabled: false, complexFamilyScope: 'deferred_not_removed' });
  });

  it('拒绝未填写的 C16 模板，避免占位字段误作决策输入', () => {
    const template = readFileSync('docs/implementation/evidence/c16-decision-input.template.json', 'utf8');
    const result = validateDecisionInput({ exists: true, text: template });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('generatedAt must be an ISO timestamp with timezone');
    expect(result.errors).toContain('top20Slots[0].name is required');
    expect(result.errors).toContain('signoff.evidenceRefs is required');
  });

  it('允许完整合成输入通过结构校验但不生成真实决策或签收', () => {
    const input = syntheticDecisionInput();
    const result = validateDecisionInput({ exists: true, text: JSON.stringify(input) });

    expect(result).toEqual({ parseable: true, valid: true, errors: [] });
    const report = runC16DecisionReadinessCheck({ rootDirectory: fixture({ input: JSON.stringify(input) }) });
    expect(report.decisionInputProvided).toBe(true);
    expect(report.decisionInputValid).toBe(true);
    expect(report.development.eligible).toBe(true);
    expect(report.decisionReady).toBe(false);
    expect(report.top20Approved).toBe(false);
    expect(report.pilotEligible).toBe(false);
    expect(report.verification.independentSignoffVerified).toBe(false);
    expect(report.blockerRefs.some(ref => ref.code === 'C16_DECISION_INPUT_INVALID')).toBe(false);
    expect(report.blockerRefs.some(ref => ref.code === 'C16_INDEPENDENT_SIGNOFF_REQUIRED')).toBe(true);
  });

  it.each([{}, [], { nested: null }, ['待确认']])('拒绝嵌套空值或占位内容 %j', value => {
    const input = syntheticDecisionInput();
    input.decisions['Q-10'].supplierRetentionTerms = value;

    const result = validateDecisionInput({ exists: true, text: JSON.stringify(input) });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Q-10.supplierRetentionTerms is required');
  });

  it('拒绝不存在的日历日期、无时区签署时间和重复 Top20 槽位', () => {
    const input = syntheticDecisionInput();
    input.decisions['Q-02'].decisionDate = '2026-02-30';
    input.signoff.signedAt = '2026-10-17T11:00:00';
    input.top20Slots[1].slot = 1;

    const result = validateDecisionInput({ exists: true, text: JSON.stringify(input) });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Q-02.decisionDate must be a valid ISO date or timestamp');
    expect(result.errors).toContain('signoff.signedAt must be an ISO timestamp with timezone');
    expect(result.errors).toContain('top20Slots[1].slot must equal 2');
  });

  it.each(['{broken-json', '{}'])('外部输入格式错误不阻断本地默认方案：%s', input => {
    const report = runC16DecisionReadinessCheck({ rootDirectory: fixture({ input }) });

    expect(report.auditPassed).toBe(true);
    expect(report.development.eligible).toBe(true);
    expect(report.decisionInputValid).toBe(false);
    expect(report.decisionInputErrors.length).toBeGreaterThan(0);
    expect(report.blockerRefs.some(ref => ref.code === 'C16_DECISION_INPUT_INVALID')).toBe(true);
    expect(report.decisionReady).toBe(false);
  });

  it('来源名称和策略变更会改变生成内容和哈希，而非返回硬编码清单', () => {
    const changedPlan = plan.replace('媒体音量', '媒体音量设置入口').replace('实现可配置清理、', '实现可配置清理（可逆开发）、');
    const original = runC16DecisionReadinessCheck({ rootDirectory: fixture() });
    const updated = runC16DecisionReadinessCheck({ rootDirectory: fixture({ plan: changedPlan }) });

    expect(updated.development.eligible).toBe(true);
    expect(updated.top20Slots[4].name).toBe('媒体音量设置入口');
    expect(updated.top20Slots[4].sourceHash).not.toBe(original.top20Slots[4].sourceHash);
    expect(updated.developmentDefaults.decisions.find(decision => decision.id === 'Q-10')?.sourcePolicy).toContain('可逆开发');
  });

  it.each([
    ['缺少基线', { baseline: null }, 'C16_BASELINE_SOURCE'],
    ['缺少 Q-05', { baseline: baseline.replace(/^\| Q-05[^\r\n]*$/mu, '') }, 'C16_BASELINE_SOURCE'],
    ['缺少计划', { plan: null }, 'C16_V12_PLAN_SOURCE'],
    ['旧版计划', { plan: plan.replace('| V1.2，', '| V1.1，') }, 'C16_V12_PLAN_SOURCE'],
    ['缺少默认策略', { plan: plan.replace(/^\| 监护\/亲情权限 \|[^\r\n]*$/mu, '') }, 'C16_DEFAULT_POLICY_SOURCE'],
    ['失去监护真实边界', { plan: plan.replace('不替真实监护人同意', '开发模拟可以替真实监护人同意') }, 'C16_DEFAULT_POLICY_SOURCE'],
    ['只有 19 项', { plan: plan.replace('媒体音量、', '') }, 'C16_CANDIDATE_COUNT'],
    ['出现第 21 项', { plan: plan.replace('媒体音量', '媒体音量、勿扰设置入口') }, 'C16_CANDIDATE_COUNT'],
    ['候选重复', { plan: plan.replace('媒体音量', '字体大小') }, 'C16_CANDIDATE_UNIQUENESS'],
    ['空白候选', { plan: plan.replace('媒体音量', ' ') }, 'C16_CANDIDATE_UNIQUENESS'],
    ['占位候选', { plan: plan.replace('媒体音量', '待确认') }, 'C16_CANDIDATE_UNIQUENESS'],
    ['错误平台', { plan: plan.replace('Windows：文字大小', 'Linux：文字大小') }, 'C16_CANDIDATE_PLATFORMS'],
    ['高风险候选', { plan: plan.replace('媒体音量', '转账支付入口') }, 'C16_CANDIDATE_SAFETY'],
    ['丢失 Wi-Fi 限制', { plan: plan.replace('Wi-Fi设置入口（不教密码）', 'Wi-Fi设置入口') }, 'C16_CANDIDATE_SAFETY'],
    ['丢失蓝牙限制', { plan: plan.replace('蓝牙设置入口（不含敏感配对证明）', '蓝牙设置入口') }, 'C16_CANDIDATE_SAFETY'],
    ['丢失硬件限制', { plan: plan.replace('屏幕亮度（设备支持时）', '屏幕亮度') }, 'C16_CANDIDATE_SAFETY'],
  ] as const)('实际软件输入错误不能改归外部待项：%s', (_title, options, expectedCheck) => {
    const directory = fixture(options);
    const report = runC16DecisionReadinessCheck({ rootDirectory: directory, writeDevelopmentFiles: true });

    expect(report.auditPassed).toBe(false);
    expect(report.development).toMatchObject({ eligible: false, verdict: 'DEV_BLOCKED' });
    expect(report.development.failedChecks.map(check => check.id)).toContain(expectedCheck);
    expect(report.verification.automated).toBe('failed');
    expect(report.verification.external).toBe('external_pending');
    expect(report.verification.release).toBe('BLOCKED');
    expect(existsSync(join(directory, defaultsPath))).toBe(false);
    expect(existsSync(join(directory, candidatesPath))).toBe(false);
    expect(report.decisionReady).toBe(false);
  });

  it('开发专用命令只写入两个候选产物，不刷新正式结果文件', () => {
    const directory = fixture();
    const result = fixtureChecker(directory, '--development-only');

    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as C16DecisionReadinessResult;
    expect(JSON.parse(readFileSync(join(directory, defaultsPath), 'utf8'))).toEqual(report.developmentDefaults);
    expect(JSON.parse(readFileSync(join(directory, candidatesPath), 'utf8'))).toEqual(report.top20Candidates);
    expect(existsSync(join(directory, evidencePath))).toBe(false);
    expect(existsSync(join(directory, inputPath))).toBe(false);
  });

  it('--no-write 对已有证据和候选文件均无写入，即使同时传入写入参数', () => {
    const paths = [defaultsPath, candidatesPath, evidencePath];
    const before = paths.map(fingerprint);
    runDecisionCheck();
    expect(paths.map(fingerprint)).toEqual(before);

    const directory = fixture();
    const result = fixtureChecker(directory, '--development-only', '--no-write', '--evidence', evidencePath);
    expect(result.status, result.stderr).toBe(0);
    expect(paths.map(path => existsSync(join(directory, path)))).toEqual([false, false, false]);
  });

  it('来源损坏时命令非零退出且不覆盖上一份开发产物', () => {
    const directory = fixture();
    runC16DecisionReadinessCheck({ rootDirectory: directory, writeDevelopmentFiles: true });
    const paths = [join(directory, defaultsPath), join(directory, candidatesPath)];
    const before = paths.map(fingerprint);
    writeFileSync(join(directory, planPath), plan.replace('媒体音量、', ''), 'utf8');

    const result = fixtureChecker(directory, '--development-only');
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout) as C16DecisionReadinessResult;
    expect(report.development.verdict).toBe('DEV_BLOCKED');
    expect(paths.map(fingerprint)).toEqual(before);
    expect(existsSync(join(directory, evidencePath))).toBe(false);
  });
});
