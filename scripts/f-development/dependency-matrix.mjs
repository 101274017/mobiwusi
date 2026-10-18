import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { earlyTasks } from './early-tasks.mjs';
import { deliveryTasks } from './delivery-tasks.mjs';
import { isAutomatedDevelopmentDecision, isDevelopmentEligible, isFormalD07Go } from '../project-gate.mjs';
import { runD07DecisionCheck } from '../check-d07-decision.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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

function readTaskState(id) {
  const relativePath = `docs/execution/tasks/${id}.md`;
  try {
    const source = readFileSync(absolute(relativePath), 'utf8');
    const value = (pattern, fallback = null) => source.match(pattern)?.[1] ?? fallback;
    return {
      id,
      path: relativePath,
      present: true,
      status: value(/^status:\s*"([^"]+)"/m),
      acceptance: value(/^acceptance:\s*"([^"]+)"/m),
      developmentStatus: value(/^development_status:\s*"([^"]+)"/m),
      executionStarted: value(/^execution_started:\s*(true|false)/m) === 'true',
    };
  } catch {
    return { id, path: relativePath, present: false, status: null, acceptance: null, developmentStatus: null, executionStarted: false };
  }
}

const taskPrerequisites = {
  F01: [['E16', 'FS'], ['E22', 'FS'], ['E25', 'FS']],
  F02: [['E16', 'FS'], ['E22', 'FS'], ['E25', 'FS']],
  F03: [['E16', 'FS'], ['E22', 'FS'], ['E25', 'FS']],
  F04: [['E16', 'FS'], ['E22', 'FS'], ['E25', 'FS']],
  F05: [['E16', 'FS'], ['E22', 'FS'], ['E25', 'FS']],
  F06: [['E16', 'FS'], ['E22', 'FS'], ['E25', 'FS']],
  F07: [['F06', 'SS'], ['F01', 'SS'], ['F02', 'SS'], ['F03', 'SS'], ['F04', 'SS'], ['F05', 'SS']],
  F08: [['F07', 'SS']],
  F09: [['F08', 'SS/FF']],
  F10: [['E24', 'FS'], ['F08', 'SS']],
  F11: [['F08', 'FS/FF'], ['F09', 'FS/FF'], ['F24', 'FS/FF']],
  F12: [['E21', 'FS'], ['F10', 'SS']],
  F13: [['F12', 'FS']],
  F14: [['F01', 'SS'], ['F02', 'SS'], ['F03', 'SS'], ['F04', 'SS'], ['F05', 'SS'], ['F06', 'SS']],
  F15: [['F01', 'SS'], ['F02', 'SS'], ['F03', 'SS'], ['F04', 'SS'], ['F05', 'SS'], ['F06', 'SS']],
  F16: [['F01', 'SS'], ['F02', 'SS'], ['F03', 'SS'], ['F04', 'SS'], ['F05', 'SS'], ['F06', 'SS']],
  F17: [['F01', 'SS'], ['F02', 'SS'], ['F03', 'SS'], ['F04', 'SS'], ['F05', 'SS'], ['F06', 'SS']],
  F18: [['F01', 'SS'], ['F02', 'SS'], ['F03', 'SS'], ['F04', 'SS'], ['F05', 'SS'], ['F06', 'SS']],
  F19: [['F07', 'FS'], ['F17', 'FS']],
  F20: [['F15', 'FS']],
  F21: [['F16', 'FS']],
  F22: [['F14', 'FS']],
  F23: [['F18', 'FS']],
  F24: [['F09', 'FS'], ['F19', 'SS/FF'], ['F20', 'SS/FF'], ['F21', 'SS/FF'], ['F22', 'SS/FF'], ['F23', 'SS/FF']],
};

const taskInputIds = {
  F14: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09'],
  F15: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09'],
  F16: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09'],
  F17: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09'],
  F18: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09'],
};

const dGate = readJson('docs/implementation/evidence/d-gate-readiness-results.json');
const d07Decision = readJson('docs/implementation/evidence/d07-decision.json');
const formalD07Go = isFormalD07Go(d07Decision);
const gateStillBlocked = dGate?.status === 'blocked'
  && dGate?.acceptance === 'preparatory_not_accepted'
  && dGate?.goNoGoEligible === false
  && dGate?.eStarted === false
  && dGate?.fStarted === false;
const developmentGateEligible = isDevelopmentEligible(dGate);
const currentDecisionCheck = runD07DecisionCheck();
const automatedDecisionEligible = currentDecisionCheck.eligible && isAutomatedDevelopmentDecision(currentDecisionCheck.generatedDecision);
const overrideRecordPresent = exists('docs/execution/F-development-override.md');
const allTasks = [
  ...earlyTasks.map(task => ({ ...task, stage: 'early' })),
  ...deliveryTasks.map(task => ({ ...task, stage: 'delivery' })),
];
const taskById = new Map(allTasks.map(task => [task.id, task]));

