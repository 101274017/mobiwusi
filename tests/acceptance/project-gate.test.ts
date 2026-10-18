import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateProjectGate, handoffDevelopmentErrors, isAutomatedDevelopmentDecision, isDevelopmentEligible, isFormalD07Go } from '../../scripts/project-gate.mjs';

function reports() {
  return Object.fromEntries([
    ['acceptance', 'acceptance-bundle'], ['c14', 'c14-handoff'], ['c15', 'c15-nv-readiness'],
    ['c16', 'c16-decision-readiness'], ['c17', 'c17-assembly'],
  ].map(([id, file]) => [id, JSON.parse(readFileSync(`docs/implementation/evidence/${file}-results.json`, 'utf8'))]));
}

describe('共享开发/发布判定反例', () => {
  it('外部待项不阻断已通过的本机开发检查，也不会放行发布', () => {
    const gate = evaluateProjectGate({
      checks: [{ id: 'local', passed: true }],
      externalPending: [{ id: 'android', capability: 'device_capture', production_enabled: false }],
      release: { assessed: true, ready: false },
    });
    expect(isDevelopmentEligible(gate)).toBe(true);
    expect(gate.development.verdict).toBe('DEV_READY_WITH_EXTERNAL_PENDING');
    expect(gate.release).toMatchObject({ verdict: 'EXTERNAL_PENDING', ready: false });
  });

  it('未验证能力误启用属于真实代码阻断，不能归为普通 external_pending', () => {
    const gate = evaluateProjectGate({ externalPending: [{ id: 'provider', production_enabled: true }] });
    expect(gate.development.verdict).toBe('DEV_BLOCKED');
    expect(gate.release.ready).toBe(false);
  });

  it('缺报告或空检查集不能被当作自动工程证据', () => {
    expect(handoffDevelopmentErrors({})).toHaveLength(5);
    const evidence = reports();
    evidence.c17.checks = [];
    expect(handoffDevelopmentErrors(evidence).map((error: { id: string }) => error.id)).toContain('C17_DEVELOPMENT_EVIDENCE');
  });

  it.each(['c14', 'c17'])('%s 的真实失败优先于过期的 ready 标记', id => {
    const evidence = reports();
    evidence[id].checks[0].passed = false;
    evidence[id].checks[0].status = 'failed';
    const errors = handoffDevelopmentErrors(evidence);
    expect(errors.map((error: { id: string }) => error.id)).toContain(`${id.toUpperCase()}_DEVELOPMENT_EVIDENCE`);
    expect(evaluateProjectGate({ codeErrors: errors }).development.verdict).toBe('DEV_BLOCKED');
  });

  it('C16 默认方案审计或候选损坏不能被旧 auditPassed 覆盖', () => {
    const evidence = reports();
    evidence.c16.top20Candidates.candidates.pop();
    expect(handoffDevelopmentErrors(evidence).map((error: { id: string }) => error.id)).toContain('C16_DEVELOPMENT_EVIDENCE');
  });

  it('开发决定 go 不冒充正式 Go，F 交付缺开发证据时失败关闭', () => {
    const decision = { schemaVersion: 'd07-decision/v2', decisionMode: 'development', decision: 'go' };
    expect(isFormalD07Go(decision)).toBe(false);
    expect(evaluateProjectGate({ codeErrors: [{ id: 'missing', reason: 'missing development evidence' }] })).toMatchObject({
      development: { verdict: 'DEV_BLOCKED', eligible: false },
      release: { ready: false },
    });
  });

  it('开发执行需要完整自动决定，不能只凭 go 或手动 override', () => {
    const record = JSON.parse(readFileSync('docs/implementation/evidence/d07-decision.json', 'utf8'));
    expect(isAutomatedDevelopmentDecision(record)).toBe(true);
    expect(isAutomatedDevelopmentDecision({ decision: 'go' })).toBe(false);
    expect(isAutomatedDevelopmentDecision({ ...record, reviewType: 'human' })).toBe(false);
    expect(isAutomatedDevelopmentDecision({ ...record, development: { verdict: 'DEV_BLOCKED', eligible: false } })).toBe(false);
    expect(isAutomatedDevelopmentDecision({ ...record, inputFingerprint: 'broken' })).toBe(false);
  });
});
