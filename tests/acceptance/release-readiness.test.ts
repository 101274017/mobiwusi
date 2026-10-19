import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readImplementationPlan } from '../../scripts/implementation-plan.mjs';

const moduleUrl = new URL('../../scripts/check-release-readiness.mjs', import.meta.url).href;
const { createReleaseReadinessReport, renderExternalCapabilities, runReleaseReadinessCli } = await import(moduleUrl);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const temporaryPrefix = join(tmpdir(), 'nuanban-release-readiness-');
const planName = '任意文件名-项目实施计划(1).md';
const reportPath = 'docs/implementation/evidence/release-readiness.json';
const listPath = 'docs/implementation/external-capabilities.md';
const providerPath = 'packages/provider-sandbox/src/index.ts';
const privacyPath = 'packages/privacy/src/index.ts';
const desktopPath = 'apps/desktop/native-runtime.cjs';
const inputFiles = [
  'scripts/check-release-readiness.mjs', 'scripts/project-gate.mjs', 'scripts/check-d07-decision.mjs',
  'scripts/implementation-plan.mjs', 'packages/config/src/index.ts', 'apps/web/src/local-snapshot.ts',
  'apps/web/vite.config.ts', desktopPath, 'apps/desktop/main.cjs', privacyPath, providerPath,
  'apps/server/src/main.ts', 'apps/server/src/http.ts', 'apps/server/src/service-modules.ts', 'apps/server/src/standalone-guidance.ts',
  ...['NativeCaptureRuntime', 'NativeCaptureService', 'LocalFrameGate'].map(name => `apps/android/app/src/standalone/java/org/nuanban/assistant/nativehost/${name}.kt`),
];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
type Check = { id: string; passed: boolean };
type Capability = { verification: string; production_enabled: boolean | null; closure: { verified: boolean; evidence_refs: string[] } };

