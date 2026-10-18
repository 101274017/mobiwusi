import { createHash, randomUUID } from 'node:crypto';
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readImplementationPlan } from './implementation-plan.mjs';
import { isDevelopmentEligible } from './project-gate.mjs';

const generator = 'scripts/generate-ef-execution-cards.mjs';
const gateFile = 'docs/implementation/evidence/d-gate-readiness-results.json';
const fResultFile = 'docs/implementation/evidence/f-execution-results.json';
const readyStatuses = ['implemented', 'verified', 'checks_passed'];
const eEvidence = {
  E01: ['apps/server/src/auth.ts', 'tests/server/auth.test.ts'],
  E02: ['apps/server/src/family.ts', 'tests/server/family.test.ts'],
  E03: ['packages/sync-engine/src/services.ts', 'tests/sync/sync-engine.test.ts'],
  E04: ['packages/sync-engine/src/services.ts', 'tests/sync/sync-engine.test.ts'],
  E05: ['packages/sync-engine/src/services.ts', 'tests/sync/sync-engine.test.ts'],
  E06: ['packages/asset-service/src/index.ts', 'tests/assets/asset-service.test.ts'],
  E07: ['apps/server/src/http.ts', 'tests/server/http.test.ts'],
  E08: ['packages/provider-sandbox/src/index.ts', 'tests/provider/e08-e12.test.ts'],
  E09: ['packages/asset-service/src/index.ts', 'tests/assets/asset-service.test.ts'],
  E10: ['packages/media-session/src/index.ts', 'tests/media-session/media-session.test.ts'],
  E11: ['packages/provider-sandbox/src/index.ts', 'tests/provider/e08-e12.test.ts'],
  E12: ['packages/provider-sandbox/src/index.ts', 'tests/provider/e08-e12.test.ts'],
  E13: ['packages/api-client/src/remote.ts', 'tests/contract/remote-api-client.test.ts'],
  E14: ['packages/api-client/src/index.ts', 'tests/contract/remote-api-client.test.ts'],
  E15: ['packages/api-client/src/index.ts', 'tests/contract/remote-api-client.test.ts'],
  E16: ['packages/contracts/src/validation.ts', 'tests/contract/schema.test.ts'],
  E17: ['apps/android/app/src/main/AndroidManifest.xml', 'tests/native/android-lab.test.ts'],
  E18: ['apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', 'tests/native/android-lab.test.ts'],
  E19: ['apps/desktop/native-runtime.cjs', 'tests/platform/desktop-native-runtime.test.ts'],
  E20: ['apps/desktop/native-runtime.cjs', 'tests/platform/desktop-native-runtime.test.ts'],
  E21: ['packages/accessibility-assets/src/index.ts', 'tests/accessibility/e21.test.ts'],
  E22: ['packages/quality-gates/src/index.ts', 'tests/quality/e22-e23.test.ts'],
  E23: ['packages/quality-gates/src/index.ts', 'tests/quality/e22-e23.test.ts'],
  E24: ['packages/flow-library/src/index.ts', 'tests/flows/e24-e26.test.ts'],
  E25: ['scripts/check-release-readiness.mjs', 'tests/acceptance/release-readiness.test.ts'],
  E26: ['packages/flow-library/src/index.ts', 'tests/flows/e24-e26.test.ts'],
};

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function timestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

function quote(value) {
  return JSON.stringify(String(value));
}

