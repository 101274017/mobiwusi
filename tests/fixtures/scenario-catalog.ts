export const scenarioCatalog = [
  { id: 'success', name: '正常完成', description: '分段讲解完整结束，允许生成本机学习笔记。', target: '/chat/new', area: 'conversation' },
  { id: 'empty', name: '空白资料', description: '独立命名空间中的笔记、待办与亲情关系均为空。', target: '/notes', area: 'repository' },
  { id: 'loading', name: '长时间处理中', description: '讲解持续等待，可随时停止；不会自动生成结果。', target: '/chat/new', area: 'conversation' },
  { id: 'timeout', name: '讲解超时', description: '显示可读错误，保留问题，可主动重试。', target: '/chat/new', area: 'conversation' },
  { id: 'offline', name: '网络断开', description: '讲解不可用，本机资料和练习不受影响。', target: '/chat/new', area: 'conversation' },
  { id: 'permission-denied', name: '权限拒绝', description: '模拟服务拒绝当前请求，不伪造系统权限状态。', target: '/chat/new', area: 'conversation' },
  { id: 'low-confidence', name: '无法确定下一步', description: '应用内教学暂停定位并提供亲情兜底，不猜测目标。', target: '/overlay/guide', area: 'guidance' },
  { id: 'risk-pause', name: '风险暂停', description: '应用内教学触发交易风险，恢复需重新确认。', target: '/overlay/guide', area: 'guidance' },
  { id: 'stream-interrupted', name: '流式回复中断', description: '首段后中断，保留未完成标记，不生成学习笔记。', target: '/chat/new', area: 'conversation' },
  { id: 'version-conflict', name: '版本冲突', description: '初始化后拒绝资料写入，保留已保存版本，不自动覆盖。', target: '/notes/demo-note-font', area: 'repository' },
  { id: 'partial-failure', name: '部分步骤失败', description: '收到首段但后续服务失败，不冒充完整讲解。', target: '/chat/new', area: 'conversation' },
  { id: 'invite-expired', name: '邀请过期', description: '演示家属邀请过期，不能接听或自动建立共享。', target: '/assist/demo-family', area: 'assistance' },
  { id: 'provider-quota', name: '供应配额不足', description: '显示服务暂不可用，允许转本地练习或联系家人。', target: '/chat/new', area: 'conversation' },
] as const;

export type MockScenario = typeof scenarioCatalog[number]['id'];

export function isMockScenario(value: string): value is MockScenario {
  return scenarioCatalog.some(scenario => scenario.id === value);
}
