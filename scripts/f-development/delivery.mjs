import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateArtifacts } from '../generate-contracts.mjs';
import { deliveryTasks } from './delivery-tasks.mjs';
import { isDevelopmentEligible, isFormalD07Go } from '../project-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = fileURLToPath(import.meta.url);

const requiredDemoArtifacts = [
  { path: 'README.md', kind: 'project-guide' },
  { path: 'docs/implementation/acceptance.md', kind: 'acceptance-boundary' },
  { path: 'docs/implementation/verification.md', kind: 'verification-guide' },
  { path: 'docs/implementation/demo-scenarios.md', kind: 'synthetic-demo-script' },
  { path: 'docs/implementation/evidence/acceptance-bundle-results.json', kind: 'evidence-report' },
  { path: 'docs/implementation/evidence/e2e-results.json', kind: 'evidence-report' },
  { path: 'docs/implementation/evidence/e2e.txt', kind: 'evidence-log' },
  { path: 'docs/implementation/evidence/build.txt', kind: 'build-log' },
  { path: 'docs/implementation/evidence/android-build.txt', kind: 'android-build-log' },
  { path: 'docs/implementation/evidence/desktop-package.txt', kind: 'windows-build-log' },
  { path: 'docs/implementation/evidence/desktop-package-contents.txt', kind: 'windows-package-inventory' },
  { path: 'docs/implementation/evidence/d-gate-readiness-results.json', kind: 'gate-report' },
  { path: 'docs/implementation/evidence/c14-handoff-results.json', kind: 'handoff-report' },
  { path: 'docs/implementation/evidence/c12-sandbox-results.json', kind: 'supplier-synthetic-report' },
  { path: 'docs/implementation/evidence/c12-sandbox-scope.json', kind: 'supplier-scope-report' },
];

const contractScriptNames = [
  'build',
  'contracts:check',
  'acceptance:check',
  'f:development:check',
  'android:build',
  'desktop:package',
];

const realEvidenceDefinitions = [
  {
    code: 'F13_REAL_DEVICE_DEMO',
    taskIds: ['F13'],
    evidence: ['同一候选版本的真机演示录像/记录', '演示能力标注与负责人签收'],
    reason: '本机演示脚本和录屏说明不能替代真机观察、版本绑定和人工签收。',
  },
  {
    code: 'F14_REAL_TRIAL_DEFECTS',
    taskIds: ['F14'],
    evidence: ['真实试点问题单', '关联版本的修复提交与复测记录'],
    reason: '静态测试和合成场景不能证明共享前端在真实试点中的缺陷闭环。',
  },
  {
    code: 'F15_ANDROID_DEVICE_TRIAL',
    taskIds: ['F15'],
    evidence: ['Android 真机联调/试点问题单', '系统权限、生命周期和通知回执记录'],
    reason: 'APK 存在和 JVM/Room 预检不能替代 Android 真机执行。',
  },
  {
    code: 'F16_WINDOWS_GRAPHICS_TRIAL',
    taskIds: ['F16'],
    evidence: ['Windows 真实捕获/图形矩阵', '多屏、DPI、穿透和资源释放记录'],
    reason: 'Electron 包和静态宿主检查不能替代 Windows 系统权限与图形环境实测。',
  },
  {
    code: 'F17_BACKEND_OPS_INTEGRATION',
    taskIds: ['F17'],
    evidence: ['真实 HTTP/SSE/WS/认证联调记录', '运维环境与监控演练证据'],
    reason: '契约审计不等于后端已部署、已连通或已完成运维联调。',
  },
  {
    code: 'F18_REAL_AI_MEDIA_SUPPLIER',
    taskIds: ['F18'],
    evidence: ['真实媒体 relay/接收端记录', '真实 AI/媒体供应调用与质量复核'],
    reason: '合成 relay 和供应沙箱不能替代真实媒体、供应商、质量和取消延迟证据。',
  },
  {
    code: 'F19_PRODUCTION_RECOVERY',
    taskIds: ['F19'],
    evidence: ['受控环境迁移、备份、恢复、回滚记录', '密钥、监控和权限复核'],
    reason: '临时目录中的合成状态演练不能证明生产数据恢复、权限和删除语义。',
  },
  {
    code: 'F20_ANDROID_SIGNED_DELIVERY',
    taskIds: ['F20'],
    evidence: ['受控签名 Android 发布候选包', '真机安装/升级/回退和渠道审核证据'],
    reason: 'debug APK 的文件哈希不能证明签名、安装、升级、回滚或渠道交付。',
  },
  {
    code: 'F21_WINDOWS_SIGNED_DELIVERY',
    taskIds: ['F21'],
    evidence: ['受控签名 Windows 发布候选包', '支持矩阵安装/卸载/升级/回退记录'],
    reason: '本机 Electron 输出不能证明 Windows 签名、系统安装和支持矩阵验收。',
  },
  {
    code: 'F22_INDEPENDENT_CODE_HANDOFF',
    taskIds: ['F22'],
    evidence: ['独立环境按文档构建记录', '代码/契约交接人和独立复核签收'],
    reason: '契约生成物一致只能证明本机来源可审计，不能替代独立交接和冻结。',
  },
  {
    code: 'F23_SUPPLIER_TERMS',
    taskIds: ['F23'],
    evidence: ['真实供应凭证与授权记录', '区域、价格、配额、保留条款和故障演练'],
    reason: '供应沙箱明确没有真实凭证，不能交付供应商能力或秘密。',
  },
  {
    code: 'F24_FINAL_ACCEPTANCE',
    taskIds: ['F24'],
    evidence: ['AT-01～24/NV 真实账本', '候选包安装/回滚、全基线复核和最终签收'],
    reason: '本报告不将本机检查升级为最终回归、NV 证据或正式验收。',
  },
];

