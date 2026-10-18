const deliveryTaskDefinitions = [
  ['F13', '答辩素材与演示包整理', '答辩；前置 F12：FS', 'D'],
  ['F14', '共享前端联调/试点缺陷修复', 'F01～F09问题单；前置 F01～F06：SS', 'F'],
  ['F15', 'Android联调/试点缺陷修复', 'F01～F09问题单；前置 F01～F06：SS', 'A'],
  ['F16', 'Windows/图形联调/试点缺陷修复', 'F01～F09问题单；前置 F01～F06：SS', 'W'],
  ['F17', '后端/运维联调/试点缺陷修复', 'F01～F09问题单；前置 F01～F06：SS', 'B'],
  ['F18', 'AI/媒体联调/试点缺陷修复', 'F01～F09问题单；前置 F01～F06：SS', 'I'],
  ['F19', '部署、备份恢复与发布演练', '运维/交付；前置 F07：FS，F17：FS', 'B'],
  ['F20', 'Android签名/安装/升级交付', 'SYS/交付；前置 F15：FS', 'A'],
  ['F21', 'Windows签名/安装/升级交付', 'SYS/交付；前置 F16：FS', 'W'],
  ['F22', '代码/契约/客户端交接', '全客户端；前置 F14：FS', 'F'],
  ['F23', '供应/模型/媒体运维交接', 'AI/HELP/SAFE；前置 F18：FS', 'I'],
  ['F24', '最终自动回归与工程证据审查', 'AT-01～24/NV双状态；前置 F09开发结果：FS，F19～F23开发结果：SS/FF', 'Q'],
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
    localTests: ['tests/acceptance/f-development-delivery.test.ts'],
  };
}

export const deliveryTasks = deliveryTaskDefinitions.map(createTask);
