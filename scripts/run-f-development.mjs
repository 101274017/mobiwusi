import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAutomatedDevelopmentDecision, isDevelopmentEligible, isFormalD07Go } from './project-gate.mjs';
import { runD07DecisionCheck } from './check-d07-decision.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bypassD07 = process.argv.includes('--bypass-d07');
const noWrite = process.argv.includes('--no-write');
const evidenceIndex = process.argv.indexOf('--evidence');
const evidenceArgument = evidenceIndex >= 0 ? process.argv[evidenceIndex + 1] : null;
const onlyIndex = process.argv.indexOf('--only');
const onlyArgument = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;

if (evidenceIndex >= 0 && (!evidenceArgument || evidenceArgument.startsWith('--'))) {
  throw new Error('--evidence requires a file path');
} else if (onlyIndex >= 0 && (!onlyArgument || onlyArgument.startsWith('--'))) {
  throw new Error('--only requires a comma-separated job list');
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

function runJob(job) {
  return new Promise(resolve => {
    const startedAt = Date.now();
    const child = spawn(job.command, job.args, {
      cwd: root,
      shell: job.shell ?? false,
      env: {
        ...process.env,
        CI: '1',
        NPM_CONFIG_OFFLINE: 'true',
        PNPM_OFFLINE: 'true',
        NUANBAN_F_DEVELOPMENT_ONLY: '1',
        NUANBAN_REAL_NETWORK: 'false',
        NUANBAN_PRODUCTION_DATA: 'false',
      },
      windowsHide: true,
      timeout: 120_000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => resolve({
      id: job.id,
      command: [job.command, ...job.args].join(' '),
      exitCode: null,
      durationMs: Date.now() - startedAt,
      error: error.message,
      stdoutFull: stdout,
      stderrFull: stderr,
      stdout: stdout.slice(-2000),
      stderr: stderr.slice(-2000),
    }));
    child.on('close', exitCode => resolve({
      id: job.id,
      command: [job.command, ...job.args].join(' '),
      exitCode,
      durationMs: Date.now() - startedAt,
      stdoutFull: stdout,
      stderrFull: stderr,
      stdout: stdout.slice(-2000),
      stderr: stderr.slice(-2000),
    }));
  });
}

const vitestCommand = process.execPath;
const vitestModule = absolute('node_modules/vitest/vitest.mjs');
const vitestArgs = testFiles => [vitestModule, 'run', ...testFiles, '--reporter=dot', '--no-cache', '--no-fsModuleCache', '--configLoader=runner', '--maxWorkers=1', '--no-file-parallelism'];
const localJobs = [
  {
    id: 'f-matrix',
    command: process.execPath,
    args: ['scripts/check-f-development.mjs', '--no-write'],
  },
  {
    id: 'f-dependencies',
    command: process.execPath,
    args: ['scripts/f-development/dependency-matrix.mjs', '--no-write'],
  },
  {
    id: 'gate-protection',
    command: vitestCommand,
    args: vitestArgs([
      'tests/acceptance/f-development-early.test.ts',
      'tests/acceptance/f-development-delivery.test.ts',
      'tests/acceptance/d-gate-readiness.test.ts',
      'tests/acceptance/d07-decision.test.ts',
    ]),
  },
  {
    id: 'local-platform',
    command: vitestCommand,
    args: vitestArgs([
      'tests/native/android-lab.test.ts',
      'tests/native/desktop-lab.test.ts',
      'tests/platform/android-message-host.test.ts',
      'tests/platform/desktop-native-runtime.test.ts',
      'tests/platform/desktop-reminder-bridge.test.ts',
    ]),
  },
  {
    id: 'local-domain-safety',
    command: vitestCommand,
    args: vitestArgs([
      'tests/domain/guidance-platform.test.ts',
      'tests/domain/reminder-engine.test.ts',
      'tests/domain/reminder-dispatch.test.ts',
      'tests/provider/provider-sandbox.test.ts',
      'tests/privacy/c03-gate.test.ts',
      'tests/privacy/c04-media-relay.test.ts',
    ]),
  },
];

const selectedIds = onlyArgument ? new Set(onlyArgument.split(',').map(value => value.trim()).filter(Boolean)) : null;
const jobs = selectedIds ? localJobs.filter(job => selectedIds.has(job.id)) : localJobs;
const unknownIds = selectedIds ? [...selectedIds].filter(id => !localJobs.some(job => job.id === id)) : [];
const overrideRecordPresent = existsSync(path.join(root, 'docs/execution/F-development-override.md'));
const dGate = readJson('docs/implementation/evidence/d-gate-readiness-results.json');
const d07Decision = readJson('docs/implementation/evidence/d07-decision.json');
const developmentGateEligible = isDevelopmentEligible(dGate);
const currentDecisionCheck = runD07DecisionCheck();
const automatedDecisionEligible = currentDecisionCheck.eligible && isAutomatedDevelopmentDecision(currentDecisionCheck.generatedDecision);
const formalD07Go = isFormalD07Go(d07Decision);
let results = [];
if (automatedDecisionEligible && developmentGateEligible && unknownIds.length === 0 && jobs.length > 0) {
  const concurrency = Math.min(2, jobs.length);
  const pendingJobs = [...jobs];
  const workers = Array.from({ length: concurrency }, async () => {
    const workerResults = [];
    while (pendingJobs.length > 0) {
      const job = pendingJobs.shift();
      if (job) workerResults.push(await runJob(job));
    }
    return workerResults;
  });
  results = (await Promise.all(workers)).flat();
}

const checkResult = results.find(result => result.id === 'f-matrix');
let matrixReport = null;
try {
  matrixReport = checkResult?.stdoutFull ? JSON.parse(checkResult.stdoutFull) : null;
} catch {
  matrixReport = null;
}
const reportResults = results.map(({ stdoutFull, stderrFull, ...result }) => result);
const success = automatedDecisionEligible
  && unknownIds.length === 0
  && jobs.length > 0
  && results.length === jobs.length
  && results.every(result => result.exitCode === 0)
  && developmentGateEligible
  && matrixReport?.success === true
  && matrixReport?.realNetworkEnabled === false
  && matrixReport?.productionDataEnabled === false;
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'F01-F24 development-only local execution under the V1.2 automated gate',
  mode: 'development_only',
  status: success ? 'development_checks_passed' : 'development_checks_failed',
  success,
  d07Bypassed: bypassD07,
  formalD07Go,
  developmentOverride: overrideRecordPresent,
  developmentAuthorization: 'automated_d07',
  automatedDecisionEligible,
  developmentBlockers: currentDecisionCheck.developmentBlockers,
  realNetworkEnabled: false,
  productionDataEnabled: false,
  fStarted: false,
  formalFExecutionStarted: false,
  development: {
    verdict: success ? 'DEV_READY_WITH_EXTERNAL_PENDING' : 'DEV_BLOCKED',
    eligible: success && developmentGateEligible,
    gateEligible: developmentGateEligible,
  },
  release: {
    verdict: 'EXTERNAL_PENDING',
    ready: false,
    formalD07Go,
  },
  formalStatus: 'blocked',
  dGate: {
    status: dGate?.status ?? 'missing',
    developmentVerdict: dGate?.development?.verdict ?? null,
    releaseVerdict: dGate?.release?.verdict ?? null,
  },
  matrix: matrixReport?.matrix ?? null,
  jobs: reportResults,
  unknownJobIds: unknownIds,
  limitations: [
    '所有子命令仅使用本机离线依赖和合成/静态测试；运行器不会启动生产服务、真实网络、设备或供应商。',
    'V1.2 自动开发决定允许本机工程执行；--bypass-d07 仅保留为兼容参数，不绕过实际开发失败或正式发布门禁。',
    '子测试通过只证明本机开发层可重复，不证明真实双端联调、试点、发布或正式验收。',
  ],
};

if (evidenceArgument && !noWrite) {
  const evidencePath = absolute(evidenceArgument);
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
process.exitCode = success ? 0 : 1;
