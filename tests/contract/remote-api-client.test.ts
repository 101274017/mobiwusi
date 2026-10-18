import { describe, expect, it } from 'vitest';
import { ServiceFailure } from '@nuanban/application';
import type { ConversationEvent } from '@nuanban/contracts';
import { ApiClientError, RemoteApiClient, RemoteConversation, UnconnectedConversation } from '../../packages/api-client/src';
import { fixture } from './fixtures';

const requestId = '00000000-0000-4000-8000-000000000001';
const sessionId = '00000000-0000-4000-8000-000000000002';
const responseRequestId = '00000000-0000-4000-8000-000000000003';
const streamEventId = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

function success<T>(id: string, data: T, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify({ data, request_id: id, schema_version: '0.2.0' }), { status, headers });
}

function streamResponse(events: unknown[]): Response {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function rawEvent(type: string, seq: number, payload: unknown, generation = 1): Record<string, unknown> {
  return { request_id: responseRequestId, session_id: sessionId, event_id: streamEventId(seq + 10), seq, generation, type, payload };
}

describe('远程 API 客户端装配契约', () => {
  it('使用可替换 transport、请求头和 Envelope，不把 Authorization 放进 URL', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new RemoteApiClient({
      baseUrl: 'https://api.example.test',
      authorization: 'secret-token',
      transport: async (url, init) => { calls.push({ url: String(url), init: init! }); return success(requestId, fixture('NoteResponse'), { ETag: '"8"' }); },
      createId: () => requestId,
    });

    const result = await client.request('noteUpdate', {
      path: { id: sessionId },
      body: { mastery: 'mastered', mastery_source: 'self' },
      requestId,
      idempotencyKey: 'same-mutation-key',
      ifMatch: '"7"',
      query: { token: undefined },
    });
    const headers = new Headers(calls[0].init.headers);
    expect(result.etag).toBe('"8"');
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
    expect(headers.get('X-Request-ID')).toBe(requestId);
    expect(headers.get('Idempotency-Key')).toBe('same-mutation-key');
    expect(headers.get('If-Match')).toBe('"7"');
    expect(calls[0].url).toBe(`https://api.example.test/v1/notes/${sessionId}`);
    expect(calls[0].url).not.toContain('secret-token');
  });

  it('校验成功/失败包络、request_id 和版本化响应 ETag', async () => {
    const client = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: async () => success(requestId, {}) });
    await expect(client.request('noteList', { requestId })).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });

    const mismatch = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: async () => success(sessionId, fixture('NotePage')) });
    await expect(mismatch.request('noteList', { requestId })).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });

    const noEtag = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: async () => success(requestId, fixture('PreferencesResponse')) });
    await expect(noEtag.request('preferencesUpdate', { requestId, body: fixture('PreferencesRequest'), idempotencyKey: 'k', ifMatch: '"1"' })).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });

    const error = new ServiceFailure('PROVIDER_UNAVAILABLE', '暂不可用', true).envelope(requestId);
    const failed = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: async () => new Response(JSON.stringify(error), { status: 503 }) });
    await expect(failed.request('noteList', { requestId })).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: true });
  });

  it('只对可重试且带幂等键的请求有限重试，并复用原键和注入退避', async () => {
    const calls: string[] = [];
    const delays: number[] = [];
    let attempt = 0;
    const error = new ServiceFailure('RATE_LIMITED', '稍后重试', true).envelope(requestId);
    const client = new RemoteApiClient({
      baseUrl: 'https://api.example.test', createId: () => requestId,
      retry: { maxAttempts: 2, backoff: attemptNumber => attemptNumber * 13, wait: async milliseconds => { delays.push(milliseconds); } },
      transport: async (_url, init) => {
        calls.push(new Headers(init?.headers).get('Idempotency-Key')!);
        attempt++;
        return attempt === 1 ? new Response(JSON.stringify(error), { status: 429 }) : success(requestId, fixture('NoteResponse'), {}, 201);
      },
    });
    await client.request('noteCreate', { requestId, idempotencyKey: 'one-key', body: fixture('NoteCreateRequest') });
    expect(calls).toEqual(['one-key', 'one-key']);
    expect(delays).toEqual([13]);

    let getCalls = 0;
    const offline = new RemoteApiClient({ baseUrl: 'https://api.example.test', retry: { maxAttempts: 4, wait: async () => undefined }, transport: async () => { getCalls++; throw new TypeError('offline'); } });
    await expect(offline.request('noteList')).rejects.toMatchObject({ code: 'NETWORK_OFFLINE', kind: 'connection' });
    expect(getCalls).toBe(1);
  });

  it('区分 timeout、Abort 和 connection failure，不回退 Unconnected/Mock', async () => {
    const timeout = new RemoteApiClient({
      baseUrl: 'https://api.example.test', timeoutMs: 5, transport: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    });
    await expect(timeout.request('noteList')).rejects.toMatchObject({ code: 'TIMEOUT', kind: 'timeout' });

    const controller = new AbortController();
    const aborted = new RemoteApiClient({ baseUrl: 'https://api.example.test', transport: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }) });
    const pending = aborted.request('noteList', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });

    const unconnected = new UnconnectedConversation();
    await expect((async () => { for await (const _event of unconnected.stream('不会发送', new AbortController().signal)) { void _event; } })()).rejects.toThrow('真实 AI 服务尚未接入');
  });

  it('SSE 复用 conversationEventMapper，并拒绝迟到的旧 generation', async () => {
    let call = 0;
    const client = new RemoteApiClient({
      baseUrl: 'https://api.example.test', createId: () => requestId,
      transport: async (_url, init) => {
        call++;
        if (call === 1) return success(requestId, { session_id: sessionId }, {}, 201);
        if (call === 2) return success(requestId, { request_id: responseRequestId, stream_path: '/v1/requests/00000000-0000-4000-8000-000000000003/events' }, {}, 201);
        expect(new Headers(init?.headers).get('Accept')).toBe('text/event-stream');
        return streamResponse([
          rawEvent('response.started', 0, {}),
          rawEvent('caption.segment', 1, { segment_id: streamEventId(20), index: 0, text: '第一段' }),
          rawEvent('response.completed', 2, { final_segment_count: 1 }),
        ]);
      },
    });
    const conversation = new RemoteConversation(client);
    const events: ConversationEvent[] = [];
    for await (const event of conversation.stream('如何操作', new AbortController().signal)) events.push(event);
    expect(events).toEqual([
      { request_id: responseRequestId, sequence: 0, type: 'started' },
      { request_id: responseRequestId, sequence: 1, type: 'delta', text: '第一段' },
      { request_id: responseRequestId, sequence: 2, type: 'completed' },
    ]);

    let oldCall = 0;
    const oldClient = new RemoteApiClient({
      baseUrl: 'https://api.example.test', createId: () => requestId,
      transport: async () => {
        oldCall++;
        if (oldCall === 1) return success(requestId, { session_id: sessionId }, {}, 201);
        if (oldCall === 2) return success(requestId, { request_id: responseRequestId, stream_path: '/v1/requests/00000000-0000-4000-8000-000000000003/events' }, {}, 201);
        return streamResponse([rawEvent('response.started', 0, {}), rawEvent('caption.segment', 1, { segment_id: streamEventId(21), index: 0, text: '迟到' })]);
      },
    });
    const oldConversation = new RemoteConversation(oldClient);
    const iterator = oldConversation.stream('旧问题', new AbortController().signal)[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toEqual({ done: false, value: { request_id: responseRequestId, sequence: 0, type: 'started' } });
    oldConversation.stream('新问题', new AbortController().signal);
    await expect(iterator.next()).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });
  });

  it('拒绝成功状态码漂移、弱 If-Match 和空幂等键', async () => {
    const drift = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: async () => success(requestId, fixture('NoteResponse')) });
    await expect(drift.request('noteCreate', { requestId, body: fixture('NoteCreateRequest'), idempotencyKey: 'create-key' })).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED', kind: 'protocol' });
    const client = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: async () => success(requestId, fixture('NoteResponse'), { ETag: '7' }) });
    await expect(client.request('noteUpdate', { requestId, body: { mastery: 'mastered', mastery_source: 'self' }, idempotencyKey: 'update-key', ifMatch: '7' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(client.request('noteCreate', { requestId, body: fixture('NoteCreateRequest'), idempotencyKey: '' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('取消会使当前代际失效，并拒绝事件流中的风险状态', async () => {
    let call = 0;
    const client = new RemoteApiClient({
      baseUrl: 'https://api.example.test', createId: () => requestId,
      transport: async (_url, init) => {
        call++;
        if (call === 1) return success(requestId, { session_id: sessionId }, {}, 201);
        if (call === 2) return success(requestId, { request_id: responseRequestId, stream_path: '/v1/requests/00000000-0000-4000-8000-000000000003/events' }, {}, 201);
        if (call === 3) return streamResponse([rawEvent('response.started', 0, {}), rawEvent('guidance.risk', 1, { risk: 'transaction', action: 'stop_teaching_and_media' })]);
        if (call === 4) return success(requestId, { session_id: sessionId }, {}, 201);
        if (call === 5) return success(requestId, { request_id: responseRequestId, stream_path: '/v1/requests/00000000-0000-4000-8000-000000000003/events' }, {}, 201);
        if (call === 6) return streamResponse([rawEvent('response.started', 0, {}, 2), rawEvent('caption.segment', 1, { segment_id: streamEventId(30), index: 0, text: '迟到' }, 2)]);
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBeTruthy();
        return success(requestId, { status: 'cancelled' });
      },
    });
    const conversation = new RemoteConversation(client);
    const iterator = conversation.stream('风险测试', new AbortController().signal)[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toEqual({ done: false, value: { request_id: responseRequestId, sequence: 0, type: 'started' } });
    await expect(iterator.next()).rejects.toMatchObject({ code: 'RISK_PAUSED' });
    const second = conversation.stream('第二次', new AbortController().signal)[Symbol.asyncIterator]();
    await expect(second.next()).resolves.toEqual({ done: false, value: { request_id: responseRequestId, sequence: 0, type: 'started' } });
    await conversation.cancel();
    await expect(second.next()).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });
  });
});