function sectionRows(lines, heading, nextHeading, prefix) {
  const start = lines.findIndex(line => line.startsWith(heading));
  if (start < 0) throw new Error(`Missing WBS section: ${heading}`);
  let end = lines.length;
  if (nextHeading) {
    const next = lines.findIndex((line, index) => index > start && line.startsWith(nextHeading));
    if (next < 0) throw new Error(`Missing next WBS section: ${nextHeading}`);
    end = next;
  } else {
    const next = lines.findIndex((line, index) => index > start && line.startsWith('### '));
    if (next >= 0) end = next;
  }
  return lines.slice(start + 1, end)
    .map((raw, offset) => ({ raw, line: start + offset + 2 }))
    .filter(({ raw }) => raw.startsWith(`| ${prefix}`))
    .map(({ raw, line }, index) => {
      const cells = raw.slice(1, -1).split('|').map(cell => cell.trim());
      if (cells.length !== 7) throw new Error(`${prefix} WBS row ${index + 1} has ${cells.length} cells, expected 7: ${raw}`);
      const match = cells[0].match(/^([EF]\d{2})\s+(.+)$/);
      if (!match) throw new Error(`Invalid task identifier in WBS row: ${raw}`);
      return {
        id: match[1],
        title: match[2],
        raw,
        line,
        scope: cells[0],
        inputs: cells[1],
        schedule: cells[2],
        owner: cells[3],
        activity: cells[4],
        acceptance: cells[5],
        risk: cells[6],
        hash: sha256(raw),
      };
    });
}

export function developmentDependencySatisfied(state, relation) {
  const status = state?.development_status ?? state?.developmentStatus ?? state?.status;
  return relation.split('/').every(part => {
    if (!['FS', 'SS', 'FF'].includes(part)) return false;
    return readyStatuses.includes(status)
      || (part === 'SS' && (state?.development_execution_started === true || state?.developmentExecutionStarted === true));
  });
}

function localDependencies(task, states) {
  const input = task.inputs.split('前置 ')[1] ?? '';
  return input.split('，').flatMap(clause => {
    const relation = clause.match(/[:：]\s*(FS|SS|FF)(?:\/(FS|SS|FF))?/)?.[0].replace(/^[:：]\s*/, '');
    if (!relation) return [];
    const taskIds = [...clause.split(/[:：]/)[0].matchAll(/\b([EF])(\d{2})(?:[～~-](?:\1)?(\d{2}))?/g)]
      .flatMap(match => {
        const start = Number(match[2]);
        const end = Number(match[3] ?? match[2]);
        if (end < start || end > (match[1] === 'E' ? 26 : 24)) throw new Error('Invalid WBS dependency range: ' + clause);
        return Array.from({ length: end - start + 1 }, (_, offset) => match[1] + String(start + offset).padStart(2, '0'));
      });
    return taskIds.map(id => ({
      id,
      relation,
      development_status: states[id]?.status ?? 'ready_for_local_checks',
      development_execution_started: states[id]?.developmentExecutionStarted === true,
      satisfied: developmentDependencySatisfied(states[id], relation),
    }));
  });
}

function developmentStates(root, tasks, gate) {
  const resultPath = path.join(root, fResultFile);
  const resultText = existsSync(resultPath) ? readFileSync(resultPath, 'utf8') : null;
  const result = resultText === null ? null : JSON.parse(resultText);
  if (resultText !== null && (!result || !Array.isArray(result.tasks))) throw new Error('Invalid F execution results: tasks must be an array');
  const records = new Map();
  for (const record of result?.tasks ?? []) {
    if (!/^F(?:0[1-9]|1\d|2[0-4])$/.test(record?.id) || records.has(record.id)) {
      throw new Error('Invalid or duplicate F execution task identifier');
    }
    records.set(record.id, record);
  }
  const eligible = isDevelopmentEligible(gate);
  return Object.fromEntries(tasks.map(task => {
    const initial = {
      status: eligible ? 'ready_for_local_checks' : 'blocked_by_code',
      automated: 'not_run',
      developmentExecutionStarted: false,
      scope: 'not_run',
      evidenceRefs: [],
      fingerprint: null,
    };
    if (task.id.startsWith('E')) {
      const entries = eEvidence[task.id];
      const present = entries.filter(file => lstatSync(path.join(root, file), { throwIfNoEntry: false })?.isFile());
      return [task.id, {
        ...initial,
        status: present.length === entries.length ? 'implemented' : initial.status,
        developmentExecutionStarted: present.length > 0,
        scope: 'code_and_test_entry_existence_only',
        evidenceRefs: present,
      }];
    }
    const record = records.get(task.id);
    const evidence = record?.evidence;
    const failed = record?.developmentStatus === 'checks_failed' || record?.developmentStatus === 'failed'
      || record?.developmentStatus === 'blocked_by_code' || evidence?.success === false
      || evidence?.localChecksPassed === false;
    const passed = result?.mode === 'development_only' && result.success === true
      && result.realNetworkEnabled === false && result.productionDataEnabled === false
      && result.realDevicesEnabled === false && result.fStarted === false
      && result.formalComplete === false && result.formalFExecutionStarted === false
      && record?.developmentStatus === 'checks_passed' && !failed
      && evidence !== null && typeof evidence === 'object' && !Array.isArray(evidence)
      && Object.keys(evidence).length > 0 && (evidence.id === undefined || evidence.id === task.id);
    return [task.id, {
      ...initial,
      status: passed ? 'verified' : failed ? 'blocked_by_code' : initial.status,
      automated: passed ? 'checks_passed' : failed ? 'failed' : 'not_run',
      developmentExecutionStarted: passed || evidence?.developmentExecutionStarted === true,
      scope: record ? 'existing_local_checks_snapshot_only' : 'not_run',
      evidenceRefs: record ? [fResultFile] : [],
      fingerprint: record ? 'sha256:' + sha256(resultText) : null,
    }];
  }));
}

