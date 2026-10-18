import { ServiceFailure } from '@nuanban/application';
import type {
  AssistCreated,
  AssistEndRequest,
  AssistJoinRequest,
  AssistJoinResponse,
  AssistSignal,
  AssistRequest,
  AssistStateResponse,
  EndedResponse,
  GuidanceAnalyzeRequest,
  GuidanceCreateRequest,
  GuidanceCreateResponse,
  GuidanceVerifyRequest,
  GuidanceVerifyResponse,
  PetCurrentRequest,
  PetCurrentResponse,
  PetJobCancelled,
  PetJobCreated,
  PetJobDto,
  PetJobRequest,
  RequestAccepted,
  ServiceStreamEvent,
} from '@nuanban/contracts';
import { operations } from '@nuanban/contracts';
import { assistSignalMapper, serviceStreamEventMapper } from './mappers';
import { ApiClientError, RemoteApiClient } from './remote';

export interface RemoteFeatureStreamOptions {
  generation?: number;
  requestId?: string;
  sessionId?: string;
  signal?: AbortSignal;
}

export interface RemoteAssistSignalOptions extends RemoteFeatureStreamOptions {
  grantRevision?: number;
}

type StreamOptionsInput = RemoteFeatureStreamOptions | AbortSignal | undefined;

interface ActiveStream {
  generation: number;
  controller: AbortController;
}

function id(): string {
  if (!globalThis.crypto?.randomUUID) throw new ApiClientError('NETWORK_OFFLINE', '当前环境无法生成安全请求编号。');
  return globalThis.crypto.randomUUID();
}

function operationPath(operationId: string, parameters: Record<string, string>): string {
  const operation = operations.find(item => item.id === operationId);
  if (!operation?.stream) throw new ApiClientError('INVALID_REQUEST', `操作 ${operationId} 不是事件流操作。`);
  const expanded = operation.path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = parameters[key];
    if (!value) throw new ApiClientError('INVALID_REQUEST', `缺少路径参数：${key}`);
    return encodeURIComponent(value);
  });
  if (/[{}]/.test(expanded)) throw new ApiClientError('INVALID_REQUEST', '服务路径参数未完整提供。');
  return expanded;
}

function normalizeStreamOptions(options: StreamOptionsInput): RemoteFeatureStreamOptions {
  if (options && typeof options === 'object' && 'aborted' in options && 'addEventListener' in options) return { signal: options as AbortSignal };
  return options ?? {};
}

function linkAbort(signal?: AbortSignal): { controller: AbortController; detach: () => void } {
  const controller = new AbortController();
  if (!signal) return { controller, detach: () => undefined };
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  return { controller, detach: () => signal.removeEventListener('abort', abort) };
}

function staleFailure(label: string): ApiClientError {
  return new ApiClientError('STREAM_INTERRUPTED', `已拒绝迟到的${label}事件。`, true);
}

function cancelledFailure(label: string): ApiClientError {
  return new ApiClientError('CANCELLED', `${label}已取消，不再应用迟到状态。`);
}

function ensureOpen(closed: ReadonlySet<string>, resourceId: string, label: string): void {
  if (closed.has(resourceId)) throw cancelledFailure(label);
}

class RemoteStreamRegistry {
  private readonly generations = new Map<string, number>();
  private readonly active = new Map<string, ActiveStream>();

  begin(resourceId: string, signal?: AbortSignal): ActiveStream & { detach: () => void } {
    this.active.get(resourceId)?.controller.abort();
    const generation = (this.generations.get(resourceId) ?? 0) + 1;
    this.generations.set(resourceId, generation);
    const linked = linkAbort(signal);
    const stream = { generation, controller: linked.controller, detach: linked.detach };
    this.active.set(resourceId, stream);
    return stream;
  }

  isCurrent(resourceId: string, generation: number): boolean {
    return this.active.get(resourceId)?.generation === generation;
  }

  close(resourceId: string, generation: number): void {
    if (this.isCurrent(resourceId, generation)) this.active.delete(resourceId);
  }