const taskBoundaryDefinitions = new Map([
  ['F13', { checks: ['demoPackage'], missing: ['F13_REAL_DEVICE_DEMO'] }],
  ['F14', { checks: ['demoPackage', 'taskMatrix'], missing: ['F14_REAL_TRIAL_DEFECTS'] }],
  ['F15', { checks: ['androidCandidate', 'taskMatrix'], missing: ['F15_ANDROID_DEVICE_TRIAL'] }],
  ['F16', { checks: ['windowsCandidate', 'taskMatrix'], missing: ['F16_WINDOWS_GRAPHICS_TRIAL'] }],
  ['F17', { checks: ['contractAudit', 'codeHandoff'], missing: ['F17_BACKEND_OPS_INTEGRATION'] }],
  ['F18', { checks: ['supplierHandoff'], missing: ['F18_REAL_AI_MEDIA_SUPPLIER'] }],
  ['F19', { checks: ['backupRestoreRollback'], missing: ['F19_PRODUCTION_RECOVERY'] }],
  ['F20', { checks: ['androidCandidate'], missing: ['F20_ANDROID_SIGNED_DELIVERY'] }],
  ['F21', { checks: ['windowsCandidate'], missing: ['F21_WINDOWS_SIGNED_DELIVERY'] }],
  ['F22', { checks: ['contractAudit', 'codeHandoff'], missing: ['F22_INDEPENDENT_CODE_HANDOFF'] }],
  ['F23', { checks: ['supplierHandoff'], missing: ['F23_SUPPLIER_TERMS'] }],
  ['F24', { checks: ['demoPackage', 'contractAudit', 'backupRestoreRollback', 'androidCandidate', 'windowsCandidate', 'codeHandoff', 'supplierHandoff'], missing: ['F24_FINAL_ACCEPTANCE'] }],
]);

const regressionSources = {
  F14: ['tests/contract/schema.test.ts', 'tests/e2e/scenarios.spec.ts'],
  F15: ['tests/native/android-lab.test.ts', 'tests/platform/android-message-host.test.ts'],
  F16: ['tests/native/desktop-lab.test.ts', 'tests/platform/desktop-native-runtime.test.ts'],
  F17: ['tests/server/auth.test.ts', 'tests/sync/sqlite-store.test.ts'],
  F18: ['tests/privacy/c04-media-relay.test.ts', 'tests/provider/provider-sandbox.test.ts'],
};

function absolute(relativePath) {
  return path.isAbsolute(relativePath) ? relativePath : path.resolve(root, relativePath);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(relativePath) {
  const filename = absolute(relativePath);
  const descriptor = openSync(filename, 'r');
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytesRead));
    return hash.digest('hex');
  } finally {
    closeSync(descriptor);
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(absolute(relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function readText(relativePath) {
  try {
    return readFileSync(absolute(relativePath), 'utf8');
  } catch {
    return null;
  }
}

function inspectFile(definition) {
  const filename = absolute(definition.path);
  const present = existsSync(filename);
  const result = {
    ...definition,
    exists: present,
    bytes: present ? statSync(filename).size : 0,
    sha256: present ? fileSha256(definition.path) : null,
    parseable: definition.kind.endsWith('report') || definition.path.endsWith('.json') ? false : null,
  };
  if (present && (definition.kind.endsWith('report') || definition.path.endsWith('.json'))) {
    try {
      JSON.parse(readFileSync(filename, 'utf8'));
      result.parseable = true;
    } catch {
      result.parseable = false;
    }
  }
  return result;
}

function parseJsonOutput(output) {
  try {
    return JSON.parse(output.trim());
  } catch {
    return null;
  }
}

function offlineEnvironment(overrides = {}) {
  const environmentNames = new Set(['path', 'systemroot', 'windir', 'pathext', 'temp', 'tmp', 'tmpdir']);
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => environmentNames.has(name.toLowerCase()))),
    CI: '1',
    NPM_CONFIG_OFFLINE: 'true',
    npm_config_offline: 'true',
    PNPM_OFFLINE: 'true',
    pnpm_offline: 'true',
    NUANBAN_F_DEVELOPMENT_ONLY: '1',
    NUANBAN_REAL_NETWORK: 'false',
    NUANBAN_PRODUCTION_DATA: 'false',
    NUANBAN_REAL_DEVICES: 'false',
    NUANBAN_USE_SYNTHETIC_DATA: '1',
    ...overrides,
  };
}

function cleanupTemporaryDirectory(directory) {
  const resolved = realpathSync(directory);
  if (path.dirname(resolved) !== realpathSync(tmpdir()) || !path.basename(resolved).startsWith('nuanban-f-delivery-')) {
    throw new Error('Unsafe delivery temporary cleanup path');
  }
  rmSync(resolved, { recursive: true, force: true });
  return !existsSync(resolved);
}

