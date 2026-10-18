import { ServiceFailure, type ConversationPort } from '@nuanban/application';
import type { AssistSignal, ConversationEvent, ServiceErrorEnvelope, ServiceStreamEvent } from '@nuanban/contracts';
import { contractVersion, operations } from '@nuanban/contracts';
import { contractValidator } from '../../contracts/src/validation';
import { conversationEventMapper } from './mappers';
import { ApiClientError, type ApiClientErrorKind } from './errors';
export { ApiClientError, type ApiClientErrorKind } from './errors';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoff?: (attempt: number) => number;
  wait: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export type FetchTransport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type RemoteStreamSchema = 'ServiceStreamEvent' | 'AssistSignal';

export interface ApiClientOptions {
  baseUrl: string;
  authorization?: string | (() => string | undefined);
  fetch?: FetchTransport;
  transport?: FetchTransport;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy>;
  createId?: () => string;
}

export interface ApiRequestOptions {
  path?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  requestId?: string;
  idempotencyKey?: string;
  ifMatch?: string;
  headers?: HeadersInit;
}

export interface ApiResult<T> {
  data: T;
  requestId: string;
  etag: string | null;
}

const defaultWait: RetryPolicy['wait'] = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new DOMException('请求已取消', 'AbortError')); return; }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, milliseconds);
  const abort = () => { clearTimeout(timer); reject(new DOMException('请求已取消', 'AbortError')); };
  signal?.addEventListener('abort', abort, { once: true });
});

const defaultRetry: RetryPolicy = { maxAttempts: 1, baseDelayMs: 250, maxDelayMs: 4000, wait: defaultWait };
const strongEtag = /^"[1-9][0-9]*"$/;

function requestId(): string {
  if (!globalThis.crypto?.randomUUID) throw new ApiClientError('NETWORK_OFFLINE', '当前环境无法生成安全请求编号。');
  return globalThis.crypto.randomUUID();
}

function validateEnvelope<T>(operationId: string, expectedRequestId: string, payload: unknown): T {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !('request_id' in payload) || !('schema_version' in payload)) {
    throw new ApiClientError('STREAM_INTERRUPTED', '服务成功响应包络无效。', false, expectedRequestId);
  }
  const envelope = payload as { data: unknown; request_id: unknown; schema_version: unknown };
  const operation = operations.find(item => item.id === operationId);
  if (!operation?.response || envelope.request_id !== expectedRequestId || envelope.schema_version !== contractVersion || !contractValidator(operation.response)(envelope.data)) {
    throw new ApiClientError('STREAM_INTERRUPTED', '服务响应与请求或数据契约不匹配。', false, expectedRequestId);
  }
  return envelope.data as T;
}

function parseServiceError(payload: unknown, expectedRequestId: string): ServiceErrorEnvelope {
  if (!contractValidator('ErrorEnvelope')(payload)) throw new ApiClientError('STREAM_INTERRUPTED', '服务错误响应包络无效。', false, expectedRequestId);
  const envelope = payload as ServiceErrorEnvelope;
  if (envelope.request_id !== expectedRequestId) throw new ApiClientError('STREAM_INTERRUPTED', '服务错误响应 request_id 不匹配。', false, expectedRequestId);
  return envelope;
}

function abortFailure(signal: AbortSignal | undefined, timedOut: boolean, expectedRequestId: string): ApiClientError | DOMException {
  return timedOut
    ? new ApiClientError('TIMEOUT', '服务请求超时。', true, expectedRequestId, undefined, 'timeout')
    : new DOMException(signal?.reason instanceof Error ? signal.reason.message : '服务请求已取消。', 'AbortError');
}

export class RemoteApiClient {
  private readonly baseUrl: URL;
  private readonly transport: FetchTransport;
  private readonly timeoutMs: number;
  private readonly retry: RetryPolicy;
  private readonly createId: () => string;

  constructor(private readonly options: ApiClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    if (this.baseUrl.username || this.baseUrl.password || this.baseUrl.search || this.baseUrl.hash) throw new TypeError('API base URL 不得包含凭证、查询参数或片段。');
    this.baseUrl.pathname = this.baseUrl.pathname.replace(/\/?$/, '/');
    this.transport = options.transport ?? options.fetch ?? globalThis.fetch;
    if (!this.transport) throw new TypeError('当前环境没有可用 fetch transport。');
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.retry = { ...defaultRetry, ...options.retry };
    this.createId = options.createId ?? requestId;
    if (!Number.isSafeInteger(this.retry.maxAttempts) || this.retry.maxAttempts < 1 || !Number.isFinite(this.retry.baseDelayMs) || this.retry.baseDelayMs < 0 || !Number.isFinite(this.retry.maxDelayMs) || this.retry.maxDelayMs < 0) throw new TypeError('重试策略无效。');
  }