function writeList(name, values) {
  return values.length ? `${name}:\n${values.map(value => `  - ${quote(value)}`).join('\n')}` : `${name}: []`;
}

function managed(text) {
  return `${text}\n<!-- generated-by: ${generator}; sha256:${sha256(text)} -->\n`;
}

function developmentSnapshot(gate) {
  return gate.development?.verdict ?? gate.developmentStatus ?? 'NOT_ASSESSED';
}

function cardFor(task, now, gate, state, prerequisites, sourcePlan) {
  const taskFile = `docs/execution/tasks/${task.id}.md`;
  const checkFile = `docs/execution/checks/${task.id}-prep.md`;
  const sourceRefs = [
    sourcePlan,
    'docs/implementation/wbs.md',
    'docs/implementation/status.md',
    'docs/implementation/acceptance.md',
    'docs/implementation/verification.md',
    'docs/implementation/d-gate-readiness.md',
  ];
  const evidenceRefs = [
    'docs/implementation/evidence/d-gate-readiness-results.json',
    'docs/implementation/evidence/c15-nv-readiness-results.json',
    'docs/implementation/evidence/c16-decision-readiness-results.json',
    'docs/implementation/evidence/c14-handoff-results.json',
  ];
  const stageGate = task.id.startsWith('E')
    ? '阶段 E 开发读取 D07 自动开发结论与前置任务的 development 状态；D07 正式批准只约束对应真实验证与发布，不作为本地编码的人工前置。'
    : '阶段 F 本地代码、契约夹具与自动测试按前置 development 状态调度；真实双端/供应联调、真人试点及发布仍须满足对应真实条件与授权。';
  const blockerList = [
    `正式状态仍为 ${gate.status} / ${gate.acceptance}，goNoGoEligible=${gate.goNoGoEligible}；生成任务卡不解除正式 D07 门禁。`,
    '真实验证/发布须核对原验收、有效授权及目标支持矩阵；本地开发通过不能替代正式验收。',
  ];
  const externalDependencies = [
    '真实设备与目标平台支持矩阵：external_pending；按适用范围补实测，未测设备不标支持。',
    '真实供应凭证与实际调用：external_pending；受影响生产能力默认关闭，开发适配器显式隔离。',
    '真实参与者、用户同意、试点及对外签收：external_pending；不替他人授权，不伪造真人结果。',
    'D07 正式发布门禁及适用独立复核：external_pending；自动复核不等于人工批准。',
  ];
  const frontmatter = [
    '---',
    `id: ${quote(task.id)}`,
    `baseline_ref: ${quote(`${sourcePlan}#L${task.line}`)}`,
    `baseline_row_hash: ${quote(`sha256:${task.hash}`)}`,
    'status: "blocked"',
    'acceptance: "preparatory_not_accepted"',
    `development_status: ${quote(state.status)}`,
    `development_execution_started: ${state.developmentExecutionStarted}`,
    `development_evidence_scope: ${quote(state.scope)}`,
    `development_evidence_fingerprint: ${state.fingerprint ? quote(state.fingerprint) : 'null'}`,
    'verification:',
    `  automated: ${quote(state.automated)}`,
    '  native: "external_pending"',
    '  live_provider: "external_pending"',
    '  field_trial: "external_pending"',
    writeList('external_dependencies', externalDependencies),
    `step: ${quote('prep-00 / V1.2 双状态任务卡；开发与正式验证分别记录')}`,
    `next_action: ${quote('读取相关 PRD/技术方案/契约与代码，核对 D07 开发检查及前置 development 状态；开发检查通过即可继续本地代码、契约夹具和自动测试，按 FS/SS/FF 记录实际结果；外部待项不阻断独立开发，正式验收另查。')}`,
    'execution_started: false',
    `updated_at: ${quote(now)}`,
    writeList('files', [taskFile, checkFile]),
    writeList('evidence_refs', [...evidenceRefs, ...state.evidenceRefs]),
    writeList('source_refs', sourceRefs),
    writeList('blockers', blockerList),
    'dependency_state:',
    `  required: ${quote(`${task.inputs}（保持原计划 FS/SS/FF 关系不变）`)}`,
    `  development_gate: ${quote(developmentSnapshot(gate))}`,
    `  development_gate_eligible: ${isDevelopmentEligible(gate)}`,
    `  development_ready_statuses: ${JSON.stringify(readyStatuses)}`,
    '  ss_started_field: "development_execution_started"',
    `  local_dependencies_satisfied: ${prerequisites.every(item => item.satisfied)}`,
    `  local_prerequisites: ${JSON.stringify(prerequisites)}`,
    `  observed: ${quote(`D=${gate.status}; acceptance=${gate.acceptance}; goNoGoEligible=${gate.goNoGoEligible}; eAfterDEligible=${gate.eAfterDEligible}; eStarted=${gate.eStarted}; fStarted=${gate.fStarted}.`)}`,
    `  downstream: ${quote(stageGate)}`,
    '---',
    '',
  ].join('\n');
  const body = [
    `# ${task.id} ${task.title} 任务卡`,
    '',
    '## 计划原始任务行',
    '',
    `> ${task.raw}`,
    '',
    `原始行位于改版计划第 ${task.line} 行，UTF-8（不含行尾换行）SHA-256：\`${task.hash}\`。原行逐字保留，本卡不更改 WBS 范围、主责、工期、依赖或验收。`,
    '',
    '## 计划字段（原文提取）',
    '',
    `- 工作包：${task.scope}`,
    `- 需求与输入依赖：${task.inputs}`,
    `- 周窗/历时：${task.schedule}`,
    `- 主责/人日：${task.owner}`,
    `- 执行活动与输出：${task.activity}`,
    `- 验收证据：${task.acceptance}`,
    `- 风险/接入点：${task.risk}`,
    '',
    '## 当前状态与实施边界',
    '',
    `- 本文件是 ${task.id} 的双状态执行任务卡；正式状态保持 blocked / preparatory_not_accepted，execution_started=false。`,
    `- 开发状态：${state.status}；开发已开始：${state.developmentExecutionStarted}；自动验证：${state.automated}；证据范围：${state.scope}。`,
    '- E 的 implemented 只证明代码和测试入口存在，不表示测试通过；F 的 verified 只引用已有本地 checks_passed 与非空证据，不表示重新执行或真实验收。',
    `- 当前关口快照：D=${gate.status}，goNoGoEligible=${gate.goNoGoEligible}，eAfterDEligible=${gate.eAfterDEligible}，eStarted=${gate.eStarted}，fStarted=${gate.fStarted}。`,
    `- 开发门禁快照：${developmentSnapshot(gate)}；只引用现有证据，生成时未重验或改写 D07。`,
    `- ${stageGate}`,
    '- FS/SS/FF 保留代码间依赖；implemented / verified / checks_passed 可满足本地前置，SS 也可读取 development_execution_started=true，不使用正式 execution_started 代替。',
    '- local_prerequisites 仅列 E/F 本地依赖快照；C/D 前置仍须核对各自 development 证据，生成器未重新执行这些检查。',
    '- 开发检查通过可继续本地业务代码、本地服务、契约夹具和自动测试；不再等待人工填写开发决定、Top20 或签字。实际代码、契约或安全失败须修复，不得改记 external_pending。',
    '- 不改变依赖、不削减原验收，不伪造真实服务、设备、供应、凭证、人工签收、独立复核或试点结果。',
    '- 真实集成仅在其授权与条件满足后逐步启用；外部条件缺失的生产能力默认关闭且需验证拒绝路径。Mock、合成数据与自动测试不得冒充真实验收或发布 READY。',
    '',
    '## 外部验证待项',
    '',
    ...externalDependencies.map(value => `- ${value}`),
    '',
    '## 后续执行记录',
    '',
    `当前具体下一步：核对开发门禁及前置 development 状态后推进可执行代码；在 \`docs/execution/checks/${task.id}-<run>.md\` 追加真实命令、退出码、环境、版本指纹、证据和未执行范围，分别更新开发与 verification。`,
    '',
    `本次生成动作未实施或验证 ${task.id} 业务代码，也未启动真实网络、设备、供应、真人试点或正式发布；不据此否定仓库已有实现或宣称已正式验收。`,
  ].join('\n');
  return { taskFile, checkFile, taskText: `${frontmatter}${body}\n` };
}

