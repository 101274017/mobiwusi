import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAutomatedDevelopmentDecision, isDevelopmentEligible, isFormalD07Go } from '../project-gate.mjs';
import { runD07DecisionCheck } from '../check-d07-decision.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bypassD07 = process.argv.includes('--bypass-d07');
const noWrite = process.argv.includes('--no-write');
const evidenceIndex = process.argv.indexOf('--evidence');
const evidenceArgument = evidenceIndex >= 0 ? process.argv[evidenceIndex + 1] : null;

if (evidenceIndex >= 0 && (!evidenceArgument || evidenceArgument.startsWith('--'))) {
  throw new Error('--evidence requires a file path');
}

function absolute(relativePath) {
  return path.isAbsolute(relativePath) ? relativePath : path.resolve(root, relativePath);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(absolute(relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function parseReport(output) {
  const source = output.trim();
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {
    const lines = source.split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line.startsWith('{')) continue;
      try {
        return JSON.parse(line);
      } catch {
        continue;
      }
    }
    return null;
  }
}

function runStage(stage) {
  return new Promise(resolve => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [absolute(stage.script), '--no-write'], {
      cwd: root,
      env: {
        ...process.env,
        CI: '1',
        NPM_CONFIG_OFFLINE: 'true',
        PNPM_OFFLINE: 'true',
        NUANBAN_F_DEVELOPMENT_ONLY: '1',
        NUANBAN_REAL_NETWORK: 'false',
        NUANBAN_PRODUCTION_DATA: 'false',
        NUANBAN_REAL_DEVICES: 'false',
      },
      windowsHide: true,
      timeout: 120_000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    const finish = (exitCode, error = null) => {
      const report = parseReport(stdout);
      const safetyClosed = report?.realNetworkEnabled === false
        && report?.productionDataEnabled === false
        && report?.mode === 'development_only';
      resolve({
        id: stage.id,
        tasks: stage.tasks,
        script: stage.script,
        exitCode,
        durationMs: Date.now() - startedAt,
        success: exitCode === 0 && report?.success === true && safetyClosed,
        safetyClosed,
        report,
        error,
        stdout: stdout.slice(-3000),
        stderr: stderr.slice(-3000),
      });
    };
    child.on('error', error => finish(null, error.message));
    child.on('close', exitCode => finish(exitCode));
  });
}

const stages = [
  { id: 'f01-f06-integration', script: 'scripts/f-development/integration.mjs', tasks: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06'] },
  { id: 'f07-f12-reliability', script: 'scripts/f-development/reliability.mjs', tasks: ['F07', 'F08', 'F09', 'F10', 'F11', 'F12'] },
  { id: 'f13-f24-delivery', script: 'scripts/f-development/delivery.mjs', tasks: ['F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24'] },
];

const dGate = readJson('docs/implementation/evidence/d-gate-readiness-results.json');
const d07Decision = readJson('docs/implementation/evidence/d07-decision.json');
const overrideRecordPresent = existsSync(absolute('docs/execution/F-development-override.md'));
const developmentGateEligible = isDevelopmentEligible(dGate);
const currentDecisionCheck = runD07DecisionCheck();
const automatedDecisionEligible = currentDecisionCheck.eligible && isAutomatedDevelopmentDecision(currentDecisionCheck.generatedDecision);
const gatePreserved = dGate?.status === 'blocked'
  && dGate?.acceptance === 'preparatory_not_accepted'
  && dGate?.goNoGoEligible === false
  && dGate?.eStarted === false
  && dGate?.fStarted === false;
const formalD07Go = isFormalD07Go(d07Decision);

let stageResults = [];
if (automatedDecisionEligible && gatePreserved && developmentGateEligible) {
  for (const stage of stages) {
    const result = await runStage(stage);
    stageResults.push(result);
    if (!result.success) break;
  }
}

const completedStageIds = new Set(stageResults.filter(stage => stage.success).map(stage => stage.id));
const tasks = stages.flatMap(stage => stage.tasks.map(id => ({
  id,
  stage: stage.id,
  developmentStatus: completedStageIds.has(stage.id) ? 'checks_passed' : 'not_verified',
  formalStatus: 'blocked',
  formalAcceptance: 'preparatory_not_accepted',
  formalExecutionStarted: false,
  evidence: (() => {
    const stageReport = stageResults.find(result => result.id === stage.id)?.report;
    return (stageReport?.tasks ?? stageReport?.taskCoverage ?? []).find(task => task.id === id) ?? null;
  })(),
})));
const success = automatedDecisionEligible
  && gatePreserved
  && developmentGateEligible
  && stageResults.length === stages.length
  && stageResults.every(stage => stage.success)
  && tasks.length === 24
  && tasks.every(task => task.developmentStatus === 'checks_passed' && task.evidence !== null);
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'F01-F24 local checks and unresolved delivery requirements',
  mode: 'development_only',
  status: success ? 'development_checks_passed' : 'development_checks_failed',
  success,
  formalComplete: false,
  d07Bypassed: bypassD07,
  formalD07Go,
  developmentOverride: overrideRecordPresent,
  developmentAuthorization: 'automated_d07',
  automatedDecisionEligible,
  developmentBlockers: currentDecisionCheck.developmentBlockers,
  realNetworkEnabled: false,
  productionDataEnabled: false,
  realDevicesEnabled: false,
  fStarted: false,
  formalFExecutionStarted: false,
  development: {
    verdict: success ? 'DEV_READY_WITH_EXTERNAL_PENDING' : 'DEV_BLOCKED',
    eligible: success,
    gateEligible: developmentGateEligible,
  },
  release: { verdict: 'EXTERNAL_PENDING', ready: false, formalD07Go },
  formalStatus: 'blocked',
  dGate: {
    preserved: gatePreserved,
    status: dGate?.status ?? 'missing',
    developmentVerdict: dGate?.development?.verdict ?? null,
    releaseVerdict: dGate?.release?.verdict ?? null,
  },
  stages: stageResults,
  tasks,
  limitations: [
    '本机执行不替代真实双端联调、设备验证、试点反馈、签名交付或人工签收。',
    'V1.2 自动开发决定不改变正式决策或 F 任务卡的正式验收结论；旧绕过参数不能掩盖实际开发失败。',
    'checks_passed 只描述实际执行的开发检查，不表示对应原始 WBS 工作包完成。',
  ],
};

if (evidenceArgument && !noWrite) {
  const evidencePath = absolute(evidenceArgument);
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
process.exitCode = success ? 0 : 1;

