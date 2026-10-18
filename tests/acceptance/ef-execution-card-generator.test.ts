import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { readImplementationPlan } from '../../scripts/implementation-plan.mjs';

const workspace = process.cwd();
const script = path.join(workspace, 'scripts/generate-ef-execution-cards.mjs');
const { generateEFExecutionCards, developmentDependencySatisfied } = await import(pathToFileURL(script).href);
const planFile = 'fixture-implementation-plan.md';
const gateFile = 'docs/implementation/evidence/d-gate-readiness-results.json';
const resultFile = 'docs/implementation/evidence/f-execution-results.json';
const decisionFile = 'docs/implementation/evidence/d07-decision.json';
const currentPlan = readImplementationPlan(workspace);
if (!currentPlan.exists) throw new Error('Required test input missing: V1.2 implementation plan');
const plan = currentPlan.text;
const temporaryDirectories: string[] = [];

type DevelopmentState = {
  id: string;
  status: string;
  automated: string;
  developmentExecutionStarted: boolean;
  prerequisites: Array<{ id: string; relation: string; satisfied: boolean }>;
};

type Report = {
  mode: string;
  sourcePlan: string;
  eTasks: number;
  fTasks: number;
  targets: number;
  filesWritten: number;
  existingTargets: number;
  backupDirectory: string | null;
  development: DevelopmentState[];
};

function write(root: string, file: string, contents: string) {
  if (!temporaryDirectories.includes(root)) throw new Error('Tests only write inside registered temporary fixtures');
  const target = path.join(root, file);
  if (path.relative(root, target).startsWith('..') || path.isAbsolute(path.relative(root, target))) throw new Error('Unsafe fixture write');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}

function read(root: string, file: string) {
  return readFileSync(path.join(root, file), 'utf8');
}

function fixture() {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), 'nuanban-ef-generator-'));
  temporaryDirectories.push(root);
  const gate = {
    generatedAt: '2026-10-17T14:30:00Z',
    status: 'blocked',
    acceptance: 'preparatory_not_accepted',
    goNoGoEligible: false,
    eAfterDEligible: false,
    eStarted: false,
    fStarted: false,
    development: { verdict: 'DEV_READY_WITH_EXTERNAL_PENDING', eligible: true, failedChecks: [] as string[] },
  };
  const result = {
    mode: 'development_only',
    success: true,
    formalComplete: false,
    realNetworkEnabled: false,
    productionDataEnabled: false,
    realDevicesEnabled: false,
    fStarted: false,
    formalFExecutionStarted: false,
    tasks: Array.from({ length: 24 }, (_, index) => {
      const id = 'F' + String(index + 1).padStart(2, '0');
      return { id, developmentStatus: 'checks_passed', evidence: { id, assertions: ['synthetic fixture only'] } };
    }),
  };
  write(root, planFile, plan);
  write(root, gateFile, JSON.stringify(gate));
  write(root, resultFile, JSON.stringify(result));
  write(root, decisionFile, '{"owner":"fixture","decisionMode":"release","decision":"no_go"}');
  write(root, 'apps/server/src/auth.ts', 'export const fixture = true;');
  write(root, 'tests/server/auth.test.ts', 'export const fixture = true;');
  return { root, gate, result };
}

function generate(root: string, options: { refresh?: boolean; checkOnly?: boolean } = {}): Report {
  if (!temporaryDirectories.includes(root)) throw new Error('Generator tests require a temporary root');
  return generateEFExecutionCards({ root, ...options });
}

function snapshot(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return snapshot(root, absolute);
    return [path.relative(root, absolute) + ':' + createHash('sha256').update(readFileSync(absolute)).digest('hex')];
  }).sort();
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = realpathSync(directory);
    if (path.dirname(resolved) !== realpathSync(tmpdir()) || !path.basename(resolved).startsWith('nuanban-ef-generator-')) {
      throw new Error('Unsafe generator fixture cleanup path');
    }
    rmSync(resolved, { recursive: true, force: true });
  }
});

