import { configuration } from '@nuanban/config';
import { IndexedDbRepository, IndexedDbDrawing, IndexedDbDrawingJobs } from '@nuanban/local-data';
import { DemoConversation, DemoAccountFlow, ScenarioRepository, createScenarioSnapshot } from '@nuanban/mocks';
import { RemoteApiClient, RemoteConversation, RemoteRepository, RemoteViews, UnconnectedConversation, UnconnectedRepository } from '@nuanban/api-client';
import { createPlatform } from '@nuanban/platform-ports';
import type { AppServices } from '@nuanban/application';
const formalDeployment = import.meta.env.VITE_DEPLOYMENT === 'production';
const hashParameters = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
const requestedScenario = hashParameters.get('scenario') ?? new URLSearchParams(window.location.search).get('scenario');
const environment = { ...import.meta.env };
if (requestedScenario !== null) environment.VITE_MOCK_SCENARIO = requestedScenario;
export const config = configuration(environment,formalDeployment);
const demoRepository = new IndexedDbRepository();
const remoteBaseUrl = environment.VITE_API_BASE_URL;
if (config.apiMode === 'real' && !remoteBaseUrl) throw new Error('真实服务模式必须配置 VITE_API_BASE_URL，不会回退 Mock。');
export const remoteClient = config.apiMode === 'real' ? new RemoteApiClient({
  baseUrl: remoteBaseUrl!,
  authorization: () => environment.VITE_API_TOKEN,
}) : null;
export const remoteViews = remoteClient ? new RemoteViews(remoteClient) : null;
const ownerId = config.apiMode === 'mock' ? (config.scenario === 'success' ? 'demo-local-owner' : 'demo-' + config.scenario + '-owner') : (environment.VITE_API_OWNER_ID ?? 'remote-owner');
export const services: AppServices = {
  ownerId: ownerId,
  repository: config.apiMode === 'mock' ? new ScenarioRepository(demoRepository, config.scenario) : new RemoteRepository(remoteClient!),
  conversation: config.apiMode === 'mock' ? new DemoConversation(config.scenario) : new RemoteConversation(remoteClient!),
};
export const platform = createPlatform();
export const accountDemoService = config.apiMode === 'mock' ? new DemoAccountFlow() : null;
export const drawingService = new IndexedDbDrawing(services.ownerId);
export const drawingJobService = new IndexedDbDrawingJobs(services.ownerId);
export const initialSnapshot = () => {
  if (config.apiMode !== 'mock') throw new Error('真实服务模式不能初始化演示资料。');
  return createScenarioSnapshot(services.ownerId, config.scenario);
};
export async function resetCurrentScenario(): Promise<void> {
  if (config.apiMode !== 'mock') throw new Error('只能重置演示命名空间。');
  await demoRepository.clear(services.ownerId);
  await drawingService.clear();
  await drawingJobService.clear();
}