function dependencyState([id, relation]) {
  const state = readTaskState(id);
  const ready = state.present
    && (['implemented', 'verified', 'checks_passed'].includes(state.developmentStatus) || state.status === 'completed' || state.status === 'accepted')
    && state.executionStarted === false;
  return { id, relation, ...state, ready };
}

function evaluateTask(task) {
  const card = readTaskState(task.id);
  const prerequisites = (taskPrerequisites[task.id] ?? []).map(dependencyState);
  const missingPrerequisites = prerequisites.filter(item => !item.ready);
  const blockers = [
    ...(gateStillBlocked && developmentGateEligible ? ['D07 release gate remains external_pending; development gate is eligible'] : ['D07 development gate is not eligible']),
    ...(card.status === 'blocked' && card.acceptance === 'preparatory_not_accepted'
      ? ['F task card remains blocked / preparatory_not_accepted']
      : ['F task card state is not preserved']),
    ...missingPrerequisites.map(item => `${item.id} prerequisite is not accepted (${item.relation})`),
    'Real account, device, supplier, authorization, independent review, and human acceptance remain required for formal F execution',
  ];
  return {
    id: task.id,
    title: task.title,
    stage: task.stage,
    dependency: task.dependency,
    owner: task.owner,
    prerequisites,
    inputIds: taskInputIds[task.id] ?? [],
    card,
    blockers,
    status: developmentGateEligible ? 'development_ready' : 'development_blocked',
    formalStatus: 'blocked',
    developmentStatus: developmentGateEligible ? 'ready_for_local_checks' : 'blocked_by_code',
    developmentOnly: true,
    developmentExecutionAllowed: automatedDecisionEligible && developmentGateEligible && missingPrerequisites.length === 0,
    realExecutionAllowed: false,
    realNetworkEnabled: false,
    productionDataEnabled: false,
  };
}

const tasks = allTasks.map(evaluateTask);
const expectedIds = Array.from({ length: 24 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`);
const ids = tasks.map(task => task.id);
const matrixComplete = ids.length === 24
  && ids.every((id, index) => id === expectedIds[index])
  && new Set(ids).size === 24
  && tasks.every(task => (
    task.card.present
    && task.card.status === 'blocked'
    && task.card.acceptance === 'preparatory_not_accepted'
    && task.card.executionStarted === false
    && task.blockers.length > 0
  ));
const success = automatedDecisionEligible
  && gateStillBlocked
  && developmentGateEligible
  && matrixComplete
  && tasks.every(task => task.realExecutionAllowed === false && task.realNetworkEnabled === false && task.productionDataEnabled === false);

const report = {
  generatedAt: new Date().toISOString(),
  scope: 'F01-F24 development-only dependency matrix under the automated D07 gate',
  mode: 'development_only',
  status: success ? 'development_ready' : 'development_blocked',
  acceptance: 'development_verified_formal_pending',
  success,
  formalStatus: 'blocked',
  developmentStatus: success ? 'verified' : 'blocked_by_code',
  releaseStatus: 'external_pending',
  development: {
    verdict: success ? 'DEV_READY_WITH_EXTERNAL_PENDING' : 'DEV_BLOCKED',
    eligible: success,
    gateEligible: developmentGateEligible,
  },
  release: { verdict: 'EXTERNAL_PENDING', ready: false, formalD07Go },
  developmentOverride: overrideRecordPresent,
  developmentAuthorization: 'automated_d07',
  automatedDecisionEligible,
  developmentBlockers: currentDecisionCheck.developmentBlockers,
  d07Bypassed: false,
  formalD07Go,
  realNetworkEnabled: false,
  productionDataEnabled: false,
  developmentExecutionAllowed: automatedDecisionEligible && developmentGateEligible && tasks.every(task => task.developmentExecutionAllowed),
  realExecutionAllowed: false,
  dGate: {
    status: dGate?.status ?? 'missing',
    acceptance: dGate?.acceptance ?? null,
    goNoGoEligible: dGate?.goNoGoEligible ?? null,
    eStarted: dGate?.eStarted ?? null,
    fStarted: dGate?.fStarted ?? null,
    developmentVerdict: dGate?.development?.verdict ?? null,
    releaseVerdict: dGate?.release?.verdict ?? null,
    preserved: gateStillBlocked,
  },
  matrix: {
    total: tasks.length,
    early: tasks.filter(task => task.stage === 'early').length,
    delivery: tasks.filter(task => task.stage === 'delivery').length,
    complete: matrixComplete,
  },
  tasks,
  limitations: [
    '本报告按 V1.2 自动开发门禁计算，不创建、不修改或伪造正式 Go/No-Go 决策。',
    'developmentExecutionAllowed 只覆盖本机代码、夹具、静态检查和受限测试；不等于真实 F 执行授权。',
    '真实网络、真实账号、儿童/家庭数据、供应商、凭证、设备系统权限、试点和发布均保持关闭或未验收。',
  ],
};

if (evidenceArgument && !noWrite) {
  const evidencePath = absolute(evidenceArgument);
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
process.exitCode = success ? 0 : 1;
