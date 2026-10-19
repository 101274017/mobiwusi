import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { crc32, inflateSync } from 'node:zlib';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, Script } from 'node:vm';
import ts from 'typescript';
import { runD07DecisionCheck } from './check-d07-decision.mjs';
import { readImplementationPlan } from './implementation-plan.mjs';
import { assertGateMode, evaluateProjectGate, exitCodeForGate } from './project-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = 'docs/implementation/evidence/release-readiness.json';
const listPath = 'docs/implementation/external-capabilities.md';
const androidRoot = 'apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/';
const providerPath = 'packages/provider-sandbox/src/index.ts';
const privacyPath = 'packages/privacy/src/index.ts';
const desktopPath = 'apps/desktop/native-runtime.cjs';
const configPath = 'packages/config/src/index.ts';
const standaloneGuidancePath = 'apps/server/src/standalone-guidance.ts';
const evidencePaths = Object.fromEntries([
  ['c15', 'c15-nv-readiness-results'], ['c16', 'c16-decision-readiness-results'],
  ['d07', 'd07-decision'], ['f', 'f-execution-results'],
].map(([name, file]) => [name, `docs/implementation/evidence/${file}.json`]));
const publicKeys = ['VITE_API_MODE', 'VITE_PLATFORM_MODE', 'VITE_MOCK_SCENARIO', 'VITE_DEPLOYMENT', 'VITE_API_BASE_URL'];
const providers = ['carrier_auth', 'face_auth', 'multimodal', 'asr', 'tts', 'pet_generation'];
const hash = value => createHash('sha256').update(value).digest('hex');