function checkFor(task, now, gate, state) {
  const taskFile = `docs/execution/tasks/${task.id}.md`;
  return [
    `# ${task.id} 任务卡生成与前置检查`,
    '',
    `生成时间：${now}（Asia/Shanghai）  `,
    '正式状态：`blocked / preparatory_not_accepted`；`execution_started=false`  ',
    `开发状态：\`${state.status}\`；开发已开始：\`${state.developmentExecutionStarted}\`；自动验证：\`${state.automated}\`。`,
    '记录性质：WBS 原文提取、开发证据快照与外部待项登记；不是本任务业务验收或发布签收。',
    '',
    '## 基线与依赖',
    '',
    `- 计划原行（第 ${task.line} 行）：${task.raw}`,
    `- SHA-256：\`${task.hash}\`（UTF-8 原行字节，不含行尾换行）。`,
    `- 原始输入依赖：${task.inputs}`,
    `- 验收证据原文：${task.acceptance}`,
    `- 风险/接入点原文：${task.risk}`,
    '',
    '## 生成时关口快照',
    '',
    `- 关口证据生成时间：\`${gate.generatedAt}\`；D 状态 \`${gate.status}\` / \`${gate.acceptance}\`。`,
    `- \`goNoGoEligible=${gate.goNoGoEligible}\`、\`eAfterDEligible=${gate.eAfterDEligible}\`、\`eStarted=${gate.eStarted}\`、\`fStarted=${gate.fStarted}\`。`,
    `- 开发门禁快照：\`${developmentSnapshot(gate)}\`；须与前置 development 状态一起核对，不以正式 blocked 阻断独立编码。`,
    '- 不要求人工开发签字、override 文件或 --bypass-d07；真实生产能力仍服从正式门禁与授权。',
    '',
    '## 本轮动作与未执行事项',
    '',
    `- 从改版计划指定的 E/F WBS 表机械提取原行，生成 ${taskFile} 与本检查记录；未改动原计划行。`,
    '- 仅生成执行文档；没有修改产品代码、服务、数据库、网络适配、Android/Windows 原生能力或供应集成。',
    `- 本次未运行该 WBS 实现或测试；已有证据范围为 ${state.scope}，不得将生成动作算成一次新的通过。`,
    ...state.evidenceRefs.map(file => `- 既有开发证据：\`${file}\`。`),
    ...(state.fingerprint ? [`- 既有证据内容指纹：\`${state.fingerprint}\`；只证明引用内容，不证明当前代码重新运行。`] : []),
    '- E implemented 仅为代码/测试入口存在性；F verified 仅为已有本地检查通过。设备、供应及真人验证继续 external_pending。',
    '- 未刷新共享 evidence；当前关口值只作为生成时快照，正式执行前必须重查。',
    '',
    '## 结论',
    '',
    `${task.id} 的 WBS 行已映射到双状态任务卡；开发检查通过可继续本地代码、契约夹具和自动测试，FS/SS/FF 读取 development 状态。正式状态仍为 blocked / preparatory_not_accepted；本地结果不能冒充真实验收或阶段正式完成。`,
    '',
  ].join('\n');
}

