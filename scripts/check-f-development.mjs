import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDevelopmentEligible, isFormalD07Go } from './project-gate.mjs';
import { earlyTasks } from './f-development/early-tasks.mjs';
import { deliveryTasks } from './f-development/delivery-tasks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceIndex = process.argv.indexOf('--evidence');
const evidenceArgument = evidenceIndex >= 0 ? process.argv[evidenceIndex + 1] : null;
const noWrite = process.argv.includes('--no-write');

if (evidenceIndex >= 0 && (!evidenceArgument || evidenceArgument.startsWith('--'))) {
  throw new Error('--evidence requires a file path');
}

function absolute(relativePath) {
  return path.isAbsolute(relativePath) ? relativePath : path.resolve(root, relativePath);
}

function exists(relativePath) {
  return existsSync(absolute(relativePath));
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(absolute(relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function expectedTaskIds() {
  return Array.from({ length: 24 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`);
}

function checkTask(task, expectedStage) {
  const localEvidence = Array.isArray(task.localEvidence) ? task.localEvidence : [];
  const localTests = Array.isArray(task.localTests) ? task.localTests : [];
  return {
    ...task,
    stage: expectedStage,
    taskCardPresent: exists(`docs/execution/tasks/${task.id}.md`),
    prepCheckPresent: exists(`docs/execution/checks/${task.id}-prep.md`),
    localEvidence,
    localEvidencePresent: localEvidence.length > 0 && localEvidence.every(exists),
    localTests,
    localTestsPresent: localTests.length > 0 && localTests.every(exists),
    statePreserved: task.status === 'blocked'
      && task.acceptance === 'preparatory_not_accepted'
      && task.execution_started === false
      && task.fStarted === false,
    safetyFlagsClosed: task.realNetworkEnabled === false && task.productionDataEnabled === false,
  };
}

const tasks = [
  ...earlyTasks.map(task => checkTask(task, 'early')),
  ...deliveryTasks.map(task => checkTask(task, 'delivery')),
];
const taskIds = tasks.map(task => task.id);
const expectedIds = expectedTaskIds();
const dGate = readJson('docs/implementation/evidence/d-gate-readiness-results.json');
const d07Decision = readJson('docs/implementation/evidence/d07-decision.json');
const d07DecisionValue = typeof d07Decision?.decision === 'string' ? d07Decision.decision : null;
const formalD07Go = isFormalD07Go(d07Decision);
const gatePreserved = dGate?.status === 'blocked'
  && dGate?.acceptance === 'preparatory_not_accepted'
  && dGate?.goNoGoEligible === false
  && dGate?.eStarted === false
  && dGate?.fStarted === false;
const developmentGateEligible = isDevelopmentEligible(dGate);
const decisionGuard = !formalD07Go;
const matrixComplete = tasks.length === 24
  && taskIds.every((id, index) => id === expectedIds[index])
  && new Set(taskIds).size === expectedIds.length
  && tasks.every(task => (
    task.taskCardPresent
    && task.prepCheckPresent
    && task.localEvidencePresent
    && task.localTestsPresent
    && task.statePreserved
    && task.safetyFlagsClosed
  ));
const safetyGuard = tasks.every(task => task.realNetworkEnabled === false && task.productionDataEnabled === false);
const success = matrixComplete && gatePreserved && developmentGateEligible && safetyGuard;

const report = {
  generatedAt: new Date().toISOString(),
  scope: 'F01-F24 development-only task matrix preflight',
  mode: 'development_only',
  status: success ? 'development_ready' : 'development_blocked',
  acceptance: 'development_verified_formal_pending',
  success,
  fStarted: false,
  formalStatus: 'blocked',
  developmentStatus: success ? 'verified' : 'blocked_by_code',
  releaseStatus: 'external_pending',
  development: {
    verdict: success ? 'DEV_READY_WITH_EXTERNAL_PENDING' : 'DEV_BLOCKED',
    eligible: success,
    gateEligible: developmentGateEligible,
  },
  release: {
    verdict: 'EXTERNAL_PENDING',
    ready: false,
    formalD07Go,
  },
  realNetworkEnabled: false,
  productionDataEnabled: false,
  dGate: {
    status: dGate?.status ?? 'missing',
    acceptance: dGate?.acceptance ?? null,
    goNoGoEligible: dGate?.goNoGoEligible ?? null,
    eStarted: dGate?.eStarted ?? null,
    fStarted: dGate?.fStarted ?? null,
    developmentVerdict: dGate?.development?.verdict ?? null,
    releaseVerdict: dGate?.release?.verdict ?? null,
    preserved: gatePreserved,
  },
  d07: {
    decisionPresent: d07Decision !== null,
    decision: d07DecisionValue,
    formalGo: formalD07Go,
    goGuardPassed: decisionGuard,
  },
  matrix: {
    total: tasks.length,
    early: earlyTasks.length,
    delivery: deliveryTasks.length,
    complete: matrixComplete,
  },
  tasks,
  limitations: [
    '只验证任务卡、前置检查、开发级测试入口和门禁状态，不启动 F 业务实现。',
    '不连接真实生产网络、真实账号、儿童/家庭数据、供应商、凭证或设备。',
    '本机静态、合成、Mock、JVM、打包或测试证据不能升级为真实联调、试点、发布或正式验收。',
    'D07 正式 Go/No-Go 仍由正式决策记录和授权流程决定；本报告不替代该决策。',
  ],
};

if (evidenceArgument && !noWrite) {
  const evidencePath = absolute(evidenceArgument);
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
process.exitCode = success ? 0 : 1;