function localRead(relativePath, directory = root) {
  const absoluteRoot = path.resolve(directory);
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  if (!absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('Input outside workspace');
  try {
    if (!realpathSync(absolutePath).startsWith(`${realpathSync(absoluteRoot)}${path.sep}`)) throw new Error('Input outside workspace');
    return readFileSync(absolutePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error('Local input unavailable');
  }
}

function publicConfiguration(read, environment, profile) {
  const values = {};
  const origins = {};
  const files = ['.env', '.env.local', `.env.${profile}`, `.env.${profile}.local`].map(file => `apps/web/${file}`);
  for (const file of files) {
    const contents = read(file);
    if (contents === null) continue;
    for (const line of contents.split(/\r?\n/)) {
      const key = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/.exec(line)?.[1];
      if (!publicKeys.includes(key)) continue;
      let value = line.slice(line.indexOf('=') + 1).trim();
      if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, '').trim();
      values[key] = value;
      origins[key] = file;
    }
  }
  for (const key of publicKeys) {
    if (typeof environment[key] === 'string') {
      values[key] = environment[key];
      origins[key] = 'process.env';
    }
  }
  const enumeration = (key, allowed, fallback) => allowed.includes(values[key] ?? fallback) ? values[key] ?? fallback : 'INVALID';
  let endpoint = 'unset';
  if (values.VITE_API_BASE_URL) {
    try {
      const url = new URL(values.VITE_API_BASE_URL);
      endpoint = !['http:', 'https:'].includes(url.protocol) || url.username || url.password ? 'invalid'
        : ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ? 'loopback' : 'remote';
    } catch { endpoint = 'invalid'; }
  }
  return {
    input: values,
    summary: {
      profile,
      apiMode: enumeration('VITE_API_MODE', ['local', 'real'], 'local'),
      platformMode: enumeration('VITE_PLATFORM_MODE', ['browser', 'windows', 'android'], 'browser'),
      deployment: enumeration('VITE_DEPLOYMENT', ['production', 'development'], 'development'),
      apiEndpoint: endpoint,
      origins,
      searchedFiles: files,
      exampleIsNotActiveConfiguration: true,
    },
  };
}

function offlineModules(source) {
  const cache = new Map();
  return function load(relativePath) {
    if (cache.has(relativePath)) return cache.get(relativePath);
    const text = source(relativePath);
    if (text === null) throw new Error('Source missing');
    const module = { exports: {} };
    const context = createContext({
      module, exports: module.exports, AbortController, structuredClone, setTimeout, clearTimeout,
      ...(relativePath === standaloneGuidancePath ? { process: { env: {} }, Buffer, URL } : {}),
      require(specifier) {
        if (relativePath === desktopPath && specifier === 'node:path') return path;
        if (relativePath === standaloneGuidancePath && specifier === 'node:crypto') return { createHash };
        if (relativePath === standaloneGuidancePath && specifier === 'node:net') return { isIP };
        if (relativePath === standaloneGuidancePath && specifier === 'node:zlib') return { crc32, inflateSync };
        throw new Error('Import unavailable in offline probe');
      },
    }, { codeGeneration: { strings: false, wasm: false } });
    const compiled = relativePath.endsWith('.ts')
      ? ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
      : text;
    new Script(compiled).runInContext(context, { timeout: 1000 });
    cache.set(relativePath, module.exports);
    return module.exports;
  };
}

function nodes(source, predicate) {
  const matches = [];
  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return matches;
}

function parsedSource(file, source) {
  const text = source(file);
  if (text === null) throw new Error('Source missing');
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

function serverModulesUnmounted(source) {
  const main = parsedSource('apps/server/src/main.ts', source);
  const calls = nodes(main, node => ts.isCallExpression(node) && node.expression.getText(main) === 'createApplication');
  const http = parsedSource('apps/server/src/http.ts', source);
  const dispatches = nodes(http, node => ts.isCallExpression(node) && node.expression.getText(http) === 'dispatchServiceRoute');
  return calls.length === 1 && ts.isObjectLiteralExpression(calls[0].arguments[0])
    && calls[0].arguments[0].properties.every(property => ts.isPropertyAssignment(property)
      && (property.name.getText(main) === 'storage'
        || (property.name.getText(main) === 'standaloneGuidance' && ts.isCallExpression(property.initializer)
          && property.initializer.expression.getText(main) === 'createStandaloneGuidanceService'
          && property.initializer.arguments.length === 0)))
    && nodes(main, node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === './standalone-guidance.ts'
      && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
      && node.importClause.namedBindings.elements.some(element => element.name.text === 'createStandaloneGuidanceService' && !element.propertyName)).length === 1
    && dispatches.length === 1 && ts.isObjectLiteralExpression(dispatches[0].arguments[0])
    && dispatches[0].arguments[0].properties.some(property => ts.isPropertyAssignment(property)
      && property.name.getText(http) === 'modules' && property.initializer.getText(http) === 'options.modules')
    && nodes(http, node => ts.isBinaryExpression(node) && node.left.getText(http) === 'options.modules').length === 0;
}

function desktopBridgeClosed(source, policy) {
  const main = parsedSource('apps/desktop/main.cjs', source);
  const registrations = nodes(main, node => ts.isCallExpression(node) && node.expression.getText(main) === 'ipcMain.handle'
    && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === 'nuanban:capabilities');
  if (registrations.length !== 1) return false;
  const handler = registrations[0].arguments[1];
  const context = createContext({
    safeStorage: undefined, Notification: undefined, reminderStore: undefined,
    createWindowsCapabilityPolicy: () => policy, requireTrusted() {},
  }, { codeGeneration: { strings: false, wasm: false } });
  const result = new Script(`(${handler.getText(main)})({})`).runInContext(context, { timeout: 1000 });
  return ['externalCapture', 'remoteMedia', 'nativeOverlay'].every(key => result[key] === false);
}

function androidCaptureClosed(source) {
  const withoutComments = file => source(file)?.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '') ?? '';
  const runtime = withoutComments(`${androidRoot}NativeCaptureRuntime.kt`);
  const service = withoutComments(`${androidRoot}NativeCaptureService.kt`);
  const gate = withoutComments(`${androidRoot}LocalFrameGate.kt`);
  return /"externalCapture"\s+to\s+false\b/.test(runtime) && /"remoteMedia"\s+to\s+false\b/.test(runtime)
    && /val\s+gate\s*=\s*LocalFrameGate\(\)/.test(runtime)
    && /gate\.inspect\(frame,\s*null,/.test(service)
    && /releaseFrame\(candidate\)\s*\{\s*image\.close\(\)\s*\}/.test(service)
    && /detectorVerified:\s*Boolean\s*=\s*false/.test(gate)
    && /generation\s*==\s*null\s*->\s*"detector_or_target_unavailable"/.test(gate);
}

function privacyDenials(load) {
  const privacy = load(privacyPath);
  const frame = { frameId: 'offline-frame', frameHash: 'offline-hash', generation: 1, capturedAt: 100,
    pageKind: 'verified', detectorStatus: 'healthy', ocrStatus: 'complete', text: '修改字体大小',
    confidence: 1, thirdPartyFaces: 0, faceRedaction: 'not_required' };
  const context = { systemAuthorized: true, consent: true, sessionActive: true, destinationAuthorized: true,
    generation: 1, policyVersion: 'offline-v1', maxFrameAgeMs: 500, minimumConfidence: 0.9 };
  const cases = [
    [{}, { consent: false }], [{}, { systemAuthorized: false }], [{}, { destinationAuthorized: false }],
    [{}, { sessionActive: false }], [{ generation: 0 }, {}], [{ pageKind: 'unknown' }, {}],
    [{ detectorStatus: 'unavailable' }, {}], [{ ocrStatus: 'timeout' }, {}],
    [{ text: '支付密码' }, {}], [{ thirdPartyFaces: 1, faceRedaction: 'failed' }, {}],
  ];
  const sending = new privacy.SendingGate();
  const defaultDenied = sending.permits(0) === false;
  sending.authorize({ risk: 'safe', consent: true, detectorHealthy: true, generation: 1 });
  const authorized = sending.permits(1) === true;
  sending.stop();
  const record = value => Object.assign(Object.create(null), value);
  return defaultDenied && authorized && sending.permits(1) === false
    && privacy.evaluateLocalFrame(record(frame), record(context), 101).outboundAllowed === true
    && cases.every(([frameChange, contextChange]) => privacy.evaluateLocalFrame(record({ ...frame, ...frameChange }), record({ ...context, ...contextChange }), 101).outboundAllowed === false);
}

function currentNvProof(report, ids, json) {
  if (!report || !Array.isArray(report.checks) || ids.length === 0) return false;
  return ids.every(id => {
    const row = report.checks.find(check => check.id === id);
    return row?.readyForIndependentReview === true && row?.evidenceQualityPassed === true && row?.auditPassed === true
      && Array.isArray(row.signals) && row.signals.length > 0 && row.signals.every(signal => {
        const file = signal.sourcePath;
        if (typeof file !== 'string' || !/^docs\/implementation\/evidence\/[\w-]+\.json$/.test(file)) return false;
        const value = json(file);
        const descriptor = value?.scope ?? value?.source ?? '';
        if (typeof descriptor !== 'string' || !descriptor.trim() || /synthetic|mock|fixture|preparatory|static|jvm|compile/i.test(descriptor)) return false;
        const observed = typeof signal.path === 'string' ? signal.path.split('.').reduce((item, key) => item?.[key], value) : undefined;
        return signal.passed === true && observed !== undefined && observed === signal.expected;
      });
  });
}

export function renderExternalCapabilities(report) {
  const lines = [
    '# 一次性外部能力清单与发布就绪', '',
    `生成时间：${report.generatedAt}；审查类型：automated；输入指纹：\`${report.inputFingerprint}\`。`, '',
    '本文件由 `node scripts/check-release-readiness.mjs` 从根计划 V1.2、共享门禁、当前本地源码/配置及既有证据计算生成。重复执行更新同一份台账，不要求逐任务补材料。', '',
    '## 当前结论', '',
    `- 开发：\`${report.development.verdict}\`；可继续：\`${report.development.eligible}\`。`,
    `- 发布：\`${report.release.verdict}\`；正式 ready：\`${report.release.ready}\`。`,
    `- 外部待项：${report.external_pending.length} 项；关闭/本地检查：${report.checks.filter(item => item.passed).length}/${report.checks.length}。`,
    '- 不更新正式 D07、任务卡或其他门禁证据；开发 go 不代替正式 Go。',
    '- 本报告不验证本地服务启动；启动检查由主线程执行。', '',
    '## 外部缺项（一次性汇总）', '',
    '| 能力 | 验证状态 | 当前真实路径 | 缺项 | 关闭与降级证据 |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const item of report.capabilities) {
    lines.push(`| ${item.capability} | ${item.verification} | ${item.closure.verified ? '关闭证据已核对' : '关闭未证明，开发阻断'} | ${item.missing_conditions.join('；') || '当前证据已就绪，仍不代替正式发布'} | ${item.closure.evidence_refs.map(file => `\`${file}\``).join('、')}；${item.closure.strategy} |`);
  }
  lines.push('', '## 可自动重跑的验证入口', '',
    '以下入口只复核本地来源和新增证据，均不联网、不读取供应凭据、不启动真实设备或试点。没有真实证明仍返回 EXTERNAL_PENDING，不把 Mock、JVM、静态检查、打包或合成测试当正式验收。', '',
    '```powershell',
    'node scripts/check-release-readiness.mjs',
    'node scripts/check-release-readiness.mjs --mode development --no-write',
    'node scripts/check-release-readiness.mjs --mode release --no-write',
    report.validation.localTest,
    'node scripts/check-c15-nv-readiness.mjs --no-write',
    report.validation.developmentGate,
    report.validation.releaseGate,
    '```', '',
    '- 默认 development：写入此清单和 `docs/implementation/evidence/release-readiness.json`；只有本地检查通过才退出 0。',
    '- `--mode release`：只有发布 READY 才退出 0；缺外部条件退出 1，是预期门禁结果而非脚本崩溃。',
    '- `--no-write`：只输出 JSON，两个模式都不写文件；未知参数/模式退出 1。',
    '- 配置按 `apps/web/.env`、`.env.local`、对应模式配置及进程公开 VITE 键计算；根 `.env.example` 不当作已生效配置。端点仅分类，不输出值。',
    '- 真实执行器目前未为这些外部条件提供完整自动验收入口：JSON 中 `real_execution_entry=null`。真实条件到位后先补受控实测/同意证明及对应验证器，再运行上面的离线复核；不能凭手改 ready 标志放行。', '',
    '## 本地失败（若有）', '',
    ...report.checks.filter(item => !item.passed).map(item => `- \`${item.id}\`：${item.description}；${item.evidence_refs.map(file => `\`${file}\``).join('、')}。`),
    ...(report.checks.every(item => item.passed) ? ['- 当前报告范围内未发现本地检查失败。'] : []), '',
    '## 证据与边界', '',
    '- 完整来源路径与 SHA-256、D07 输入指纹、逐项关闭检查、公开配置分类保存在生成 JSON 中；它们是本地工程证据而非供应或参与者证明。',
    ...report.limitations.map(item => `- ${item}`), '',
  );
  return lines.join('\n');
}

export async function runReleaseReadinessCli(args, options = {}) {
  let mode = 'development';
  let write = true;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--no-write') write = false;
    else if (args[index] === '--mode' && ['development', 'release'].includes(args[index + 1])) mode = args[++index];
    else throw new Error('Invalid arguments');
  }
  const report = await createReleaseReadinessReport({ ...options, mode });
  const directory = options.rootDirectory ?? root;
  if (write) {
    writeFileSync(path.resolve(directory, reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    writeFileSync(path.resolve(directory, listPath), renderExternalCapabilities(report), 'utf8');
  }
  return { report, exitCode: exitCodeForGate({ mode, development: report.development, release: report.release }), written: write };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseReadinessCli(process.argv.slice(2)).then(({ report, exitCode }) => {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = exitCode;
  }).catch(() => {
    console.error('Release readiness check failed. Usage: node scripts/check-release-readiness.mjs [--mode development|release] [--no-write]');
    process.exitCode = 1;
  });
}

export async function createReleaseReadinessReport({ mode = 'development', rootDirectory = root,
  read = relativePath => localRead(relativePath, rootDirectory), environment = process.env,
  d07Check = () => runD07DecisionCheck({ mode: 'development', write: false }) } = {}) {
  assertGateMode(mode);
  const inventory = new Map();
  const cache = new Map();
  const checks = [];
  function source(file) {
    if (!cache.has(file)) {
      const text = read(file);
      cache.set(file, text);
      inventory.set(file, { path: file, exists: text !== null, sha256: text === null ? null : hash(text) });
    }
    return cache.get(file);
  }
  function json(file) {
    try { return JSON.parse(source(file)); } catch { return null; }
  }
  async function check(id, description, evidenceRefs, work) {
    let passed = false;
    try { passed = await work() === true; } catch { passed = false; }
    checks.push({ id, description, passed, kind: 'code', evidence_refs: evidenceRefs });
    return passed;
  }
  const load = offlineModules(source);
  const reports = Object.fromEntries(Object.entries(evidencePaths).map(([name, file]) => [name, json(file)]));
  for (const file of ['scripts/check-release-readiness.mjs', 'scripts/project-gate.mjs', 'scripts/check-d07-decision.mjs', 'scripts/implementation-plan.mjs']) source(file);
  let planSource = null;
  const planRefs = [];
  await check('PLAN_V12', '按正文发现 root/docs 的一致 V1.2 计划并检查开发/发布边界', planRefs, () => {
    planSource = readImplementationPlan(rootDirectory);
    planRefs.push(planSource.path);
    const text = source(planSource.path);
    return planSource.exists === true && typeof text === 'string' && hash(text) === planSource.contentSha256 && /版本\s*\|\s*V1\.2/.test(text)
      && text.includes('DEV_READY_WITH_EXTERNAL_PENDING') && text.includes('release.ready必须为false');
  });
  let d07 = null;
  await check('D07_CURRENT_INPUTS', '只读复用 D07 当前源码指纹、Schema 和共享门禁判定', ['scripts/project-gate.mjs', ...Object.values(evidencePaths).slice(0, 3)], () => {
    d07 = d07Check();
    return d07.development.eligible === true && d07.development.failedChecks.length === 0;
  });
  await check('REPORTS_PARSEABLE', '必要的本地证据均存在且可解析', Object.values(evidencePaths), () => Object.values(reports).every(value => value && typeof value === 'object'));
  const configurations = ['development', 'production'].map(profile => publicConfiguration(read, environment, profile));
  await check('CONFIGURATION_SAFETY', '实际开发配置可解析；未知模式和所有 Mock 被拒绝', [configPath, 'apps/web/src/local-snapshot.ts', 'apps/web/vite.config.ts'], () => {
    const { configuration } = load(configPath);
    const active = configurations[0];
    configuration(active.input, active.input.VITE_DEPLOYMENT === 'production');
    configuration(configurations[1].input, configurations[1].input.VITE_DEPLOYMENT === 'production');
    if (configurations.some(item => Object.values(item.summary).includes('INVALID'))) return false;
    const config = parsedSource('apps/web/vite.config.ts', source);
    if (nodes(config, node => ts.isPropertyAssignment(node) && ['envDir', 'envPrefix', 'root'].includes(node.name.getText(config))).length > 0) return false;
    if (active.summary.apiMode === 'real' && active.summary.apiEndpoint !== 'loopback') return false;
    let rejected = 0;
    for (const [input, production] of [[{ VITE_API_MODE: 'mock' }, true], [{ VITE_API_MODE: 'mock' }, false], [{ VITE_API_MODE: 'unknown' }, false], [{ VITE_API_MODE: 'real', VITE_MOCK_SCENARIO: 'offline' }, false]]) {
      try { configuration(input, production); } catch { rejected += 1; }
    }
    return rejected === 4;
  });
  const closure = {};
  closure.windows = await check('WINDOWS_CLOSED', '执行当前 Windows 能力策略及 IPC 返回，采集/远端媒体/原生浮层均关闭', [desktopPath, 'apps/desktop/main.cjs'], () => {
    const runtime = load(desktopPath);
    const policy = runtime.createWindowsCapabilityPolicy({ externalCapture: true, remoteMedia: true, nativeOverlay: true });
    const adapter = runtime.createNativeRuntimeAdapter();
    adapter.start();
    const stop = adapter.stop('permission-revoked');
    return ['externalCapture', 'remoteMedia', 'nativeOverlay'].every(key => policy[key] === false)
      && stop.captureActive === false && stop.mediaActive === false && desktopBridgeClosed(source, policy);
  });
  closure.android = await check('ANDROID_CLOSED', '静态核对 Android 本地隔离捕获、未验证检测器和帧关闭路径；不宣称真机执行', [androidRoot + 'NativeCaptureRuntime.kt', androidRoot + 'NativeCaptureService.kt', androidRoot + 'LocalFrameGate.kt'], () => androidCaptureClosed(source));
  closure.privacy = await check('PRIVACY_DENIALS', '执行无同意/无系统授权/未知风险/检测失败/停止后发送拒绝路径', [privacyPath], () => privacyDenials(load));
  closure.server = await check('SERVER_EXTERNAL_MODULES_UNMOUNTED', '常规同步、资产与远端媒体不默认装配，独立视觉只允许明确的按需工厂端口', ['apps/server/src/main.ts', 'apps/server/src/http.ts', 'apps/server/src/service-modules.ts'], () => {
    source('apps/server/src/service-modules.ts');
    return serverModulesUnmounted(source);
  });
  closure.standaloneGuidance = await check('STANDALONE_GUIDANCE_DEFAULT_CLOSED', '无真实配置时独立桌宠视觉端口拒绝请求，未鉴权或缺配置均不调用外部供应', [standaloneGuidancePath], async () => {
    const standalone = load(standaloneGuidancePath);
    let networkAttempts = 0;
    const service = standalone.createStandaloneGuidanceService({ fetch: async () => { networkAttempts += 1; throw new Error('Offline probe forbids network'); } });
    const codes = [];
    for (const actor of [null, { account_id: 'offline-standalone-owner' }]) {
      try { await service.analyze({}, actor); } catch (error) { codes.push(error.code); }
    }
    return codes.length === 2 && codes[0] === 'GUIDANCE_AUTH_REQUIRED' && codes[1] === 'GUIDANCE_UNAVAILABLE' && networkAttempts === 0;
  });
  const providerClosures = {};
  for (const provider of providers) {
    providerClosures[provider] = await check(`PROVIDER_${provider.toUpperCase()}_CLOSED`, '执行缺凭据与 network 适配器拒绝；仅合成准入材料，无供应调用', [providerPath], async () => {
      const { ProviderSandbox, ProviderOrchestrator } = load(providerPath);
      const request = { provider, scenario: 'success', requestId: `offline-${provider}`, generation: 1 };
      const missing = await new ProviderOrchestrator().run(request);
      let called = 0;
      const sandbox = new ProviderSandbox([{ provider, source: 'synthetic_fixture', reference: `offline-${provider}`,
        authorized: true, termsAccepted: true, expiresAt: '2099-01-01T00:00:00.000Z' }]);
      const orchestrator = new ProviderOrchestrator({ sandbox, adapters: [{ provider, mode: 'network', async execute() { called += 1; return { status: 'failed' }; } }] });
      const denied = await orchestrator.run(request);
      return missing.status === 'blocked' && missing.failureCode === 'PROVIDER_UNAVAILABLE'
        && denied.status === 'blocked' && denied.failureCode === 'NETWORK_DISABLED' && called === 0;
    });
  }
  const f = reports.f;
  await check('F_DEVELOPMENT_ONLY', '已有 F 开发证据不被升级为真实网络、数据、设备或正式执行', [evidencePaths.f], () => f?.success === true
    && f.formalComplete === false && f.fStarted === false && f.formalFExecutionStarted === false
    && ['realNetworkEnabled', 'productionDataEnabled', 'realDevicesEnabled'].every(key => f[key] === false));
  const definitions = [
    { id: 'android_device', title: 'Android 系统授权、捕获/浮层、通知与生命周期', nv: ['NV-01', 'NV-02', 'NV-04', 'NV-05'], closed: closure.android && closure.privacy,
      refs: [androidRoot + 'NativeCaptureRuntime.kt', androidRoot + 'NativeCaptureService.kt', privacyPath, 'apps/android/standalone-runtime.md'],
      missing: '目标设备/系统版本、本人系统授权、捕获与停止计数、通知/后台/浮层及生命周期真实回执', fallback: '普通包无捕获/浮层组件；独立包默认关闭，缺完整本地检测器时拒绝系统采集授权流程；无远端媒体' },
    { id: 'windows_device', title: 'Windows 捕获、多屏 DPI、浮层与通知', nv: ['NV-03', 'NV-04', 'NV-05'], closed: closure.windows && closure.privacy,
      refs: [desktopPath, 'apps/desktop/main.cjs', 'apps/desktop/standalone-host.cjs', privacyPath], missing: '目标 Windows 设备、混合 DPI/负坐标、多屏移动、真实权限/通知和停止回执', fallback: '管理桥仍关闭高风险媒体；独立桌宠捕获另需本人选源和同意、逐帧安全门控，默认关闭；代码及自身UI测试不等于外部软件验收' },
    { id: 'local_detector_top20', title: '真实检测/脱敏模型与目标应用 Top20', nv: ['NV-06', 'NV-08', 'NV-09'], closed: closure.android && closure.privacy,
      refs: [androidRoot + 'LocalFrameGate.kt', privacyPath, evidencePaths.c16], missing: '真实模型、目标应用版本、20 项设备适配和儿童指向实测；开发候选不是已适配证明', fallback: '检测未知、页面未知或敏感时拒绝发送，不做输入注入' },
    { id: 'generated_assets', title: '真实生成 2D/3D 资产及许可', nv: ['NV-10'], closed: closure.server && providerClosures.pet_generation,
      refs: [providerPath, 'apps/server/src/main.ts'], missing: '真实生成资产、授权许可、完整动作/格式/骨骼兼容和目标设备质量验证', fallback: '保留画布、草稿和既有 2D；无真实生成模块自动挂载' },
    ...providers.map(provider => ({ id: provider, title: `真实供应：${provider}`, nv: [provider === 'carrier_auth' || provider === 'face_auth' ? 'NV-12' : 'NV-11'],
      closed: providerClosures[provider] && closure.server && (provider !== 'multimodal' || closure.standaloneGuidance), refs: [providerPath, 'apps/server/src/main.ts', ...(provider === 'multimodal' ? [standaloneGuidancePath] : [])],
      missing: provider === 'carrier_auth' || provider === 'face_auth'
        ? '受管供应凭据引用、供应条款、本人同意、服务端证明/防重放及无 SIM/拒绝/撤销实测'
        : '受管供应凭据引用、授权端点/配额、用途与留存条款、真实质量/成本/取消和故障回执',
      fallback: provider === 'tts' ? '保留字幕，不调用网络供应' : provider === 'pet_generation' ? '保留草稿与既有 2D，不调用网络供应'
        : provider === 'multimodal' ? '通用供应沙盒拒绝网络；独立视觉端口无配置503，需真实服务鉴权、本人用途同意和合规脱敏帧才按需请求，不回退Mock' : '使用明确标注的本地适配/文字或亲情兜底，不调用网络供应' })),
    { id: 'media_relay', title: '真实编码、信令与 TURN 中继', nv: ['NV-07'], closed: closure.android && closure.windows && closure.privacy && closure.server,
      refs: [privacyPath, androidRoot + 'NativeCaptureRuntime.kt', desktopPath, 'apps/server/src/main.ts'], missing: '授权信令/TURN、实际编码/中继、动态同意/撤权、断连和清理计数', fallback: '默认服务不挂载媒体模块；外部采集和远端媒体关闭；不输出 TURN 凭据' },
    { id: 'consent_pilot', title: '真实参与者/监护同意与 F09/F10 试点', nv: [], closed: closure.privacy && closure.android && closure.windows,
      refs: [privacyPath, evidencePaths.c16, evidencePaths.f], missing: '有效真实参与者/监护同意、撤回/到期记录、真实试点及效果记录；无可接受的真人证明验证器', fallback: '仅合成账户和本地验证；真实采集/分享须独立系统授权和有效同意' },
    { id: 'production_handover', title: '正式部署、签名、恢复/回滚与对外交付', nv: [], closed: closure.server && closure.windows && closure.android,
      refs: ['apps/server/src/main.ts', evidencePaths.f], missing: '目标环境、生产运维/保留策略、签名与安装升级、备份恢复/回滚、真实对外交付证据；本地演练不是签收', fallback: '保持本地服务/开发模式，不开启真实供应、生产数据或正式 F 执行' },
  ];
  const capabilities = definitions.map(item => {
    const verified = currentNvProof(reports.c15, item.nv, json);
    return {
      id: item.id, capability: item.title, verification: verified ? 'VERIFIED' : 'EXTERNAL_PENDING',
      production_enabled: item.closed ? false : null,
      closure: { verified: item.closed === true, evidence_refs: item.refs, strategy: item.fallback },
      evidence_refs: [evidencePaths.c15, ...item.refs], nv_checks: item.nv,
      missing_conditions: verified ? [] : [item.missing],
      future_validation: {
        offline_recheck: 'node scripts/check-release-readiness.mjs --mode release --no-write',
        evidence_audit: 'node scripts/check-c15-nv-readiness.mjs --no-write',
        real_execution_entry: null,
        note: '现有入口只重算本地证据，不取得设备/供应/同意，也不执行真实试点；真实条件到位后须补对应实测证据和验证器。',
      },
    };
  });
  const production = configurations[1].summary;
  const productionConfigurationReady = production.deployment === 'production' && production.apiMode === 'real'
    && !['unset', 'invalid'].includes(production.apiEndpoint);
  const externalPending = capabilities.filter(item => item.verification === 'EXTERNAL_PENDING').map(item => ({
    id: item.id, capability: item.capability, reason: item.missing_conditions[0],
    production_enabled: item.production_enabled === true, evidence_refs: item.evidence_refs,
  }));
  const releaseBlockers = [
    ...(d07?.release?.ready === true ? [] : [{ id: 'D07_RELEASE_EVIDENCE', reason: 'D07 的开发 go 不等于正式发布；当前只读发布判定未就绪。' }]),
    ...(productionConfigurationReady ? [] : [{ id: 'PRODUCTION_CONFIGURATION', reason: '尚未提供可验证的生产 real 配置；Mock 不能作为正式证明。' }]),
  ];
  const gate = evaluateProjectGate({ mode, checks, externalPending,
    release: { assessed: true, ready: d07?.release?.ready === true && productionConfigurationReady && externalPending.length === 0, blockers: releaseBlockers } });
  const sourceInventory = [...inventory.values()].sort((left, right) => left.path.localeCompare(right.path));
  const configuration = configurations.map(item => item.summary);
  return {
    schemaVersion: 'release-readiness/v1', generatedBy: 'nuanban/scripts/check-release-readiness.mjs',
    generatedAt: new Date().toISOString(), generatedTimeZone: 'Asia/Shanghai', review_type: 'automated', mode,
    scope: 'offline-local-readiness-not-production-acceptance', success: gate.active.eligible,
    implementationPlan: { path: planSource?.path ?? null, sha256: planSource?.contentSha256 ?? null, exists: planSource?.exists ?? false },
    development: gate.development, release: gate.release, checks, configuration, capabilities,
    external_pending: externalPending,
    sourceInventory,
    inputFingerprint: hash(JSON.stringify({ sourceInventory, configuration, d07: d07?.inputFingerprint ?? null })),
    d07: { inputFingerprint: d07?.inputFingerprint ?? null, developmentEligible: d07?.development?.eligible ?? false,
      releaseReady: d07?.release?.ready ?? false, inputs: d07?.inputInventory ?? [], stateUpdated: false },
    fEvidence: { recordedDevelopmentSuccess: f?.success === true, taskCount: Array.isArray(f?.tasks) ? f.tasks.length : 0,
      formalComplete: f?.formalComplete ?? null, fStarted: f?.fStarted ?? null, evidence_ref: evidencePaths.f },
    boundaries: { networkAttempted: false, secretValuesCollected: false, credentialFilesInspected: false,
      mockCountsAsFormalEvidence: false, realDeviceExecuted: false, liveProviderExecuted: false, externalConditionsCreated: false },
    validation: {
      localTest: 'node node_modules/vitest/vitest.mjs run tests/acceptance/release-readiness.test.ts',
      developmentGate: 'node scripts/check-d07-decision.mjs --mode development --no-write',
      releaseGate: 'node scripts/check-d07-decision.mjs --mode release --no-write',
      recheck: 'node scripts/check-release-readiness.mjs --mode release --no-write',
    },
    limitations: [
      '检查范围仅为当前本地来源、公开配置、隔离的拒绝路径探针和既有证据；不代表全项目构建/启动或真实验收。',
      '只读取允许的 VITE 配置键；不读取 token/key/secret 环境变量，不输出原始端点、凭据、供应载荷或未经脱敏的错误。',
      'Android 关闭证据为源码静态核对，不是真机结果；本地隔离捕获可能须本人系统授权，系统通知也不是全局关闭。',
      '供应探针使用明确合成的准入材料验证 NETWORK_DISABLED，仅属本地拒绝测试，不是真实凭据或供应证明。',
      '未知/缺失外部条件标 EXTERNAL_PENDING；关闭证据缺失或本地门禁失败则 DEV_BLOCKED，不以 external_pending 掩盖代码错误。',
    ],
  };
}