function safeTarget(root, relativeFile) {
  const target = path.resolve(root, relativeFile);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Output is outside the selected root: ' + relativeFile);
  }
  const segments = relative.split(path.sep);
  let current = root;
  for (let index = 0; index <= segments.length; index += 1) {
    const entry = lstatSync(current, { throwIfNoEntry: false });
    if (entry?.isSymbolicLink()) throw new Error('Refusing symbolic link or junction: ' + current);
    if (entry && (index < segments.length ? !entry.isDirectory() : !entry.isFile())) {
      throw new Error('Unexpected output path type: ' + current);
    }
    if (index < segments.length) current = path.join(current, segments[index]);
  }
  return target;
}

function legacyGenerated(output, text) {
  const normalized = text.replaceAll('\r\n', '\n');
  if (output.kind === 'card') {
    const raw = normalized.match(/^> (\| [EF]\d{2} .+\|)$/m)?.[1];
    return normalized.startsWith('---\nid: ' + quote(output.id) + '\n')
      && /^status: "blocked"$/m.test(normalized)
      && /^acceptance: "preparatory_not_accepted"$/m.test(normalized)
      && /^execution_started: false$/m.test(normalized)
      && !/^development_/m.test(normalized)
      && normalized.includes('step: "prep-00 / WBS 任务卡已生成；等待 D 关口及原始前置依赖解除"')
      && raw && normalized.includes('baseline_row_hash: ' + quote('sha256:' + sha256(raw)))
      && normalized.endsWith('生成时未实施 ' + output.id + ' 业务代码；未启动后端、供应商、真实网络、设备操作、联调、试点或发布。\n');
  }
  if (output.kind === 'check') {
    return normalized.startsWith('# ' + output.id + ' 任务卡生成与前置检查\n')
      && normalized.includes('任务状态：`blocked / preparatory_not_accepted`')
      && normalized.includes('未刷新共享 evidence；当前关口值只作为生成时快照，正式执行前必须重查。')
      && normalized.endsWith('不得把任务卡生成计为 E/F 阶段完成。\n');
  }
  return normalized.startsWith('# E/F 執行任務索引\n')
    && normalized.match(/^\| [EF]\d{2} \|/gm)?.length === 50
    && normalized.endsWith('合计：E 26 项，F 24 项；只生成计划卡/检查记录，未修改业务代码、共享 evidence 或阶段状态。\n');
}

