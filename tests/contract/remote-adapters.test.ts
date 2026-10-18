import { describe, expect, it } from 'vitest';
import type { FetchTransport } from '../../packages/api-client/src';
import { RemoteApiClient, RemoteRepository, RemoteViews } from '../../packages/api-client/src';
import type { Note } from '@nuanban/domain';
import { fixture } from './fixtures';

const ownerId = '00000000-0000-4000-8000-000000000111';
const requestId = '00000000-0000-4000-8000-000000000101';

function success<T>(id: string, data: T, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ data, request_id: id, schema_version: '0.2.0' }), { status, headers });
}

function serverTransport(calls: Array<{ path: string; init: RequestInit }>): FetchTransport {
  return async (url, init) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, init: init! });
    const id = new Headers(init?.headers).get('X-Request-ID')!;
    if (path === '/v1/me') {
      const data = fixture('MeResponse') as any;
      data.user.user_id = ownerId;
      data.user.version = 3;
      return success(id, data);
    }
    if (path === '/v1/notes') return success(id, { ...fixture('NotePage'), next_cursor: null });
    if (path === '/v1/todos') return success(id, { ...fixture('TodoPage'), next_cursor: null });
    if (path === '/v1/relations') return success(id, { ...fixture('RelationPage'), next_cursor: null });
    if (path === '/v1/me/preferences') return success(id, { ...fixture('PreferencesResponse'), version: 4 }, 200, { ETag: '"4"' });
    if (path.includes('/reminders/')) return success(id, { accepted: true });
    if (path.includes('/conversations/') && path.endsWith('/messages')) return success(id, fixture('ConversationMessagePage'));
    if (path === '/v1/sync/mutations') {
      const body = JSON.parse(String(init?.body)) as { mutations: Array<{ mutation_id: string }> };
      return success(id, { results: body.mutations.map(mutation => ({ mutation_id: mutation.mutation_id, status: 'acked', version: 1, conflict: null, error_code: null })) });
    }
    return success(id, fixture('SyncChangesResponse'));
  };
}

describe('远端 Repository 与业务视图边界', () => {
  it('真实模式只通过契约端点加载资料，并以幂等同步提交本地 outbox', async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const client = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: serverTransport(calls) });
    const repository = new RemoteRepository(client, { createId: () => requestId });
    const snapshot = await repository.load(ownerId);
    expect(snapshot.initialized).toBe(true);
    expect(snapshot.notes).toEqual([]);
    expect(calls.map(call => call.path).sort()).toEqual(['/v1/me', '/v1/notes', '/v1/relations', '/v1/todos']);

    const note: Note = { id: '00000000-0000-4000-8000-000000000112', ownerId, question: '如何设置提醒？', topic: '提醒', summary: '设置一个明确时间。', mastery: 'unmastered', masterySource: null, reviewedAt: null, source: 'conversation', createdAt: '2026-10-17T08:00:00.000Z', updatedAt: '2026-10-17T08:00:00.000Z', version: 1, deletedAt: null };
    snapshot.notes.push(note);
    snapshot.preferences = { ...snapshot.preferences, fontScale: 1.1 };
    snapshot.outbox.push({ id: 'outbox-remote-1', ownerId, entityId: note.id, entityType: 'note', version: 1, status: 'pending', createdAt: note.createdAt });
    await repository.commit(ownerId, snapshot);
    await repository.commit(ownerId, snapshot);
    expect(calls.filter(call => call.path === '/v1/sync/mutations')).toHaveLength(1);
    const preferenceCall = calls.find(call => call.path === '/v1/me/preferences')!;
    expect(new Headers(preferenceCall.init.headers).get('If-Match')).toBe('"3"');
    expect(new Headers(preferenceCall.init.headers).get('Idempotency-Key')).toBe(requestId);
  });

  it('视图边界覆盖 notes/todos/sync/reminders/family/conversation，且不把权限扩大为本地 scope', async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const client = new RemoteApiClient({ baseUrl: 'https://api.example.test', createId: () => requestId, transport: serverTransport(calls) });
    const views = new RemoteViews(client);
    await expect(views.notes()).resolves.toMatchObject({ items: [] });
    await expect(views.todos()).resolves.toMatchObject({ items: [] });
    await expect(views.changes(undefined)).resolves.toHaveProperty('changes');
    await expect(views.family()).resolves.toEqual([]);
    await views.reminderReceipt('00000000-0000-4000-8000-000000000113', { device_id: '00000000-0000-4000-8000-000000000114', channel: 'local', state: 'submitted' });
    await views.conversation('00000000-0000-4000-8000-000000000115');
    expect(calls.some(call => call.path === '/v1/reminders/00000000-0000-4000-8000-000000000113/receipts')).toBe(true);
    expect(calls.every(call => !String(call.init.body ?? '').includes('granted'))).toBe(true);
  });
});
