const earlyTaskDefinitions = [
  ['F01', '共享前端真实双端联调', 'AT-01～24/三场景；前置 E16/E22/E25：FS', 'F'],
  ['F02', 'Android真实双端联调', 'AT-01～24/三场景；前置 E16/E22/E25：FS', 'A'],
  ['F03', 'Windows/图形真实双端联调', 'AT-01～24/三场景；前置 E16/E22/E25：FS', 'W'],
  ['F04', '后端/运维真实双端联调', 'AT-01～24/三场景；前置 E16/E22/E25：FS', 'B'],
  ['F05', 'AI/媒体真实双端联调', 'AT-01～24/三场景；前置 E16/E22/E25：FS', 'I'],
  ['F06', '测试/安全复核真实双端联调', 'AT-01～24/三场景；前置 E16/E22/E25：FS', 'Q'],
  ['F07', '隐私/性能/长时/恢复测试', 'AT-07/10～12/17/21～23；前置 F06：SS，F01～F05：SS', 'Q'],
  ['F08', '自动回归与工程候选验收', 'AT-01～24；前置 F07：SS', 'Q'],
  ['F09', '试点工作流自动验证与真实观察状态', 'AT-24/无障碍；前置 F08：SS/FF', 'Q'],
  ['F10', '培训/反馈流程与材料自动交付', '公益/亲情/培训；前置 E24：FS，F08：SS', 'P'],
  ['F11', '自动工程验收与交付', '全基线工程交付；前置 F08/F09/F24的development结果：FS或FF', 'P'],
  ['F12', '培训材料与试点体验修订', '无障碍/交付；前置 E21：FS，F10：SS', 'D'],
];

function createTask([id, title, dependency, owner]) {
  return {
    id,
    title,
    dependency,
    owner,
    status: 'blocked',
    acceptance: 'preparatory_not_accepted',
    execution_started: false,
    fStarted: false,
    realNetworkEnabled: false,
    productionDataEnabled: false,
    localEvidence: [
      `docs/execution/tasks/${id}.md`,
      `docs/execution/checks/${id}-prep.md`,
    ],
    localTests: ['tests/acceptance/f-development-early.test.ts'],
  };
}

export const earlyTasks = earlyTaskDefinitions.map(createTask);
