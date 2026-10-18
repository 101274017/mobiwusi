import type { ConversationPort, Repository, LocalSnapshot } from '@nuanban/application';
import type { ConversationEvent } from '@nuanban/contracts';
export { ApiClientError, RemoteApiClient, type ApiClientErrorKind, type ApiClientOptions, type ApiRequestOptions, type ApiResult, type FetchTransport, type RemoteStreamSchema, type RetryPolicy } from './remote';
export { RemoteConversation } from './remote';
export { RemoteRepository, RemoteViews, type RemoteFamilyView, type RemotePageOptions, type RemoteRepositoryOptions, type RemoteSyncView, type RemoteConversationView } from './adapters';
export { RemoteAssist, RemoteAssistAdapter, RemoteGuidance, RemoteGuidanceAdapter, RemotePetJobAdapter, RemotePetJobs, type RemoteAssistSignalOptions, type RemoteAssistSignalSource, type RemoteFeatureStreamOptions } from './feature-adapters';
export { ApiClientError as RemoteTransportError } from './errors';

export class UnconnectedConversation implements ConversationPort {
  async *stream(_text: string, _signal: AbortSignal): AsyncIterable<ConversationEvent> { throw new Error('真实 AI 服务尚未接入，不会回退演示回答。'); }
}
export class UnconnectedRepository implements Repository {
  async load(_ownerId: string): Promise<LocalSnapshot | null> { throw new Error('真实账号与资料服务尚未接入；不会读取或创建演示账号。'); }
  async commit(_ownerId: string, _snapshot: LocalSnapshot): Promise<void> { throw new Error('真实资料服务尚未接入，未保存。'); }
  async clear(_ownerId: string): Promise<void> { throw new Error('真实资料服务尚未接入，未删除任何资料。'); }
}