function assertRefreshable(output, text) {
  const marker = text.match(/\n<!-- generated-by: scripts\/generate-ef-execution-cards\.mjs; sha256:([a-f0-9]{64}) -->\n$/);
  if (marker && sha256(text.slice(0, marker.index)) === marker[1]) return;
  if (!text.includes('generated-by:') && legacyGenerated(output, text)) return;
  throw new Error('Refusing to refresh modified or unrecognized generated file: ' + output.file);
}

function writeOutputs(root, outputs, existing, refresh) {
  const runId = new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID();
  const backupDirectory = refresh && existing.size ? 'docs/execution/.ef-card-backups/' + runId : null;
  if (backupDirectory) {
    for (const output of outputs.filter(item => existing.has(item.file))) {
      const backupPath = safeTarget(root, backupDirectory + '/' + output.file);
      mkdirSync(path.dirname(backupPath), { recursive: true });
      copyFileSync(safeTarget(root, output.file), backupPath, constants.COPYFILE_EXCL);
      if (readFileSync(backupPath, 'utf8') !== existing.get(output.file)) {
        throw new Error('Source changed during backup; no targets refreshed: ' + output.file);
      }
    }
  }
  const staged = [];
  const committed = [];
  try {
    for (const output of outputs) {
      const target = safeTarget(root, output.file);
      mkdirSync(path.dirname(target), { recursive: true });
      const temporary = target + '.ef-' + runId + '.tmp';
      writeFileSync(temporary, output.text, { encoding: 'utf8', flag: 'wx' });
      staged.push({ ...output, target, temporary });
    }
    for (const output of staged) {
      safeTarget(root, output.file);
      const expected = existing.get(output.file);
      if (expected === undefined ? existsSync(output.target) : readFileSync(output.target, 'utf8') !== expected) {
        throw new Error('Target changed after preflight: ' + output.file);
      }
    }
    for (const output of staged) {
      if (existing.has(output.file)) {
        renameSync(output.temporary, output.target);
      } else {
        copyFileSync(output.temporary, output.target, constants.COPYFILE_EXCL);
      }
      committed.push(output);
    }
  } catch (error) {
    for (const output of committed.reverse()) {
      safeTarget(root, output.file);
      if (readFileSync(output.target, 'utf8') !== output.text) {
        throw new Error('Concurrent edit prevents rollback; originals retained in ' + backupDirectory, { cause: error });
      }
      const original = existing.get(output.file);
      if (original === undefined) unlinkSync(output.target);
      else writeFileSync(output.target, original, 'utf8');
    }
    throw error;
  } finally {
    for (const output of staged) {
      if (existsSync(output.temporary)) unlinkSync(output.temporary);
    }
  }
  return backupDirectory;
}