  cancel(resourceId: string): void {
    const generation = (this.generations.get(resourceId) ?? 0) + 1;
    this.generations.set(resourceId, generation);
    this.active.get(resourceId)?.controller.abort();
    this.active.delete(resourceId);
  }
}

type ServiceEventTerminal = (event: ServiceStreamEvent) => boolean;

async function* consumeServiceEvents(
  client: RemoteApiClient,
  registry: RemoteStreamRegistry,
  resourceId: string,
  label: string,
  path: string,
  options: RemoteFeatureStreamOptions,
  allowedTypes: readonly ServiceStreamEvent['type'][],
  terminalTypes: readonly ServiceStreamEvent['type'][],
  terminal: ServiceEventTerminal,
  onTerminal: () => void,
): AsyncIterable<ServiceStreamEvent> {
  const active = registry.begin(resourceId, options.signal);
  const requestId = options.requestId ?? client.createRequestId();
  const map = serviceStreamEventMapper({ requestId, sessionId: options.sessionId, generation: options.generation }, { allowedTypes, terminalTypes });
  let ended = false;
  try {
    for await (const raw of client.streamEvents<ServiceStreamEvent>(path, requestId, active.controller.signal, 'ServiceStreamEvent')) {
      if (!registry.isCurrent(resourceId, active.generation)) throw staleFailure(label);
      const event = map(raw);
      if (event.type === 'pet_job.succeeded' && event.payload.assets.length === 0) throw new ApiClientError('STREAM_INTERRUPTED', '生成任务没有产物，不能伪报成功。', true, requestId);
      ended = terminal(event);
      if (ended) {
        onTerminal();
        registry.close(resourceId, active.generation);
      }
      yield event;
      if (ended) return;
    }
    if (!registry.isCurrent(resourceId, active.generation)) throw staleFailure(label);
    if (!ended) throw new ApiClientError('STREAM_INTERRUPTED', `${label}事件流未以终止事件结束。`, true, requestId);
  } catch (error) {
    if (!registry.isCurrent(resourceId, active.generation) && !(error instanceof DOMException && error.name === 'AbortError')) throw staleFailure(label);
    throw error;
  } finally {
    registry.close(resourceId, active.generation);
    active.detach();
  }
}

export class RemotePetJobs {
  private readonly streams = new RemoteStreamRegistry();
  private readonly closed = new Set<string>();

  constructor(private readonly client: RemoteApiClient) {}

  async create(body: PetJobRequest, signal?: AbortSignal): Promise<PetJobCreated> {
    return (await this.client.request<PetJobCreated>('petJobCreate', { body, idempotencyKey: id(), signal })).data;
  }

  async get(jobId: string, signal?: AbortSignal): Promise<PetJobDto> {
    return (await this.client.request<PetJobDto>('petJobGet', { path: { id: jobId }, signal })).data;
  }

  async cancel(jobId: string, signal?: AbortSignal): Promise<PetJobCancelled> {
    this.closed.add(jobId);
    this.streams.cancel(jobId);
    return (await this.client.request<PetJobCancelled>('petJobCancel', { path: { id: jobId }, idempotencyKey: id(), signal })).data;
  }

  events(jobId: string, options?: StreamOptionsInput): AsyncIterable<ServiceStreamEvent> {
    ensureOpen(this.closed, jobId, '生成任务');
    const streamOptions = normalizeStreamOptions(options);
    return consumeServiceEvents(
      this.client,
      this.streams,
      jobId,
      '生成任务',
      operationPath('petJobEvents', { id: jobId }),
      streamOptions,
      ['response.started', 'pet_job.progress', 'pet_job.succeeded', 'pet_job.failed', 'response.cancelled', 'response.failed', 'guidance.risk', 'guidance.low_confidence'],
      ['pet_job.succeeded', 'pet_job.failed', 'response.cancelled', 'response.failed', 'guidance.risk', 'guidance.low_confidence'],
      event => ['pet_job.succeeded', 'pet_job.failed', 'response.cancelled', 'response.failed', 'guidance.risk', 'guidance.low_confidence'].includes(event.type),
      () => this.closed.add(jobId),
    );
  }

