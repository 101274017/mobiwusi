export type ApiMode = 'mock' | 'real';
import { isMockScenario } from './scenarios';
export { scenarioCatalog, isMockScenario, type MockScenario } from './scenarios';
export type PlatformMode = 'browser' | 'windows' | 'android';
export function configuration(env: Record<string,string|undefined>, production: boolean) {
  const apiMode = env.VITE_API_MODE ?? 'mock';
  const platformMode = env.VITE_PLATFORM_MODE ?? 'browser';
  if (!['mock','real'].includes(apiMode) || !['browser','windows','android'].includes(platformMode)) throw new Error('配置包含未知模式');
  if (production && apiMode === 'mock') throw new Error('正式部署禁止使用 Mock 业务服务');
  const scenario = env.VITE_MOCK_SCENARIO ?? 'success';
  if (!isMockScenario(scenario)) throw new Error('未知演示场景，不会静默回退正常场景');
  if (apiMode === 'real' && scenario !== 'success') throw new Error('真实服务模式禁止注入演示场景');
  return { apiMode:apiMode as ApiMode, platformMode:platformMode as PlatformMode, scenario };
}