export function generateEFExecutionCards({ root = process.cwd(), checkOnly = false, refresh = false } = {}) {
  root = path.resolve(root);
  const planSource = readImplementationPlan(root);
  if (!planSource.exists) throw new Error('Required input missing: V1.2 implementation plan');
  const sourcePlan = planSource.path;
  const gatePath = path.join(root, gateFile);
  if (!existsSync(gatePath)) throw new Error(`Required input missing: ${gateFile}`);
  const plan = planSource.text;
  const lines = plan.split(/\r?\n/);
  const eTasks = sectionRows(lines, '### 3.6 阶段 E 工作包', '### 3.7 阶段 F 工作包', 'E');
  const fTasks = sectionRows(lines, '### 3.7 阶段 F 工作包', null, 'F');
  if (eTasks.length !== 26 || fTasks.length !== 24) {
    throw new Error(`Unexpected WBS counts: E=${eTasks.length}/26, F=${fTasks.length}/24`);
  }
  const tasks = [...eTasks, ...fTasks];
  if (new Set(tasks.map(task => task.id)).size !== 50) throw new Error('E/F task identifiers are not unique');
  const expectedIds = [...Array.from({ length: 26 }, (_, index) => 'E' + String(index + 1).padStart(2, '0')),
    ...Array.from({ length: 24 }, (_, index) => 'F' + String(index + 1).padStart(2, '0'))];
  if (tasks.some((task, index) => task.id !== expectedIds[index])) throw new Error('Unexpected E/F task identifier sequence');
  const gate = JSON.parse(readFileSync(gatePath, 'utf8'));
  if (gate.status !== 'blocked' || gate.acceptance !== 'preparatory_not_accepted'
    || gate.goNoGoEligible !== false || gate.eStarted !== false || gate.fStarted !== false) {
    throw new Error('Gate snapshot changed; refresh the decision and task-card state before generating.');
  }
  const now = timestamp();
  const states = developmentStates(root, tasks, gate);
  const outputs = tasks.flatMap(task => {
    const state = states[task.id];
    const card = cardFor(task, now, gate, state, localDependencies(task, states), sourcePlan);
    return [
      { id: task.id, kind: 'card', file: card.taskFile, text: managed(card.taskText) },
      { id: task.id, kind: 'check', file: card.checkFile, text: managed(checkFor(task, now, gate, state)) },
    ];
  });
  const indexText = [
    '# E/F 执行任务索引（V1.2 双状态）',
    '',
    `生成时间：${now}（Asia/Shanghai）  `,
    `计划来源：\`${sourcePlan}\`；原计划 E/F WBS 行逐字保存在各自任务卡。  `,
    `生成时正式关口：D=\`${gate.status}\` / \`${gate.acceptance}\`；\`goNoGoEligible=false\`、\`eAfterDEligible=${gate.eAfterDEligible}\`、\`eStarted=false\`、\`fStarted=false\`。`,
    `开发门禁快照：\`${developmentSnapshot(gate)}\`；自动开发可继续不等于正式发布就绪。`,
    '',
    '> 正式字段继续 blocked / preparatory_not_accepted / execution_started=false。开发检查通过后，按前置 development 状态和 FS/SS/FF 继续本地代码、契约夹具与自动测试，不等待人工开发签字、override 文件或 --bypass-d07；真实设备、供应、真人试点及发布仍独立验证。',
    '',
    'E implemented 仅指代码与测试入口存在，automated=not_run；F verified 仅引用已有离线 checks_passed 与非空证据，未在生成时重跑。未验证项为 ready_for_local_checks，实际失败为 blocked_by_code。',
    '',
    '| ID | 工作包 | 开发状态 | 自动验证 | 外部验证 | 正式状态 | 依赖 | 任务卡 | 检查记录 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...tasks.map(task => `| ${task.id} | ${task.title} | ${states[task.id].status} | ${states[task.id].automated} | external_pending | blocked / preparatory_not_accepted | ${task.inputs.replaceAll('|', '/')} | [卡](./${task.id}.md) | [检查](../checks/${task.id}-prep.md) |`),
    '',
    `合计：E ${eTasks.length} 项，F ${fTasks.length} 项；只生成计划卡/检查记录，未修改业务代码、共享 evidence 或阶段状态。`,
    '',
  ].join('\n');
  outputs.push({ id: 'EF-index', kind: 'index', file: 'docs/execution/tasks/EF-index.md', text: managed(indexText) });

  const existing = new Map();
  for (const output of outputs) {
    const target = safeTarget(root, output.file);
    if (existsSync(target)) existing.set(output.file, readFileSync(target, 'utf8'));
  }
  if (!checkOnly && !refresh && existing.size) {
    throw new Error('Refusing to overwrite existing targets; use --refresh after reviewing generated files:\n'
      + [...existing.keys()].map(file => '- ' + file).join('\n'));
  }
  if (refresh) {
    for (const output of outputs.filter(item => existing.has(item.file))) assertRefreshable(output, existing.get(output.file));
  }

  const backupDirectory = checkOnly ? null : writeOutputs(root, outputs, existing, refresh);
  return {
    mode: checkOnly ? 'check-only' : refresh ? 'refreshed' : 'generated',
    refresh,
    sourcePlan,
    eTasks: eTasks.length,
    fTasks: fTasks.length,
    targets: outputs.length,
    filesWritten: checkOnly ? 0 : outputs.length,
    existingTargets: existing.size,
    backupDirectory,
    gate: { status: gate.status, acceptance: gate.acceptance, goNoGoEligible: gate.goNoGoEligible, eStarted: gate.eStarted, fStarted: gate.fStarted },
    developmentGate: developmentSnapshot(gate),
    development: tasks.map(task => ({ id: task.id, ...states[task.id], prerequisites: localDependencies(task, states) })),
    wbsHashes: tasks.map(task => ({ id: task.id, hash: task.hash })),
    first: outputs[0].file,
    last: outputs.at(-1).file,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: {
      root: { type: 'string' },
      refresh: { type: 'boolean' },
      'check-only': { type: 'boolean' },
    } });
    console.log(JSON.stringify(generateEFExecutionCards({ root: values.root, refresh: values.refresh, checkOnly: values['check-only'] }), null, 2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