  async current(signal?: AbortSignal): Promise<PetCurrentResponse> {
    return (await this.client.request<PetCurrentResponse>('petCurrentGet', { signal })).data;
  }

  async setCurrent(body: PetCurrentRequest, ifMatch: string, signal?: AbortSignal): Promise<PetCurrentResponse> {
    return (await this.client.request<PetCurrentResponse>('petCurrentPut', { body, ifMatch, idempotencyKey: id(), signal })).data;
  }

  async updateCurrent(body: PetCurrentRequest, ifMatch: string, signal?: AbortSignal): Promise<PetCurrentResponse> {
    return this.setCurrent(body, ifMatch, signal);
  }
}

export class RemoteGuidance {
  private readonly streams = new RemoteStreamRegistry();
  private readonly closed = new Set<string>();
  private readonly generations = new Map<string, number>();

  constructor(private readonly client: RemoteApiClient) {}

  async create(body: GuidanceCreateRequest, signal?: AbortSignal): Promise<GuidanceCreateResponse> {
    const result = await this.client.request<GuidanceCreateResponse>('guidanceCreate', { body, idempotencyKey: id(), signal });
    this.closed.delete(result.data.guide_id);
    this.generations.delete(result.data.guide_id);
    return result.data;
  }

  async analyze(guideId: string, body: GuidanceAnalyzeRequest, signal?: AbortSignal): Promise<RequestAccepted> {
    ensureOpen(this.closed, guideId, '教学浮层');
    const result = await this.client.request<RequestAccepted>('guidanceAnalyze', { path: { id: guideId }, body, idempotencyKey: id(), signal });
    this.generations.set(guideId, body.frame_context.generation);
    return result.data;
  }

  async verify(guideId: string, body: GuidanceVerifyRequest, signal?: AbortSignal): Promise<GuidanceVerifyResponse> {
    ensureOpen(this.closed, guideId, '教学浮层');
    const result = await this.client.request<GuidanceVerifyResponse>('guidanceVerify', { path: { id: guideId }, body, idempotencyKey: id(), signal });
    this.generations.set(guideId, body.new_frame_context.generation);
    return result.data;
  }

  async stop(guideId: string, signal?: AbortSignal): Promise<EndedResponse> {
    this.closed.add(guideId);
    this.generations.delete(guideId);
    this.streams.cancel(guideId);
    return (await this.client.request<EndedResponse>('guidanceStop', { path: { id: guideId }, idempotencyKey: id(), signal })).data;
  }

  async cancel(guideId: string, signal?: AbortSignal): Promise<EndedResponse> {
    return this.stop(guideId, signal);
  }

  events(guideId: string, options?: StreamOptionsInput): AsyncIterable<ServiceStreamEvent> {
    ensureOpen(this.closed, guideId, '教学浮层');
    const streamOptions = normalizeStreamOptions(options);
    return consumeServiceEvents(
      this.client,
      this.streams,
      guideId,
      '教学浮层',
      operationPath('guidanceEvents', { id: guideId }),
      { ...streamOptions, generation: streamOptions.generation ?? this.generations.get(guideId) },
      ['response.started', 'guidance.step', 'guidance.risk', 'guidance.low_confidence', 'guidance.completed', 'response.cancelled', 'response.failed'],
      ['guidance.risk', 'guidance.low_confidence', 'guidance.completed', 'response.cancelled', 'response.failed'],
      event => ['guidance.risk', 'guidance.low_confidence', 'guidance.completed', 'response.cancelled', 'response.failed'].includes(event.type),
      () => this.closed.add(guideId),
    );
  }
}

export type RemoteAssistSignalSource = AsyncIterable<unknown>;