  async request<T = unknown>(operationId: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
    const operation = operations.find(item => item.id === operationId);
    if (!operation) throw new TypeError(`未知服务操作：${operationId}`);
    if (operation.stream || operation.binary) throw new TypeError(`操作 ${operationId} 需要专用传输方法。`);
    if (operation.request && !contractValidator(operation.request)(options.body)) throw new ApiClientError('INVALID_REQUEST', '请求数据不符合服务契约。');
    if (!operation.request && options.body !== undefined) throw new ApiClientError('INVALID_REQUEST', '此操作不接受请求体。');
    if (operation.method !== 'get' && !options.idempotencyKey) throw new ApiClientError('INVALID_REQUEST', '写入请求必须提供 Idempotency-Key。');
    if (operation.versioned && (!options.ifMatch || !strongEtag.test(options.ifMatch))) throw new ApiClientError('INVALID_REQUEST', '版本化写入必须提供强版本 If-Match。');

    const id = options.requestId ?? this.createId();
    const url = this.makeUrl(operation.path, options.path, options.query);
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Request-ID', id);
    const token = typeof this.options.authorization === 'function' ? this.options.authorization() : this.options.authorization;
    if (token) headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
    if (operation.versioned) headers.set('If-Match', options.ifMatch!);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');

    let attempt = 0;
    while (true) {
      attempt++;
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method: operation.method.toUpperCase(), headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: options.signal,
        }, id);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        const failure = error instanceof ApiClientError ? error : new ApiClientError('NETWORK_OFFLINE', '无法连接服务，请检查网络后重试。', true, id, error, 'connection');
        if (this.canRetry(options.idempotencyKey, attempt, failure.retryable)) {
          await this.retry.wait(this.delayFor(attempt), options.signal);
          continue;
        }
        throw failure;
      }

      if (!response.ok) {
        let envelope: ServiceErrorEnvelope;
        try { envelope = parseServiceError(await response.json(), id); }
        catch (error) { if (error instanceof ApiClientError) throw error; throw new ApiClientError('STREAM_INTERRUPTED', '服务错误响应无法读取。', false, id, error); }
        const failure = new ApiClientError(envelope.error.code, envelope.error.message, envelope.error.retryable, id);
        if (this.canRetry(options.idempotencyKey, attempt, failure.retryable)) {
          await this.retry.wait(this.delayFor(attempt), options.signal);
          continue;
        }
        throw failure;
      }

      if (response.status !== operation.successStatus) throw new ApiClientError('STREAM_INTERRUPTED', '服务成功状态码与契约不一致。', false, id, undefined, 'protocol');

      if (response.status === 204) {
        if (operation.response) throw new ApiClientError('STREAM_INTERRUPTED', '服务缺少契约要求的成功数据。', false, id);
        return { data: undefined as T, requestId: id, etag: response.headers.get('ETag') };
      }
      let payload: unknown;
      try { payload = await response.json(); }
      catch (error) { throw new ApiClientError('STREAM_INTERRUPTED', '服务成功响应不是有效 JSON。', false, id, error); }
      const data = validateEnvelope<T>(operationId, id, payload);
      const etag = response.headers.get('ETag');
      if (operation.versioned && !etag) throw new ApiClientError('STREAM_INTERRUPTED', '版本化写入响应缺少 ETag。', false, id);
      return { data, requestId: id, etag };
    }
  }

  createRequestId(): string { return this.createId(); }

  async *streamEvents<T extends ServiceStreamEvent | AssistSignal = ServiceStreamEvent>(path: string, requestIdValue: string, signal: AbortSignal, schema: RemoteStreamSchema = 'ServiceStreamEvent'): AsyncIterable<T> {
    if (!path.startsWith('/v1/') || path.includes('://')) throw new ApiClientError('INVALID_REQUEST', '事件流地址必须是服务契约内的相对路径。', false, requestIdValue);
    const url = this.makeUrl(path, undefined, undefined);
    const headers = new Headers({ Accept: 'text/event-stream', 'X-Request-ID': requestIdValue });
    const token = typeof this.options.authorization === 'function' ? this.options.authorization() : this.options.authorization;
    if (token) headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
    const response = await this.fetchWithTimeout(url, { method: 'GET', headers, signal }, requestIdValue);
    if (!response.ok) {
      let envelope: ServiceErrorEnvelope;
      try { envelope = parseServiceError(await response.json(), requestIdValue); }
      catch (error) { if (error instanceof ApiClientError) throw error; throw new ApiClientError('STREAM_INTERRUPTED', '事件流错误响应无法读取。', false, requestIdValue, error); }
      throw new ApiClientError(envelope.error.code, envelope.error.message, envelope.error.retryable, requestIdValue);
    }
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('text/event-stream') || !response.body) throw new ApiClientError('STREAM_INTERRUPTED', '服务没有返回有效事件流。', true, requestIdValue);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        if (signal.aborted) throw abortFailure(signal, false, requestIdValue);
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let boundary: number;
        while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
          const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (!data) continue;
          let parsed: unknown;
          try { parsed = JSON.parse(data); }
          catch (error) { throw new ApiClientError('STREAM_INTERRUPTED', '事件流包含无效 JSON。', true, requestIdValue, error); }
          if (!contractValidator(schema)(parsed)) throw new ApiClientError('STREAM_INTERRUPTED', '事件流数据不符合服务契约。', true, requestIdValue);
          yield parsed as T;
        }
        if (done) break;
      }
      if (buffer.trim()) throw new ApiClientError('STREAM_INTERRUPTED', '事件流在完整事件边界前结束。', true, requestIdValue);
    } catch (error) {
      if (signal.aborted) throw abortFailure(signal, false, requestIdValue);
      if (error instanceof ApiClientError || error instanceof ServiceFailure) throw error;
      throw new ApiClientError('NETWORK_OFFLINE', '事件流连接中断。', true, requestIdValue, error);
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  private makeUrl(path: string, parameters?: Record<string, string>, query?: ApiRequestOptions['query']): URL {
    const expanded = path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const value = parameters?.[key];
      if (!value) throw new ApiClientError('INVALID_REQUEST', `缺少路径参数：${key}`);
      return encodeURIComponent(value);
    });
    if (/[{}]/.test(expanded)) throw new ApiClientError('INVALID_REQUEST', '服务路径参数未完整提供。');
    const url = new URL(expanded.replace(/^\//, ''), this.baseUrl);
    if (query) for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    return url;
  }

  private async fetchWithTimeout(url: URL, init: RequestInit, id: string): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = init.signal ?? undefined;
    let timedOut = false;
    const abort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', abort, { once: true });
    if (externalSignal?.aborted) abort();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    try {
      return await this.transport(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw abortFailure(externalSignal, timedOut, id);
      throw new ApiClientError('NETWORK_OFFLINE', '无法连接服务，请检查网络后重试。', true, id, error, 'connection');
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abort);
    }
  }

  private canRetry(idempotencyKey: string | undefined, attempt: number, retryable: boolean): boolean {
    return Boolean(idempotencyKey) && retryable && attempt < this.retry.maxAttempts;
  }

  private delayFor(attempt: number): number {
    const delay = this.retry.backoff?.(attempt) ?? this.retry.baseDelayMs * 2 ** (attempt - 1);
    if (!Number.isFinite(delay) || delay < 0) throw new TypeError('重试退避函数返回了无效延迟。');
    return Math.min(this.retry.maxDelayMs, delay);
  }
}