describe('一次性外部能力清单与发布就绪（全部变更仅在临时目录）', () => {
  let directory: string;
  function put(file: string, text: string) {
    const target = resolve(directory, file);
    if (!target.startsWith(`${resolve(directory)}${sep}`)) throw new Error('Fixture escaped temporary directory');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, 'utf8');
  }
  function json(file: string, value: unknown) { put(file, JSON.stringify(value)); }
  function text(file: string) { return readFileSync(join(directory, file), 'utf8'); }
  function gate() {
    return {
      inputFingerprint: 'a'.repeat(64), inputInventory: [],
      development: { eligible: true, verdict: 'DEV_READY_WITH_EXTERNAL_PENDING', failedChecks: [] },
      release: { ready: false, verdict: 'EXTERNAL_PENDING' },
    };
  }
  function options(environment: Record<string, string | undefined> = {}) {
    return { rootDirectory: directory, environment, d07Check: gate };
  }
  function failed(report: { checks: Check[] }) { return report.checks.filter(check => !check.passed).map(check => check.id); }

  beforeEach(() => {
    directory = mkdtempSync(temporaryPrefix);
    for (const file of inputFiles) put(file, readFileSync(join(root, file), 'utf8'));
    put(planName, readImplementationPlan(root).text);
    json('docs/implementation/evidence/c15-nv-readiness-results.json', { scope: 'synthetic unit fixture only', checks: [] });
    json('docs/implementation/evidence/c16-decision-readiness-results.json', { scope: 'synthetic unit fixture only', pilotEligible: false });
    json('docs/implementation/evidence/d07-decision.json', { scope: 'synthetic unit fixture only', decisionMode: 'development', decision: 'go' });
    json('docs/implementation/evidence/f-execution-results.json', {
      scope: 'synthetic unit fixture only', success: true, formalComplete: false, fStarted: false,
      formalFExecutionStarted: false, realNetworkEnabled: false, productionDataEnabled: false, realDevicesEnabled: false,
      tasks: Array.from({ length: 24 }, (_, index) => ({ id: `F${index + 1}` })),
    });
  });
  afterEach(() => {
    if (directory && resolve(directory).startsWith(resolve(temporaryPrefix))) rmSync(directory, { recursive: true, force: true });
  });

  it('缺设备/供应/同意仍可开发，但正式发布必须 EXTERNAL_PENDING', async () => {
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toEqual([]);
    expect(report.development).toMatchObject({ eligible: true, verdict: 'DEV_READY_WITH_EXTERNAL_PENDING' });
    expect(report.release).toMatchObject({ ready: false, verdict: 'EXTERNAL_PENDING' });
    expect(report.external_pending).toHaveLength(13);
    expect(report.capabilities.every((item: Capability) => item.verification === 'EXTERNAL_PENDING' && item.production_enabled === false && item.closure.verified)).toBe(true);
    expect(report.d07.stateUpdated).toBe(false);
    expect(report.boundaries).toMatchObject({ networkAttempted: false, mockCountsAsFormalEvidence: false, realDeviceExecuted: false, liveProviderExecuted: false });
  });

  it('按正文识别任意文件名 V1.2 并记录实际来源路径与 hash', async () => {
    const report = await createReleaseReadinessReport(options());
    expect(report.implementationPlan).toMatchObject({ path: planName, exists: true, sha256: digest(text(planName)) });
    expect(report.sourceInventory).toContainEqual({ path: planName, exists: true, sha256: digest(text(planName)) });
  });

  it('只在临时目录移除计划，缺计划应开发阻断而非伪通过', async () => {
    rmSync(join(directory, planName));
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('PLAN_V12');
    expect(report.development.verdict).toBe('DEV_BLOCKED');
    expect(report.release.ready).toBe(false);
  });

  it('root/docs 同版内容冲突不能静默选择一个计划', async () => {
    put('docs/另一个实施计划.md', text(planName) + '\n冲突的合成测试内容\n');
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('PLAN_V12');
    expect(report.development.eligible).toBe(false);
  });

  it('相同的 docs 副本可以发现，根目录无固定文件名也不阻断', async () => {
    put('docs/实施计划副本.md', text(planName));
    rmSync(join(directory, planName));
    const report = await createReleaseReadinessReport(options());
    expect(report.implementationPlan.path).toBe('docs/实施计划副本.md');
    expect(failed(report)).toEqual([]);
  });

  it('误启 Windows 采集会让关闭检查失败，而非归到普通外部待项', async () => {
    put(desktopPath, text(desktopPath).replace('externalCapture: false', 'externalCapture: true'));
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('WINDOWS_CLOSED');
    expect(report.development.verdict).toBe('DEV_BLOCKED');
    expect(report.release).toMatchObject({ verdict: 'BLOCKED', ready: false });
  });

  it('实际隐私拒绝路径被移除时不能沿用旧 ready 标志', async () => {
    put(privacyPath, text(privacyPath).replace("if (!context.consent) return baseResult(input, context, 'missing_consent', 'unknown', 'deny', evaluatedAt);", ''));
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('PRIVACY_DENIALS');
    expect(report.development.eligible).toBe(false);
  });

  it('network 适配器拒绝失效会失败，测试替身从不调用网络', async () => {
    put(providerPath, text(providerPath).replace("adapter.mode !== undefined && adapter.mode !== 'synthetic'", 'false'));
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('PROVIDER_MULTIMODAL_CLOSED');
    expect(report.development.verdict).toBe('DEV_BLOCKED');
  });

  it('D07 当前本地失败不能冒充外部资源缺失', async () => {
    const report = await createReleaseReadinessReport({ ...options(), d07Check: () => ({ ...gate(), development: { eligible: false, failedChecks: [{ id: 'stale' }] } }) });
    expect(failed(report)).toContain('D07_CURRENT_INPUTS');
    expect(report.development.eligible).toBe(false);
  });

  it('独立桌宠端口必须真实默认拒绝，不能用直接放行替代配置检查', async () => {
    const file = 'apps/server/src/standalone-guidance.ts';
    put(file, text(file).replace('const provider = configuration(env);', "const provider = { endpoint: 'https://synthetic.invalid', key: 'synthetic', model: 'synthetic' };"));
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('STANDALONE_GUIDANCE_DEFAULT_CLOSED');
    expect(report.development.eligible).toBe(false);
  });

  it('允许已审计的独立视觉工厂不等于允许默认装配远端媒体模块', async () => {
    const file = 'apps/server/src/main.ts';
    put(file, text(file).replace('standaloneGuidance: createStandaloneGuidanceService()', 'standaloneGuidance: createStandaloneGuidanceService(), modules: {}'));
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('SERVER_EXTERNAL_MODULES_UNMOUNTED');
  });

  it.each(['{ broken', 'null'])('损坏/缺失证据不能通过：%s', async contents => {
    put('docs/implementation/evidence/c15-nv-readiness-results.json', contents);
    const report = await createReleaseReadinessReport(options());
    expect(failed(report)).toContain('REPORTS_PARSEABLE');
    expect(report.release.ready).toBe(false);
  });

  it('生产配置和开发 go 不能把 Mock 供应证明升级为正式验收', async () => {
    put('apps/web/.env.production', 'VITE_API_MODE=real\nVITE_DEPLOYMENT=production\nVITE_API_BASE_URL=https://provider.invalid\n');
    const checks = Array.from({ length: 12 }, (_, index) => ({
      id: `NV-${String(index + 1).padStart(2, '0')}`, auditPassed: true, evidenceQualityPassed: true, readyForIndependentReview: true,
      signals: [{ sourcePath: 'docs/implementation/evidence/synthetic-proof.json', path: 'deviceVerified', expected: true, passed: true }],
    }));
    json('docs/implementation/evidence/c15-nv-readiness-results.json', { checks, deviceVerified: true, supplierVerified: true });
    json('docs/implementation/evidence/synthetic-proof.json', { scope: 'mock-synthetic-fixture', deviceVerified: true });
    const report = await createReleaseReadinessReport({ ...options(), mode: 'release', d07Check: () => ({ ...gate(), release: { ready: true, verdict: 'READY' } }) });
    expect(failed(report)).toEqual([]);
    expect(report.success).toBe(false);
    expect(report.release).toMatchObject({ verdict: 'EXTERNAL_PENDING', ready: false });
    expect(report.external_pending).toHaveLength(13);
  });

  it('不读取 secret 环境键、不输出端点/凭据/未知模式原值', async () => {
    const sentinel = 'UNIT_TEST_SECRET_DO_NOT_DISCLOSE_719';
    const environment = { VITE_API_MODE: sentinel, VITE_API_BASE_URL: `https://provider.invalid/path?token=${sentinel}` };
    Object.defineProperty(environment, 'VITE_API_TOKEN', { get() { throw new Error('Secret environment key accessed'); }, enumerable: true });
    Object.defineProperty(environment, 'PROVIDER_SECRET', { get() { throw new Error('Secret environment key accessed'); }, enumerable: true });
    put('apps/web/.env.local', `PROVIDER_SECRET=${sentinel}\nVITE_API_TOKEN=${sentinel}\n`);
    const report = await createReleaseReadinessReport(options(environment));
    const serialized = JSON.stringify(report) + renderExternalCapabilities(report);
    expect(serialized).not.toContain(sentinel);
    expect(serialized).not.toContain('provider.invalid/path');
    expect(failed(report)).toContain('CONFIGURATION_SAFETY');
  });

  it('公开配置按实际优先级计算而不是读取 .env.example 当正式配置', async () => {
    put('.env.example', 'VITE_API_MODE=real\nVITE_DEPLOYMENT=production\n');
    put('apps/web/.env', 'VITE_API_MODE=real\nVITE_API_BASE_URL=http://127.0.0.1:3000\n');
    put('apps/web/.env.local', 'VITE_API_MODE=local\n');
    const report = await createReleaseReadinessReport(options());
    expect(report.configuration[0]).toMatchObject({ apiMode: 'local', deployment: 'development', apiEndpoint: 'loopback' });
    expect(report.configuration[0].origins.VITE_API_MODE).toBe('apps/web/.env.local');
    expect(report.release.ready).toBe(false);
  });

  it.each([
    { VITE_API_MODE: 'real', VITE_API_BASE_URL: 'https://unverified.invalid' },
    { VITE_API_MODE: 'mock', VITE_DEPLOYMENT: 'production' },
    { VITE_API_MODE: 'mock', VITE_DEPLOYMENT: 'development' },
    { VITE_PLATFORM_MODE: 'unknown' },
  ])('未知/危险配置按本地代码失败处理：%j', async environment => {
    const report = await createReleaseReadinessReport(options(environment));
    expect(failed(report)).toContain('CONFIGURATION_SAFETY');
    expect(report.development.verdict).toBe('DEV_BLOCKED');
  });

  it('同样输入有相同指纹，真实本地源变更必须改变指纹', async () => {
    const first = await createReleaseReadinessReport(options());
    const second = await createReleaseReadinessReport(options());
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    put(desktopPath, text(desktopPath) + '\n');
    const changed = await createReleaseReadinessReport(options());
    expect(changed.inputFingerprint).not.toBe(first.inputFingerprint);
    expect(failed(changed)).toEqual([]);
  });

  it('CLI 默认仅写清单/报告，release --no-write 退出 1 且不修改任何输入', async () => {
    const originalInputs = [...inputFiles, planName, 'docs/implementation/evidence/d07-decision.json'].map(file => [file, digest(text(file))]);
    const initial = await runReleaseReadinessCli([], options());
    expect(initial.exitCode).toBe(0);
    expect(initial.written).toBe(true);
    expect(JSON.parse(text(reportPath))).toMatchObject({ mode: 'development', release: { ready: false }, implementationPlan: { path: planName } });
    expect(text(listPath)).toContain('EXTERNAL_PENDING');
    const previousReport = text(reportPath);
    const previousList = text(listPath);
    const result = await runReleaseReadinessCli(['--mode', 'release', '--no-write'], options());
    expect(result.exitCode).toBe(1);
    expect(result.report.release.verdict).toBe('EXTERNAL_PENDING');
    expect(result.written).toBe(false);
    expect(text(reportPath)).toBe(previousReport);
    expect(text(listPath)).toBe(previousList);
    for (const [file, sha256] of originalInputs) expect(digest(text(file))).toBe(sha256);
  });

  it.each([['--mode'], ['--mode', 'unknown'], ['--evidence', 'elsewhere.json'], ['--unknown']])('CLI 拒绝未知/缺参数 %j 而不写证据', async (...args: string[]) => {
    await expect(runReleaseReadinessCli(args, options())).rejects.toThrow('Invalid arguments');
    expect(existsSync(join(directory, reportPath))).toBe(false);
    expect(existsSync(join(directory, listPath))).toBe(false);
  });
});