export class RemoteAssist {
  private readonly streams = new RemoteStreamRegistry();
  private readonly closed = new Set<string>();
  private readonly grantRevisions = new Map<string, number>();

  constructor(private readonly client: RemoteApiClient) {}

  async create(body: AssistRequest, signal?: AbortSignal): Promise<AssistCreated> {
    return (await this.client.request<AssistCreated>('assistCreate', { body, idempotencyKey: id(), signal })).data;
  }

  async accept(assistId: string, signal?: AbortSignal): Promise<AssistStateResponse> {
    ensureOpen(this.closed, assistId, '亲情协助');
    return (await this.client.request<AssistStateResponse>('assistAccept', { path: { id: assistId }, idempotencyKey: id(), signal })).data;
  }

  async join(assistId: string, body: AssistJoinRequest, signal?: AbortSignal): Promise<AssistJoinResponse> {
    ensureOpen(this.closed, assistId, '亲情协助');
    const result = await this.client.request<AssistJoinResponse>('assistJoin', { path: { id: assistId }, body, idempotencyKey: id(), signal });
    this.grantRevisions.set(assistId, body.grant_revision);
    return result.data;
  }

  async end(assistId: string, reason: AssistEndRequest['reason'], signal?: AbortSignal): Promise<{ state: 'ended' }> {
    this.closed.add(assistId);
    this.grantRevisions.delete(assistId);
    this.streams.cancel(assistId);
    return (await this.client.request<{ state: 'ended' }>('assistEnd', { path: { id: assistId }, body: { reason }, idempotencyKey: id(), signal })).data;
  }

  signals(assistId: string, source: RemoteAssistSignalSource, options: RemoteAssistSignalOptions = {}): AsyncIterable<AssistSignal> {
    ensureOpen(this.closed, assistId, '亲情协助');
    return this.consumeSignals(assistId, source, { ...options, grantRevision: options.grantRevision ?? this.grantRevisions.get(assistId) });
  }

  events(assistId: string, source: RemoteAssistSignalSource, options: RemoteAssistSignalOptions = {}): AsyncIterable<AssistSignal> {
    return this.signals(assistId, source, options);
  }

  private async *consumeSignals(assistId: string, source: RemoteAssistSignalSource, options: RemoteAssistSignalOptions): AsyncIterable<AssistSignal> {
    const active = this.streams.begin(assistId, options.signal);
    const map = assistSignalMapper({ assistId, requestId: options.requestId, sessionId: options.sessionId, generation: options.generation, grantRevision: options.grantRevision });
    let ended = false;
    try {
      for await (const raw of source) {
        if (active.controller.signal.aborted) throw new DOMException('协助信令已取消', 'AbortError');
        if (!this.streams.isCurrent(assistId, active.generation)) throw staleFailure('协助信令');
        const event = map(raw);
        ended = event.type === 'risk.pause' || event.type === 'consent.revoked' || event.type === 'end';
        if (ended) {
          this.closed.add(assistId);
          this.grantRevisions.delete(assistId);
          this.streams.close(assistId, active.generation);
        }
        yield event;
        if (ended) return;
      }
      if (!this.streams.isCurrent(assistId, active.generation)) throw staleFailure('协助信令');
      if (!ended) throw new ApiClientError('STREAM_INTERRUPTED', '协助信令连接中断，未收到结束信令。', true);
    } catch (error) {
      if (!this.streams.isCurrent(assistId, active.generation) && !(error instanceof DOMException && error.name === 'AbortError')) throw staleFailure('协助信令');
      if (error instanceof ApiClientError || error instanceof ServiceFailure || error instanceof DOMException) throw error;
      throw new ApiClientError('NETWORK_OFFLINE', '协助信令连接中断。', true, undefined, error, 'connection');
    } finally {
      this.streams.close(assistId, active.generation);
      active.detach();
    }
  }
}

export { RemotePetJobs as RemotePetJobAdapter, RemoteGuidance as RemoteGuidanceAdapter, RemoteAssist as RemoteAssistAdapter };