function runLocalNode(args, { environment = {}, timeout = 120000 } = {}) {
  const directory = mkdtempSync(path.join(realpathSync(tmpdir()), 'nuanban-f-delivery-'));
  const guardPath = path.join(directory, 'offline-guard.mjs');
  const tracePath = path.join(directory, 'network-denials.jsonl');
  writeFileSync(guardPath, `
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const deny = api => function () {
  appendFileSync(${JSON.stringify(tracePath)}, JSON.stringify({ api }) + '\\n');
  throw new Error('F_DELIVERY_OFFLINE: ' + api);
};
for (const [module, names] of [[net, ['connect', 'createConnection']], [tls, ['connect']], [http, ['request', 'get']], [https, ['request', 'get']], [http2, ['connect']]]) {
  for (const name of names) module[name] = deny(name);
}
net.Socket.prototype.connect = deny('socket.connect');
net.Server.prototype.listen = deny('server.listen');
for (const name of ['bind', 'send', 'connect']) dgram.Socket.prototype[name] = deny('dgram.' + name);
for (const name of Object.keys(dns)) if (name === 'lookup' || name.startsWith('resolve')) dns[name] = deny('dns.' + name);
for (const name of Object.keys(dns.promises)) if (name === 'lookup' || name.startsWith('resolve')) dns.promises[name] = deny('dns.promises.' + name);
globalThis.fetch = deny('fetch');
globalThis.WebSocket = deny('WebSocket');
globalThis.EventSource = deny('EventSource');
syncBuiltinESMExports();
`, 'utf8');
  try {
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(guardPath).href, ...args], {
      cwd: root,
      env: offlineEnvironment(environment),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    const networkDenials = existsSync(tracePath) ? readFileSync(tracePath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [];
    return {
      command: [process.execPath, ...args].join(' '),
      exitCode: typeof result.status === 'number' ? result.status : null,
      signal: result.signal ?? null,
      error: result.error?.message ?? null,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      networkGuard: 'node_preload_deny_http_tls_tcp_udp_dns_fetch_websocket',
      networkDenials,
      passed: result.status === 0 && !result.error && networkDenials.length === 0,
    };
  } finally {
    cleanupTemporaryDirectory(directory);
  }
}

function summarizeCommand(commandResult) {
  return {
    command: commandResult.command,
    exitCode: commandResult.exitCode,
    signal: commandResult.signal,
    error: commandResult.error,
    passed: commandResult.passed,
    networkGuard: commandResult.networkGuard,
    networkDenials: commandResult.networkDenials,
    stdoutTail: commandResult.stdout.slice(-1200),
    stderrTail: commandResult.stderr.slice(-1200),
  };
}

function checkExecutionPassed(check) {
  return check?.executionPassed === true || check?.passed === true;
}

function parseFrontMatterValue(text, field) {
  if (!text) return null;
  const match = text.match(new RegExp(`^${field}:\\s+["']?([^"'\\r\\n]+)["']?$`, 'm'));
  return match?.[1] ?? null;
}

function inspectTaskCards() {
  const tasks = deliveryTasks.map(task => {
    const relativePath = `docs/execution/tasks/${task.id}.md`;
    const text = readText(relativePath);
    const state = {
      id: task.id,
      title: task.title,
      path: relativePath,
      present: text !== null,
      status: parseFrontMatterValue(text, 'status'),
      acceptance: parseFrontMatterValue(text, 'acceptance'),
      executionStarted: parseFrontMatterValue(text, 'execution_started'),
      fStarted: parseFrontMatterValue(text, 'fStarted'),
    };
    return {
      ...state,
      preserved: state.present && state.status === 'blocked'
        && state.acceptance === 'preparatory_not_accepted' && state.executionStarted === 'false',
    };
  });
  return {
    passed: tasks.every(task => task.preserved),
    tasks,
  };
}

export function evaluateGateEvidence(gate, decision) {
  const developmentEligible = isDevelopmentEligible(gate);
  return {
    passed: developmentEligible,
    developmentExecutionAllowed: developmentEligible,
    formalExecutionAllowed: false,
    policy: 'read_only_observation_not_a_development_authorization_gate',
    developmentStatus: developmentEligible ? 'allowed' : 'blocked_by_code',
    releaseStatus: 'release_pending',
    observedD07Decision: decision?.decision ?? null,
    formalD07Go: isFormalD07Go(decision),
    formalD07GoValidated: false,
    dGate: gate ? {
      status: gate.status ?? null,
      acceptance: gate.acceptance ?? null,
      goNoGoEligible: gate.goNoGoEligible ?? null,
      eStarted: gate.eStarted ?? null,
      fStarted: gate.fStarted ?? null,
    } : null,
  };
}

function inspectGateProtection() {
  const gate = readJson('docs/implementation/evidence/d-gate-readiness-results.json');
  const decision = readJson('docs/implementation/evidence/d07-decision.json');
  return {
    ...evaluateGateEvidence(gate, decision),
    dGatePreserved: false,
    decisionFilePresent: decision !== null,
    decision: decision?.decision ?? null,
    dGate: gate ? {
      status: gate.status ?? null,
      acceptance: gate.acceptance ?? null,
      goNoGoEligible: gate.goNoGoEligible ?? null,
      eStarted: gate.eStarted ?? null,
      fStarted: gate.fStarted ?? null,
    } : null,
    writes: {
      d07Decision: false,
      fTaskCards: false,
      existingFDevelopmentRunner: false,
    },
  };
}

function protectedFileSnapshots() {
  const files = [
    'docs/implementation/evidence/d07-decision.json',
    'docs/implementation/evidence/d07-decision.template.json',
    'docs/implementation/evidence/d-gate-readiness-results.json',
    'scripts/run-f-development.mjs',
    ...Array.from({ length: 24 }, (_, index) => `docs/execution/tasks/F${String(index + 1).padStart(2, '0')}.md`),
  ];
  return files.map(filename => ({ path: filename, sha256: existsSync(absolute(filename)) ? fileSha256(filename) : null }));
}

function compareProtectedFileSnapshots(before, after) {
  const afterByPath = new Map(after.map(file => [file.path, file.sha256]));
  return before.map(file => {
    const afterSha256 = afterByPath.get(file.path) ?? null;
    return {
      path: file.path,
      beforeSha256: file.sha256,
      afterSha256,
      unchanged: file.sha256 === afterSha256,
    };
  });
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory() && !['node_modules', 'build', 'dist', 'out', '.cache'].includes(entry.name)) return listFiles(filename);
    return entry.isFile() ? [filename] : [];
  }).sort();
}