describe('E/F V1.2 双状态任务卡生成器', () => {
  it('从当前根计划生成 50 张卡和索引，引用既有开发证据但不改变正式状态', () => {
    const { root } = fixture();
    const gateBefore = read(root, gateFile);
    const decisionBefore = read(root, decisionFile);
    const resultBefore = read(root, resultFile);
    const report = generate(root);
    expect(report).toMatchObject({ mode: 'generated', eTasks: 26, fTasks: 24, targets: 101, filesWritten: 101 });
    expect(report.development.find(task => task.id === 'E01')).toMatchObject({ status: 'implemented', automated: 'not_run', developmentExecutionStarted: true });
    expect(report.development.filter(task => task.id.startsWith('F')).every(task => task.status === 'verified')).toBe(true);
    const card = read(root, 'docs/execution/tasks/E01.md');
    const row = plan.split(/\r?\n/).find(line => line.startsWith('| E01 '))!;
    const hash = createHash('sha256').update(row).digest('hex');
    expect(card).toContain('> ' + row);
    expect(card).toContain('baseline_ref: "' + planFile + '#L' + (plan.split(/\r?\n/).indexOf(row) + 1) + '"');
    expect(card).toContain('baseline_row_hash: "sha256:' + hash + '"');
    for (const id of ['E01', 'F01', 'F24']) {
      const source = read(root, 'docs/execution/tasks/' + id + '.md');
      expect(source).toContain('\nstatus: "blocked"\n');
      expect(source).toContain('\nacceptance: "preparatory_not_accepted"\n');
      expect(source).toContain('\nexecution_started: false\n');
      expect(source).toContain('external_dependencies:');
      expect(source).toContain('native: "external_pending"');
      expect(source).not.toContain('不得开始产品实现');
      expect(source).not.toContain('等待 D07 正式批准');
    }
    expect(read(root, 'docs/execution/tasks/F01.md')).toContain('development_status: "verified"');
    expect(read(root, 'docs/execution/tasks/F01.md')).toContain('automated: "checks_passed"');
    const index = read(root, 'docs/execution/tasks/EF-index.md');
    expect(index).toContain('开发状态 | 自动验证 | 外部验证 | 正式状态');
    expect(index).toContain('未在生成时重跑');
    expect(read(root, gateFile)).toBe(gateBefore);
    expect(read(root, decisionFile)).toBe(decisionBefore);
    expect(read(root, resultFile)).toBe(resultBefore);
    expect(read(root, planFile)).toBe(plan);
  });

  it('缺少 F 证据、空证据或只有代码入口时不冒充测试通过', () => {
    const { root, result } = fixture();
    result.tasks[0].evidence = {} as typeof result.tasks[0]['evidence'];
    result.tasks[1].developmentStatus = 'not_run';
    result.tasks.splice(2, 1);
    write(root, resultFile, JSON.stringify(result));
    unlinkSync(path.join(root, 'tests/server/auth.test.ts'));
    const report = generate(root);
    for (const id of ['E01', 'F01', 'F02', 'F03']) {
      expect(report.development.find(task => task.id === id)).toMatchObject({ status: 'ready_for_local_checks', automated: 'not_run' });
    }
    expect(report.development.find(task => task.id === 'E01')?.developmentExecutionStarted).toBe(true);
    expect(report.development.find(task => task.id === 'F04')?.status).toBe('verified');
  });

  it('没有 F 报告时仍可生成本地待检查卡，不要求 override 或人工决定', () => {
    const { root } = fixture();
    unlinkSync(path.join(root, resultFile));
    unlinkSync(path.join(root, decisionFile));
    const report = generate(root);
    expect(report.development.filter(task => task.id.startsWith('F')).every(task => task.status === 'ready_for_local_checks')).toBe(true);
  });

  it('明确本地失败标 blocked_by_code，不改成 external_pending', () => {
    const { root, result, gate } = fixture();
    result.tasks[0].developmentStatus = 'checks_failed';
    gate.development = { verdict: 'DEV_BLOCKED', eligible: false, failedChecks: ['contract mismatch'] };
    write(root, resultFile, JSON.stringify(result));
    write(root, gateFile, JSON.stringify(gate));
    const report = generate(root);
    expect(report.development.find(task => task.id === 'F01')).toMatchObject({ status: 'blocked_by_code', automated: 'failed' });
    expect(report.development.find(task => task.id === 'E02')?.status).toBe('blocked_by_code');
    expect(read(root, 'docs/execution/tasks/E01.md')).toContain('development_gate_eligible: false');
  });

  it('真实网络标志、任务证据 ID 不符均不提升为 verified', () => {
    const { root, result } = fixture();
    result.tasks[0].evidence.id = 'F24';
    write(root, resultFile, JSON.stringify(result));
    expect(generate(root, { checkOnly: true }).development.find(task => task.id === 'F01')?.status).toBe('ready_for_local_checks');
    result.realNetworkEnabled = true;
    write(root, resultFile, JSON.stringify(result));
    expect(generate(root, { checkOnly: true }).development.every(task => task.status !== 'verified')).toBe(true);
  });

  it('正确展开范围和 SS/FF，保留开发依赖快照', () => {
    const { root } = fixture();
    const report = generate(root, { checkOnly: true });
    const e22 = report.development.find(task => task.id === 'E22')!;
    expect(e22.prerequisites).toHaveLength(20);
    expect(e22.prerequisites[0]).toMatchObject({ id: 'E01', relation: 'SS/FF', satisfied: true });
    expect(e22.prerequisites[1].satisfied).toBe(false);
    const f24 = report.development.find(task => task.id === 'F24')!;
    expect(f24.prerequisites.map(item => item.id)).toEqual(['F09', 'F19', 'F20', 'F21', 'F22', 'F23']);
    expect(f24.prerequisites.every(item => item.satisfied)).toBe(true);
  });

  it.each(['implemented', 'verified', 'checks_passed'])('本地依赖接受 %s，但正式已开始不能满足 SS', status => {
    for (const relation of ['FS', 'SS', 'FF', 'SS/FF']) {
      expect(developmentDependencySatisfied({ development_status: status }, relation)).toBe(true);
    }
    expect(developmentDependencySatisfied({ development_status: 'in_progress', development_execution_started: true }, 'SS')).toBe(true);
    expect(developmentDependencySatisfied({ development_status: 'in_progress', development_execution_started: true }, 'FS')).toBe(false);
    expect(developmentDependencySatisfied({ development_status: 'in_progress', development_execution_started: true }, 'SS/FF')).toBe(false);
    expect(developmentDependencySatisfied({ status: 'blocked', execution_started: true }, 'SS')).toBe(false);
    expect(developmentDependencySatisfied({ development_status: status }, 'unknown')).toBe(false);
  });

  it('默认拒绝覆盖，--check-only 和 --refresh --check-only 均不写入', () => {
    const { root } = fixture();
    generate(root);
    const before = snapshot(root);
    expect(() => generate(root)).toThrow('Refusing to overwrite');
    expect(generate(root, { checkOnly: true })).toMatchObject({ mode: 'check-only', existingTargets: 101, filesWritten: 0 });
    expect(generate(root, { checkOnly: true, refresh: true })).toMatchObject({ filesWritten: 0, backupDirectory: null });
    expect(snapshot(root)).toEqual(before);
  });

  it('--refresh 重新读取计划并完整备份旧生成物，不覆盖追加执行记录', () => {
    const { root } = fixture();
    generate(root);
    const cardBefore = read(root, 'docs/execution/tasks/E01.md');
    const gateBefore = read(root, gateFile);
    const decisionBefore = read(root, decisionFile);
    const customFile = 'docs/execution/checks/E01-local-run.md';
    write(root, customFile, 'user-owned local execution record');
    const revised = plan.replace('| E01 身份、设备与辅助开通 |', '| E01 更新的开发工作包 |');
    write(root, planFile, revised);
    const report = generate(root, { refresh: true });
    expect(report).toMatchObject({ mode: 'refreshed', filesWritten: 101, existingTargets: 101 });
    expect(report.backupDirectory).not.toBeNull();
    expect(read(root, report.backupDirectory + '/docs/execution/tasks/E01.md')).toBe(cardBefore);
    expect(read(root, 'docs/execution/tasks/E01.md')).toContain('# E01 更新的开发工作包 任务卡');
    expect(read(root, 'docs/execution/tasks/EF-index.md')).toContain('更新的开发工作包');
    expect(read(root, customFile)).toBe('user-owned local execution record');
    expect(read(root, gateFile)).toBe(gateBefore);
    expect(read(root, decisionFile)).toBe(decisionBefore);
    expect(snapshot(root).filter(file => file.includes('.ef-') && file.includes('.tmp'))).toEqual([]);
  });

  it('安全迁移仓库旧生成卡、预备检查和索引，保留历史原字节', () => {
    const { root } = fixture();
    const legacyFiles = ['docs/execution/tasks/E01.md', 'docs/execution/tasks/F24.md', 'docs/execution/checks/E01-prep.md', 'docs/execution/checks/F24-prep.md', 'docs/execution/tasks/EF-index.md'];
    const legacy = new Map(legacyFiles.map(file => [file, read(workspace, file)]));
    for (const [file, contents] of legacy) write(root, file, contents);
    const report = generate(root, { refresh: true });
    expect(report.existingTargets).toBe(5);
    for (const [file, contents] of legacy) expect(read(root, report.backupDirectory + '/' + file)).toBe(contents);
    expect(read(root, 'docs/execution/tasks/F24.md')).toContain('最终自动回归与工程证据审查');
  });

  it.each(['docs/execution/tasks/E01.md', 'docs/execution/checks/F24-prep.md', 'docs/execution/tasks/EF-index.md'])('拒绝刷新被人工改动的 %s，预检失败无部分覆盖', file => {
    const { root } = fixture();
    generate(root);
    write(root, file, read(root, file) + '\n人工保留记录\n');
    const before = snapshot(root);
    expect(() => generate(root, { refresh: true })).toThrow('modified or unrecognized');
    expect(snapshot(root)).toEqual(before);
  });

  it('拒绝未知文件、损坏或重复 F 证据，不生成半套卡', () => {
    const { root, result } = fixture();
    write(root, 'docs/execution/tasks/E01.md', 'not generated by this tool');
    expect(() => generate(root, { refresh: true })).toThrow('modified or unrecognized');
    unlinkSync(path.join(root, 'docs/execution/tasks/E01.md'));
    write(root, resultFile, 'null');
    expect(() => generate(root)).toThrow('Invalid F execution results');
    result.tasks.push(result.tasks[0]);
    write(root, resultFile, JSON.stringify(result));
    expect(() => generate(root)).toThrow('duplicate F execution');
    expect(existsSync(path.join(root, 'docs/execution/tasks/F01.md'))).toBe(false);
  });

  it('正式门禁状态已变化或计划版本错误时拒绝生成，不改正式状态', () => {
    const { root, gate } = fixture();
    gate.fStarted = true;
    write(root, gateFile, JSON.stringify(gate));
    let before = snapshot(root);
    expect(() => generate(root)).toThrow('Gate snapshot changed');
    expect(snapshot(root)).toEqual(before);
    gate.fStarted = false;
    write(root, gateFile, JSON.stringify(gate));
    write(root, planFile, plan.replace('V1.2，D07自动开发门禁修订版', 'V1.1，旧计划'));
    before = snapshot(root);
    expect(() => generate(root)).toThrow('V1.2 implementation plan');
    expect(snapshot(root)).toEqual(before);
  });

  it('拒绝通过目录连接将刷新写到 root 之外', () => {
    const { root } = fixture();
    const outside = fixture().root;
    const junction = path.join(root, 'docs/execution/tasks');
    mkdirSync(path.dirname(junction), { recursive: true });
    symlinkSync(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
    const before = snapshot(outside);
    try {
      expect(() => generate(root, { refresh: true })).toThrow('symbolic link or junction');
      expect(snapshot(outside)).toEqual(before);
    } finally {
      unlinkSync(junction);
    }
  });

  it('CLI --root 在临时目录运行，未知参数失败且不回退工作区', () => {
    const { root } = fixture();
    const before = snapshot(root);
    const result = spawnSync(process.execPath, [script, '--root', root, '--check-only', '--refresh'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ mode: 'check-only', targets: 101, filesWritten: 0 });
    const invalid = spawnSync(process.execPath, [script, '--root', root, '--unknown-mode'], { cwd: root, encoding: 'utf8' });
    expect(invalid.status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });
});
