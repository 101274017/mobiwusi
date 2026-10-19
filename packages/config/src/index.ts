export type ApiMode = 'local' | 'real';
export type PlatformMode = 'browser' | 'windows' | 'android';

export function configuration(env: Record<string, string | undefined>, _production: boolean) {
  const apiMode = env.VITE_API_MODE ?? 'local';
  const platformMode = env.VITE_PLATFORM_MODE ?? 'browser';
  if (!['local', 'real'].includes(apiMode)) throw new Error('未知业务模式：仅支持 local 或 real，Mock 已停用。');
  if (!['browser', 'windows', 'android'].includes(platformMode)) throw new Error('配置包含未知平台模式');
  if (env.VITE_MOCK_SCENARIO) throw new Error('演示场景已移除，请删除 VITE_MOCK_SCENARIO 配置。');
  return { apiMode: apiMode as ApiMode, platformMode: platformMode as PlatformMode };
}
