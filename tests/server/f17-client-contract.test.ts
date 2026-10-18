import { afterEach, describe, expect, it } from 'vitest';
import { RemoteApiClient } from '../../packages/api-client/src';
import { InMemorySyncStore, NoteService, SyncService, TodoService } from '../../packages/sync-engine/src/index';
import { signDeviceChallenge } from '../../apps/server/src/auth';
import { createApplication, type ServerApplication } from '../../apps/server/src/http';

const applications: ServerApplication[] = [];

async function setup() {
  const store = new InMemorySyncStore();
  const application = createApplication({ modules: { sync: { service: new SyncService(store), notes: new NoteService(store), todos: new TodoService(store) } } });
  applications.push(application);
  const ownerId = crypto.randomUUID();
  const device = application.auth.bindDevice({ account_id: application.auth.createAccount({ account_id: ownerId }).account_id, device_id: crypto.randomUUID(), device_secret: 'f17-synthetic-device-secret' });
  const challenge = application.auth.issueDeviceChallenge(device.device_id);
  const token = application.auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge)).session.access_token;
  await new Promise<void>(resolve => application.server.listen(0, '127.0.0.1', resolve));
  const address = application.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing loopback address');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { application, ownerId, baseUrl, client: new RemoteApiClient({ baseUrl, authorization: token }), token };
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map(application => new Promise<void>((resolve, reject) => {
    application.server.close(error => error ? reject(error) : resolve());
    application.server.closeAllConnections();
  })));
});

describe('F17 actual client/server contract round trips on loopback', () => {
  it('creates and updates a note using strong ETags, rejecting stale writes', async () => {
    const { client } = await setup();
    const created = await client.request<{ note: { note_id: string }; version: number }>('noteCreate', { body: { asked_at: '2026-10-17T01:00:00.000Z', question: '如何调大字体？', topic: '字体', answer_summary: '从系统设置查看文字大小。', source_session_id: null }, idempotencyKey: crypto.randomUUID() });
    const updated = await client.request<{ version: number }>('noteUpdate', { path: { id: created.data.note.note_id }, body: { mastery: 'mastered', mastery_source: 'self' }, ifMatch: '"1"', idempotencyKey: crypto.randomUUID() });
    expect(updated).toMatchObject({ data: { version: 2 }, etag: '"2"' });
    await expect(client.request('noteUpdate', { path: { id: created.data.note.note_id }, body: { answer_summary: 'stale' }, ifMatch: '"1"', idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    const deleted = await client.request('noteDelete', { path: { id: created.data.note.note_id }, ifMatch: '"2"', idempotencyKey: crypto.randomUUID() });
    expect(deleted.etag).toBe('"3"');
  });

  it('updates and cancels a reminder through the real contract client', async () => {
    const { client } = await setup();
    const created = await client.request<{ todo: { todo_id: string } }>('todoCreate', { body: { title: '复习', note_id: null, timezone: 'Asia/Shanghai', remind_at: '2026-10-19T01:00:00.000Z', repeat_rule: { frequency: 'none', interval: 1 }, time_confirmed: true }, idempotencyKey: crypto.randomUUID() });
    const updated = await client.request<{ version: number }>('todoUpdate', { path: { id: created.data.todo.todo_id }, body: { patch: { title: '复习字体设置' } }, ifMatch: '"1"', idempotencyKey: crypto.randomUUID() });
    expect(updated).toMatchObject({ data: { version: 2 }, etag: '"2"' });
    const cancelled = await client.request('todoDelete', { path: { id: created.data.todo.todo_id }, ifMatch: '"2"', idempotencyKey: crypto.randomUUID() });
    expect(cancelled).toMatchObject({ data: { cancelled: true }, etag: '"3"' });
  });

  it.each(['1', 'W/"1"', '"0"', '"9007199254740992"'])('rejects non-strong or unsafe If-Match %s without mutation', async ifMatch => {
    const { baseUrl, token } = await setup();
    const response = await fetch(baseUrl + '/v1/notes/' + crypto.randomUUID(), { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'if-match': ifMatch }, body: JSON.stringify({ answer_summary: 'unchanged' }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });
});
