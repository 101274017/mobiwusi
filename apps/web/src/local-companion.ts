export interface LocalCompanionDescriptor {
  id: 'lili';
  version: string;
}

export interface LocalCompanionBridge {
  showLili(): Promise<LocalCompanionDescriptor>;
}

declare global {
  interface Window { nuanbanCompanion?: LocalCompanionBridge; }
}

export function localCompanionBridge(): LocalCompanionBridge | undefined {
  const bridge = window.nuanbanCompanion;
  return bridge && typeof bridge.showLili === 'function' ? bridge : undefined;
}

export async function showLiliCompanion(): Promise<LocalCompanionDescriptor> {
  const bridge = localCompanionBridge();
  if (!bridge) throw new Error('请在暖伴桌面客户端中调用栗栗桌宠。');
  const result = await bridge.showLili();
  if (!result || result.id !== 'lili' || typeof result.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(result.version)) throw new Error('栗栗资源状态未确认，请重试。');
  return { id: result.id, version: result.version };
}