export class RemoteConversation implements ConversationPort {
  private generation = 0;
  private activeRequestId: string | null = null;

  constructor(private readonly client: RemoteApiClient, private readonly mode: 'elder' | 'child' | 'accessible' = 'elder') {}

  stream(text: string, signal: AbortSignal): AsyncIterable<ConversationEvent> {
    const generation = ++this.generation;
    return this.consume(text, signal, generation);
  }

  async cancel(): Promise<void> {
    const requestId = this.activeRequestId;
    this.generation++;
    this.activeRequestId = null;
    if (!requestId) return;
    await this.client.request('requestCancel', { path: { id: requestId }, idempotencyKey: globalThis.crypto.randomUUID() }).catch(() => undefined);
  }

  private async *consume(text: string, signal: AbortSignal, generation: number): AsyncIterable<ConversationEvent> {
    if (signal.aborted) throw abortFailure(signal, false, '');
    if (!text.trim() || text.length > 1500) throw new ApiClientError('INVALID_REQUEST', '请填写 1～1500 字的问题。');
    const session = await this.client.request<{ session_id: string }>('conversationCreate', {
      body: { mode: this.mode }, signal, idempotencyKey: globalThis.crypto.randomUUID(),
    });
    const inputId = globalThis.crypto.randomUUID();
    const request = await this.client.request<{ request_id: string; stream_path: string }>('conversationRespond', {
      path: { id: session.data.session_id }, body: { input_id: inputId, text, generation }, signal,
      idempotencyKey: inputId,
    });
    this.activeRequestId = request.data.request_id;
    const context = { requestId: request.data.request_id, sessionId: session.data.session_id, generation };
    const map = conversationEventMapper(context);
    try {
      for await (const raw of this.client.streamEvents(request.data.stream_path, request.data.request_id, signal)) {
        if (generation !== this.generation) throw new ApiClientError('STREAM_INTERRUPTED', '已拒绝迟到的旧代际讲解事件。', true, request.data.request_id);
        yield map(raw);
      }
    } finally {
      if (this.activeRequestId === request.data.request_id) this.activeRequestId = null;
    }
  }
}