function inspectBuild() {
  const directory = mkdtempSync(path.join(realpathSync(tmpdir()), 'nuanban-f-delivery-'));
  let report;
  try {
    const sources = [
      ...listFiles(absolute('apps/web/src')),
      ...listFiles(absolute('packages')).filter(filename => /\.(?:ts|tsx|css|json)$/.test(filename)),
      ...['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'apps/web/index.html', 'apps/web/vite.config.ts'].map(absolute),
    ].map(filename => ({ path: path.relative(root, filename).replaceAll('\\', '/'), sha256: fileSha256(filename) }));
    const typecheck = runLocalNode(['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']);
    const outputDirectory = path.join(directory, 'web');
    const build = runLocalNode([
      'node_modules/vite/bin/vite.js', 'build', absolute('apps/web'),
      '--config', absolute('apps/web/vite.config.ts'), '--configLoader', 'native',
      '--outDir', outputDirectory, '--emptyOutDir', '--logLevel', 'warn',
    ]);
    const outputs = listFiles(outputDirectory).map(filename => {
      const relativePath = path.relative(outputDirectory, filename).replaceAll('\\', '/');
      const currentPath = `apps/web/dist/${relativePath}`;
      const sha = fileSha256(filename);
      return {
        path: relativePath,
        bytes: statSync(filename).size,
        sha256: sha,
        currentWebPath: currentPath,
        currentWebSha256: existsSync(absolute(currentPath)) ? fileSha256(currentPath) : null,
        matchesCurrentWebBuild: existsSync(absolute(currentPath)) && fileSha256(currentPath) === sha,
      };
    });
    const sourceHashesPreserved = sources.every(source => existsSync(absolute(source.path)) && fileSha256(source.path) === source.sha256);
    const passed = typecheck.passed && build.passed && outputs.some(file => file.path === 'index.html') && sourceHashesPreserved;
    const outputNames = new Set(outputs.map(output => output.path));
    const extraCurrentWebFiles = listFiles(absolute('apps/web/dist')).map(filename => path.relative(absolute('apps/web/dist'), filename).replaceAll('\\', '/')).filter(filename => !outputNames.has(filename));
    report = {
      passed,
      executionPassed: passed,
      auditPassed: passed,
      status: passed ? 'passed' : 'failed',
      typecheck: summarizeCommand(typecheck),
      build: summarizeCommand(build),
      sources,
      sourceHashesPreserved,
      outputs,
      outputRetained: false,
      currentWebBuildMatches: outputs.length > 0 && outputs.every(file => file.matchesCurrentWebBuild) && extraCurrentWebFiles.length === 0,
      extraCurrentWebFiles,
      scope: 'Actual local tsc and Vite build in an isolated temporary output directory, not an independent environment or native build',
    };
  } finally {
    const cleanedUp = cleanupTemporaryDirectory(directory);
    if (report) report.cleanedUp = cleanedUp;
  }
  return report;
}

function inspectDemoPackage() {
  const taskCards = Array.from({ length: 12 }, (_, index) => {
    const id = `F${String(index + 13).padStart(2, '0')}`;
    return [
      { path: `docs/execution/tasks/${id}.md`, kind: 'task-card' },
      { path: `docs/execution/checks/${id}-prep.md`, kind: 'prep-check' },
    ];
  }).flat();
  const artifacts = [...requiredDemoArtifacts, ...taskCards].map(inspectFile);
  const demoScript = readText('docs/implementation/demo-scenarios.md') ?? '';
  const syntheticLanguagePresent = ['合成', '真实', '不替代'].every(marker => demoScript.includes(marker));
  const missing = artifacts.filter(item => !item.exists || item.parseable === false).map(item => item.path);
  return {
    passed: missing.length === 0 && syntheticLanguagePresent,
    executionPassed: missing.length === 0 && syntheticLanguagePresent,
    status: missing.length === 0 && syntheticLanguagePresent ? 'passed' : 'failed',
    requiredCount: artifacts.length,
    presentCount: artifacts.filter(item => item.exists).length,
    parseableJsonCount: artifacts.filter(item => item.parseable === true).length,
    missing,
    syntheticLanguagePresent,
    artifacts,
    limitations: [
      '清单只证明本机演示脚本、任务卡和证据文件可追踪，不证明演示内容已由真机或人工签收。',
      '演示录像、合成场景和浏览器证据不能替代 F13 的真机测试。',
    ],
  };
}

function inspectContracts() {
  const generatedFiles = [];
  let generationError = null;
  try {
    for (const [relativePath, expectedContent] of generateArtifacts()) {
      const present = existsSync(absolute(relativePath));
      const actualContent = present ? readFileSync(absolute(relativePath), 'utf8') : null;
      generatedFiles.push({
        path: relativePath,
        present,
        expectedBytes: Buffer.byteLength(expectedContent),
        actualBytes: actualContent === null ? 0 : Buffer.byteLength(actualContent),
        expectedSha256: sha256(expectedContent),
        actualSha256: actualContent === null ? null : sha256(actualContent),
        matches: actualContent === expectedContent,
      });
    }
  } catch (error) {
    generationError = error instanceof Error ? error.message : String(error);
  }
  const generatorCommand = runLocalNode(['scripts/generate-contracts.mjs', '--check']);
  const schemaCommand = runLocalNode(['scripts/validate-contracts.mjs']);
  const packageJson = readJson('package.json');
  const scripts = packageJson?.scripts ?? {};
  const missingScripts = contractScriptNames.filter(name => typeof scripts[name] !== 'string');
  const artifactMismatches = generatedFiles.filter(file => !file.matches).map(file => file.path);
  const passed = !generationError
    && generatedFiles.length > 0
    && artifactMismatches.length === 0
    && generatorCommand.passed
    && schemaCommand.passed
    && missingScripts.length === 0;
  return {
    passed,
    executionPassed: passed,
    status: passed ? 'passed' : 'failed',
    sourceOfTruth: 'packages/contracts/src/spec',
    generatedArtifactCount: generatedFiles.length,
    artifactMismatches,
    generationError,
    missingScripts,
    generatorCheck: summarizeCommand(generatorCommand),
    schemaCheck: summarizeCommand(schemaCommand),
    scriptsAudited: contractScriptNames,
    generatedFiles,
    limitations: [
      '契约审计只验证本机源定义、生成物和 JSON Schema；不等于协议冻结、后端部署或独立评审完成。',
      '生成物中的 example.invalid 地址是文档占位，不会被本执行器访问。',
    ],
  };
}

function runBackupRestoreRollbackFixture() {
  const directory = mkdtempSync(path.join(realpathSync(tmpdir()), 'nuanban-f-delivery-'));
  const evidencePath = path.join(directory, 'recovery-observations.json');
  const testResultsPath = path.join(directory, 'recovery-vitest.json');
  let report;
  try {
    const command = runLocalNode([
      'node_modules/vitest/vitest.mjs', 'run',
      'tests/acceptance/f-development-recovery.test.ts',
      '--reporter=json', `--outputFile=${testResultsPath}`,
      '--no-cache', '--no-fsModuleCache', '--configLoader=runner',
      '--maxWorkers=1', '--no-file-parallelism',
    ], { environment: { NUANBAN_F_RECOVERY_EVIDENCE: evidencePath } });
    const evidence = readJson(evidencePath);
    const tests = readJson(testResultsPath);
    const observations = evidence?.observations ?? [];
    const latest = observations.find(item => item.id === 'latest_snapshot');
    const stale = observations.find(item => item.id === 'stale_snapshot_negative_probe');
    const rollback = observations.find(item => item.id === 'destructive_schema_rollback');
    const safe = observations.find(item => item.id === 'safe_restore');
    const guardrails = observations.find(item => item.id === 'restore_guardrails');
    const sideEffects = observations.find(item => item.id === 'pending_side_effects');
    const permissionRecovery = observations.find(item => item.id === 'permission_recovery');
    const schemaGuardrails = observations.find(item => item.id === 'schema_environment_guardrails');
    const testExecutionPassed = command.passed
      && tests?.success === true
      && tests.numPassedTests === 8
      && tests.numFailedTests === 0
      && tests.numPendingTests === 0
      && latest?.executed === true
      && safe?.executed === true
      && guardrails?.executed === true
      && sideEffects?.executed === true
      && permissionRecovery?.executed === true
      && schemaGuardrails?.executed === true
      && stale?.executed === true
      && rollback?.executed === true
      && evidence?.cleanupPassed === true;
    const safeRestoreSupported = testExecutionPassed
      && evidence?.safeRestoreSupported === true
      && safe?.tombstonePreserved === true
      && safe?.accessRejected === true
      && safe?.refreshRejected === true
      && safe?.pendingSideEffectsRestored === false
      && safe?.repeatedRestoreIdempotent === true
      && safe?.sameSchemaRestartPreservesState === true;
    report = {
      passed: safeRestoreSupported,
      executionPassed: testExecutionPassed,
      status: safeRestoreSupported ? 'development_verified_external_pending' : 'failed',
      auditPassed: safeRestoreSupported,
      testExecutionPassed,
      syntheticOnly: true,
      safeRestoreSupported,
      rollbackMatchesBackup: false,
      restoreMatchesBackup: latest?.executed === true && latest.files?.every(file => file.sourceSha256 === file.copySha256) === true,
      rollbackMatchesExpectedState: safe?.sameSchemaRestartPreservesState === true,
      rollbackScope: 'same_schema_release_restart_not_schema_downgrade',
      restoreMatchesExpectedState: safeRestoreSupported,
      deletedRecordRemainsDeleted: safeRestoreSupported && safe?.tombstonePreserved === true,
      permissionsPreserved: safeRestoreSupported && safe?.accessRejected === true && safe?.refreshRejected === true,
      latestSnapshotPreservesDeletion: latest?.tombstonePreserved === true,
      latestSnapshotPreservesRevocation: latest?.accessRejected === true && latest?.refreshRejected === true,
      staleSnapshotResurrectsDeletion: stale?.deletionResurrected === true,
      staleSnapshotResurrectsAuthorization: stale?.accessResurrected === true || stale?.refreshResurrected === true,
      rawFileCopyIsUnsafe: stale?.rawFileCopyIsSafe === false,
      fixtureId: 'production-modules-temporary-sqlite-recovery-probe',
      blockerCode: evidence?.externalPendingCode ?? 'F19_RECOVERY_TEST_FAILED',
      blocker: evidence?.blocker ?? '恢复测试未产出完整可解析证据，不能证明安全恢复。',
      productionModulesExecuted: evidence?.productionModulesExecuted ?? [],
      recoveryMethod: evidence?.recoveryMethod ?? null,
      sources: evidence?.sources ?? [],
      observations,
      tests: { passed: tests?.numPassedTests ?? 0, failed: tests?.numFailedTests ?? null, pending: tests?.numPendingTests ?? null },
      command: summarizeCommand(command),
      evidenceSha256: existsSync(evidencePath) ? fileSha256(evidencePath) : null,
      testResultsSha256: existsSync(testResultsPath) ? fileSha256(testResultsPath) : null,
      limitations: [
        '执行真实 SqliteRepositories/SqliteSyncStore/NoteService/AuthService，但数据和账号仅为临时 SQLite 合成夹具。',
        '恢复入口要求保留安全检查点，在单事务中先合并删除/撤权状态，再读取旧备份；不将文件字节相同冒充安全恢复。',
        '旧快照直接文件拷贝仍会复活已删除笔记和已撤销会话，因此 raw file copy 仍明确不安全。',
        '恢复后不导入旧 outbox、mutation、提醒或任务副作用；生产恢复仍需显式核对和重建。',
        '现有 schema rollback 会丢弃账号数据，不能作为保留数据的发布回滚交付。',
        '生产凭证、受控环境、密钥/监控复核与运维签收仍属于 F19 external_pending。',
      ],
    };
  } finally {
    const cleanedUp = cleanupTemporaryDirectory(directory);
    if (report) report.cleanedUp = cleanedUp;
  }
  return report;
}

function inspectAndroidCandidate() {
  const apkPath = 'apps/android/app/build/outputs/apk/debug/app-debug.apk';
  const metadataPath = 'apps/android/app/build/outputs/apk/debug/output-metadata.json';
  const buildLogPath = 'docs/implementation/evidence/android-build.txt';
  const artifact = inspectFile({ path: apkPath, kind: 'android-development-candidate' });
  const metadata = inspectFile({ path: metadataPath, kind: 'android-build-metadata' });
  const buildLog = readText(buildLogPath) ?? '';
  const roomEvidence = readJson('docs/implementation/evidence/android-room-results.json');
  const localCandidatePresent = artifact.exists && metadata.exists && buildLog.includes('BUILD SUCCESSFUL');
  return {
    passed: localCandidatePresent,
    executionPassed: localCandidatePresent,
    status: localCandidatePresent ? 'verified_local' : 'failed',
    releaseStatus: 'release_pending',
    localVerified: localCandidatePresent,
    candidatePresent: artifact.exists,
    candidateKind: 'debug/development APK; not a release claim',
    artifact,
    metadata,
    buildEvidence: { path: buildLogPath, present: buildLog.length > 0, successful: buildLog.includes('BUILD SUCCESSFUL') },
    deviceEvidence: {
      deviceVerified: roomEvidence?.deviceVerified === true,
      adbDeviceCount: roomEvidence?.adbDeviceCount ?? 0,
      installAttempted: false,
    },
    signingEvidencePresent: false,
    installationEvidencePresent: false,
    formalCandidateAccepted: false,
    realEvidenceMissing: ['F15_ANDROID_DEVICE_TRIAL', 'F20_ANDROID_SIGNED_DELIVERY'],
    limitations: [
      '只读取本机 APK、构建日志和元数据，不调用 adb、不安装、不启动 Android 应用。',
      'debug APK 哈希不代表受控签名、升级、回退、权限、通知或渠道审核通过。',
    ],
  };
}

function inspectWindowsCandidate() {
  const exePath = 'apps/desktop/out/NuanbanDemo-win32-x64/nuanban.exe';
  const asarPath = 'apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar';
  const packageContentsPath = 'docs/implementation/evidence/desktop-package-contents.txt';
  const exe = inspectFile({ path: exePath, kind: 'windows-development-executable' });
  const asar = inspectFile({ path: asarPath, kind: 'windows-development-asar' });
  const packageContents = inspectFile({ path: packageContentsPath, kind: 'windows-package-inventory' });
  const candidateCommand = runLocalNode(['scripts/check-d03-candidate.mjs', '--no-write']);
  const candidateComparison = parseJsonOutput(candidateCommand.stdout);
  const localCandidatePresent = exe.exists && asar.exists && packageContents.exists && candidateComparison !== null;
  return {
    passed: localCandidatePresent,
    executionPassed: localCandidatePresent,
    status: localCandidatePresent ? 'verified_local' : 'failed',
    releaseStatus: 'release_pending',
    localVerified: localCandidatePresent,
    candidatePresent: exe.exists && asar.exists,
    candidateKind: 'local Electron development package; not a signed release claim',
    artifacts: { exe, asar, packageContents },
    candidateComparison: candidateComparison ? {
      command: summarizeCommand(candidateCommand),
      status: candidateComparison.status ?? null,
      success: candidateComparison.success === true,
      archiveSha256: candidateComparison.archiveSha256 ?? null,
      fileCount: Array.isArray(candidateComparison.files) ? candidateComparison.files.length : 0,
      mismatchCount: Array.isArray(candidateComparison.files) ? candidateComparison.files.filter(file => file.matches !== true).length : null,
      extraPackagedFiles: candidateComparison.extraPackagedFiles ?? [],
      errors: candidateComparison.errors ?? [],
    } : {
      command: summarizeCommand(candidateCommand),
      status: 'unavailable',
      success: false,
      archiveSha256: null,
      fileCount: 0,
      mismatchCount: null,
      extraPackagedFiles: [],
      errors: ['无法解析 D03 候选比对报告'],
    },
    signingEvidencePresent: false,
    installationEvidencePresent: false,
    systemCaptureEvidencePresent: false,
    formalCandidateAccepted: false,
    realEvidenceMissing: ['F16_WINDOWS_GRAPHICS_TRIAL', 'F21_WINDOWS_SIGNED_DELIVERY'],
    limitations: [
      '只读取本机 exe/ASAR 和 D03 UI 字节比对结果，不启动 Electron、不请求系统捕获、不安装。',
      '当前候选若存在 UI 字节漂移，报告会保留 mismatch；不能用候选存在替代重打包、签名和人工复核。',
    ],
  };
}

function inspectCodeHandoff(contractAudit) {
  const required = [
    'docs/implementation/c14-backend-handoff.md',
    'docs/implementation/evidence/c14-handoff-results.json',
    'packages/contracts/src/spec/catalog.ts',
    'packages/contracts/src/spec/operations.ts',
    'packages/contracts/src/spec/events.ts',
    'packages/contracts/openapi.json',
    'packages/contracts/src/types.generated.ts',
    'packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ContractRules.generated.kt',
  ].map(pathValue => inspectFile({ path: pathValue, kind: 'code-handoff-artifact' }));
  const handoffCommand = runLocalNode(['scripts/check-c14-handoff.mjs', '--no-write']);
  const handoffReport = parseJsonOutput(handoffCommand.stdout);
  const present = required.every(item => item.exists);
  const passed = present && contractAudit.passed && handoffCommand.passed && handoffReport?.success === true;
  return {
    passed,
    executionPassed: passed,
    status: passed ? 'verified_local' : 'failed',
    releaseStatus: 'release_pending',
    localVerified: passed,
    required,
    handoffReport: handoffReport ? {
      success: handoffReport.success === true,
      status: handoffReport.status ?? null,
      backendStarted: handoffReport.backendStarted ?? null,
      passedChecks: handoffReport.passed ?? null,
      failedChecks: handoffReport.failed ?? null,
    } : null,
    handoffCommand: summarizeCommand(handoffCommand),
    independentReviewPresent: false,
    formalContractFrozen: false,
    realEvidenceMissing: ['F17_BACKEND_OPS_INTEGRATION', 'F22_INDEPENDENT_CODE_HANDOFF'],
    limitations: [
      '代码交接只验证源契约、生成物和本机复现命令；不写入密钥、不启动真实后端。',
      'C14 success 仍是 draft_review_required，不能解释为协议冻结或独立签收。',
    ],
  };
}

function inspectSupplierHandoff() {
  const required = [
    'docs/implementation/d06-media-supplier-handoff.md',
    'docs/implementation/evidence/c12-sandbox-results.json',
    'docs/implementation/evidence/c12-sandbox-scope.json',
  ].map(pathValue => inspectFile({ path: pathValue, kind: 'supplier-handoff-artifact' }));
  const sandbox = readJson('docs/implementation/evidence/c12-sandbox-results.json');
  const scope = readJson('docs/implementation/evidence/c12-sandbox-scope.json');
  const safeSyntheticReport = Boolean(sandbox?.success)
    && scope?.realCredentialState === 'missing'
    && scope?.productionReady === false
    && Array.isArray(scope?.safetyBoundaries)
    && scope.safetyBoundaries.some(value => String(value).includes('networkAttempted'));
  const passed = required.every(item => item.exists) && safeSyntheticReport;
  return {
    passed,
    executionPassed: passed,
    status: passed ? 'verified_local' : 'failed',
    releaseStatus: 'release_pending',
    localVerified: passed,
    required,
    syntheticSandbox: {
      success: sandbox?.success === true,
      tests: sandbox?.numPassedTests ?? null,
      networkAttempted: false,
      rawPayloadsRetained: 0,
    },
    realCredentialState: scope?.realCredentialState ?? 'unknown',
    productionReady: scope?.productionReady ?? null,
    independentSupplierReview: false,
    formalSupplierHandoffAccepted: false,
    realEvidenceMissing: ['F18_REAL_AI_MEDIA_SUPPLIER', 'F23_SUPPLIER_TERMS'],
    limitations: [
      '供应交接只验证合成沙箱报告和安全边界，不读取环境变量、密钥文件或供应商端点。',
      '真实凭证、区域、价格、配额、合同、保留条款和质量证据仍保持缺失。',
    ],
  };
}

function buildTaskCoverage(checks) {
  return deliveryTasks.map(task => {
    const boundary = taskBoundaryDefinitions.get(task.id);
    const localChecks = boundary?.checks ?? [];
    return {
      id: task.id,
      title: task.title,
      dependency: task.dependency,
      owner: task.owner,
      status: 'blocked',
      acceptance: 'preparatory_not_accepted',
      developmentOnly: true,
      executionStarted: false,
      fStarted: false,
      realNetworkEnabled: false,
      productionDataEnabled: false,
      localChecks,
      localChecksPassed: localChecks.every(name => checks[name]?.passed === true),
      realEvidenceMissing: boundary?.missing ?? [],
    };
  });
}

export function runDeliveryExecution() {
  const protectedBefore = protectedFileSnapshots();
  const gateProtection = inspectGateProtection();
  const taskCards = inspectTaskCards();
  const demoPackage = inspectDemoPackage();
  const contractAudit = inspectContracts();
  const backupRestoreRollback = runBackupRestoreRollbackFixture();
  const androidCandidate = inspectAndroidCandidate();
  const windowsCandidate = inspectWindowsCandidate();
  const codeHandoff = inspectCodeHandoff(contractAudit);
  const supplierHandoff = inspectSupplierHandoff();
  const taskMatrixCommand = runLocalNode(['scripts/check-f-development.mjs', '--no-write']);
  const taskMatrix = {
    passed: taskMatrixCommand.passed && taskCards.passed,
    status: taskMatrixCommand.passed && taskCards.passed ? 'passed' : 'blocked',
    command: summarizeCommand(taskMatrixCommand),
    taskCards,
  };
  const checks = {
    demoPackage,
    contractAudit,
    backupRestoreRollback,
    androidCandidate,
    windowsCandidate,
    codeHandoff,
    supplierHandoff,
    taskMatrix,
  };
  const taskCoverage = buildTaskCoverage(checks);
  const protectedFiles = compareProtectedFileSnapshots(protectedBefore, protectedFileSnapshots());
  gateProtection.protectedFiles = protectedFiles;
  gateProtection.dGatePreserved = protectedFiles.every(file => file.unchanged);
  gateProtection.passed = gateProtection.passed && gateProtection.dGatePreserved;
  const localCheckNames = Object.keys(checks);
  const localChecksPassed = localCheckNames.filter(name => checks[name].passed).length;
  const localExecutionPassed = localCheckNames.every(name => checks[name].passed)
    && gateProtection.passed
    && backupRestoreRollback.cleanedUp;
  const realEvidenceMissing = realEvidenceDefinitions.map(item => ({ ...item, status: 'missing' }));
  const finalReview = {
    passed: localExecutionPassed,
    status: 'blocked',
    localEvidenceComplete: localExecutionPassed,
    realEvidenceComplete: false,
    formalDeliveryAllowed: false,
    missingCodes: realEvidenceMissing.map(item => item.code),
    limitation: '本机检查完成不等于 F13-F24 正式交付；所有真实层仍须按任务卡和 D/F 门禁另行取得。',
  };
  return {
    generatedAt: new Date().toISOString(),
    generatedTimeZone: 'Asia/Shanghai',
    scope: 'F13-F24 local delivery and evidence execution preflight',
    mode: 'development_only',
    status: localExecutionPassed ? 'development_checks_passed' : 'development_checks_failed',
    acceptance: 'preparatory_not_accepted',
    success: localExecutionPassed,
    localExecution: {
      success: localExecutionPassed,
      checksRun: localCheckNames.length,
      checksPassed: localChecksPassed,
      checksBlockedOrFailed: localCheckNames.length - localChecksPassed,
      syntheticFixture: backupRestoreRollback.fixtureId,
    },
    realEvidenceComplete: false,
    formalDeliveryAllowed: false,
    realNetworkEnabled: false,
    deviceAccessEnabled: false,
    realAccountsEnabled: false,
    productionDataEnabled: false,
    providerAccessEnabled: false,
    offline: true,
    synthetic: true,
    executionPolicy: {
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
    },
    stateProtection: gateProtection,
    taskMatrix: {
      total: taskCoverage.length,
      delivery: taskCoverage.length,
      complete: taskCoverage.length === 12,
      allStatesPreserved: taskCards.passed,
    },
    taskCoverage,
    checks: {
      ...checks,
      finalEvidenceReview: finalReview,
    },
    realEvidenceMissing,
    limitations: [
      '本执行器只读取仓库文件、运行本机只读脚本和临时合成夹具；不连接真实网络、设备、账号、生产数据或供应商。',
      'Android/Windows 结果是候选包存在性、哈希、构建日志或本机包比对，不是签名、安装、升级、回退、系统权限或人工验收。',
      '契约、代码和供应审计只证明本机可追踪性；不等于协议冻结、后端连通、供应条款或独立复核完成。',
      '备份/恢复/回滚夹具只使用 synthetic-subject 数据并在临时目录清理；不证明真实数据库、密钥、监控或删除恢复行为。',
      'F13-F24 任务卡、D07 决策、D 关口和 scripts/run-f-development.mjs 均保持只读；正式状态仍为 blocked。',
    ],
  };
}

function parseArguments(argumentsList) {
  const evidenceIndex = argumentsList.indexOf('--evidence');
  const noWrite = argumentsList.includes('--no-write');
  if (evidenceIndex >= 0 && (!argumentsList[evidenceIndex + 1] || argumentsList[evidenceIndex + 1].startsWith('--'))) {
    throw new Error('--evidence requires a file path');
  }
  return {
    noWrite,
    evidencePath: evidenceIndex >= 0 ? argumentsList[evidenceIndex + 1] : null,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  const options = parseArguments(process.argv.slice(2));
  const report = runDeliveryExecution();
  if (options.evidencePath && !options.noWrite) {
    const evidencePath = absolute(options.evidencePath);
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.success ? 0 : 1;
}
