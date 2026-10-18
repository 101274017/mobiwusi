import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApplication } from '../../apps/server/src/http.ts';
import { signDeviceChallenge } from '../../apps/server/src/auth.ts';
import { InMemorySyncStore, SyncService, TodoService } from '../../packages/sync-engine/src/index.ts';

const applications: ReturnType<typeof createApplication>[] = [];

async function start(options: Parameters<typeof createApplication>[0] = {}) {
  const application = createApplication(options);
  applications.push(application);
  await new Promise<void>(resolve => application.server.listen(0, '127.0.0.1', resolve));
  const address = application.server.address() as AddressInfo;
  return { application, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function post(baseUrl: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(baseUrl + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

async function login(baseUrl: string, deviceId: string, deviceSecret: string): Promise<string> {
  const challengeResponse = await post(baseUrl, '/v1/auth/device-challenges', { binding_id: deviceId });
  const challengeEnvelope = await challengeResponse.json() as { data: { challenge_id: string; challenge: string } };
  expect(challengeResponse.status).toBe(201);
  const exchangeResponse = await post(baseUrl, '/v1/auth/device-exchange', {
    challenge_id: challengeEnvelope.data.challenge_id,
    signature: signDeviceChallenge(deviceSecret, challengeEnvelope.data.challenge),
  });
  const exchangeEnvelope = await exchangeResponse.json() as { data: { session: { access_token: string } } };
  expect(exchangeResponse.status).toBe(201);
  return exchangeEnvelope.data.session.access_token;
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map(({ server }) => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe('HTTP server', () => {
  it('serves health with contract envelope and propagates a validated request id', async () => {
    const { baseUrl } = await start();
    const response = await fetch(baseUrl + '/healthz', { headers: { 'x-request-id': 'health-check-1' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('health-check-1');
    expect(await response.json()).toEqual({ data: { status: 'ok', service: 'nuanban-server', storage: 'memory' }, request_id: 'health-check-1', schema_version: '0.2.0' });
  });

  it('returns the unified error envelope for malformed JSON and unknown routes', async () => {
    const { baseUrl } = await start();
    const badJson = await fetch(baseUrl + '/v1/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toMatchObject({ error: { code: 'INVALID_REQUEST', retryable: false }, request_id: expect.any(String), schema_version: '0.2.0' });
    const unknown = await fetch(baseUrl + '/v1/not-implemented');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' }, schema_version: '0.2.0' });
    const unauthenticated = await fetch(baseUrl + '/v1/relations', { headers: { 'x-request-id': 'auth-required-1' } });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get('x-request-id')).toBe('auth-required-1');
    expect(await unauthenticated.json()).toMatchObject({ error: { code: 'AUTH_FAILED', retryable: false }, request_id: 'auth-required-1', schema_version: '0.2.0' });
  });

  it('supports a device challenge exchange and refresh over HTTP', async () => {
    const { application, baseUrl } = await start();
    const account = application.auth.createAccount({ account_id: 'http-account' });
    const device = application.auth.bindDevice({ account_id: account.account_id, device_id: 'http-device', device_secret: 'synthetic-http-test-secret' });
    const challengeResponse = await post(baseUrl, '/v1/auth/device-challenges', { binding_id: device.device_id });
    const challengeEnvelope = await challengeResponse.json() as { data: { challenge_id: string; challenge: string } };
    const exchangeResponse = await post(baseUrl, '/v1/auth/device-exchange', { challenge_id: challengeEnvelope.data.challenge_id, signature: signDeviceChallenge(device.device_secret, challengeEnvelope.data.challenge) });
    const exchangeEnvelope = await exchangeResponse.json() as { data: { session: { refresh_token: string } } };
    const refreshResponse = await post(baseUrl, '/v1/auth/refresh', { refresh_token: exchangeEnvelope.data.session.refresh_token });
    expect(challengeResponse.status).toBe(201);
    expect(exchangeResponse.status).toBe(201);
    expect(refreshResponse.status).toBe(201);
    expect(await refreshResponse.json()).toMatchObject({ data: { session: { account_id: 'http-account' } }, schema_version: '0.2.0' });
  });

  it('serves relation and consent routes with authenticated contract statuses', async () => {
    const { application, baseUrl } = await start();
    const subject = application.auth.createAccount({ account_id: 'http-subject' });
    const helper = application.auth.createAccount({ account_id: 'http-helper' });
    const subjectDevice = application.auth.bindDevice({ account_id: subject.account_id, device_id: 'http-subject-device', device_secret: 'subject-http-secret' });
    const helperDevice = application.auth.bindDevice({ account_id: helper.account_id, device_id: 'http-helper-device', device_secret: 'helper-http-secret' });
    const subjectToken = await login(baseUrl, subjectDevice.device_id, subjectDevice.device_secret);
    const helperToken = await login(baseUrl, helperDevice.device_id, helperDevice.device_secret);
    const subjectHeaders = { authorization: `Bearer ${subjectToken}` };
    const helperHeaders = { authorization: `Bearer ${helperToken}` };
    const scopes = ['learning.read', 'todo.write'];

    const consentResponse = await post(baseUrl, '/v1/consents', {
      purpose: 'learning_share',
      scopes,
      notice_version: 'v1',
      subject_id: subject.account_id,
    }, subjectHeaders);
    const consentEnvelope = await consentResponse.json() as { data: { consent_id: string } };
    expect(consentResponse.status).toBe(201);

    const invitationResponse = await post(baseUrl, '/v1/relations/invitations', {
      helper_ref: helper.account_id,
      requested_scopes: scopes,
    }, subjectHeaders);
    const invitationEnvelope = await invitationResponse.json() as { data: { invitation_id: string } };
    expect(invitationResponse.status).toBe(201);

    const acceptResponse = await post(baseUrl, `/v1/relations/${invitationEnvelope.data.invitation_id}/accept`, {
      consent_id: consentEnvelope.data.consent_id,
      scopes,
    }, helperHeaders);
    const acceptEnvelope = await acceptResponse.json() as { data: { relation: { relation_id: string } } };
    expect(acceptResponse.status).toBe(201);

    const listResponse = await fetch(baseUrl + '/v1/relations', { headers: helperHeaders });
    const listEnvelope = await listResponse.json() as { data: { items: Array<{ relation_id: string }> } };
    expect(listResponse.status).toBe(200);
    expect(listEnvelope.data.items.map(item => item.relation_id)).toContain(acceptEnvelope.data.relation.relation_id);

    const grantsResponse = await fetch(baseUrl + `/v1/relations/${acceptEnvelope.data.relation.relation_id}/grants`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': '"1"', ...subjectHeaders },
      body: JSON.stringify({ scopes: ['learning.read'], consent_id: consentEnvelope.data.consent_id }),
    });
    expect(grantsResponse.status).toBe(200);
    expect(await grantsResponse.json()).toMatchObject({ data: { grant_revision: 2 }, schema_version: '0.2.0' });

    const revokeResponse = await fetch(baseUrl + `/v1/relations/${acceptEnvelope.data.relation.relation_id}`, { method: 'DELETE', headers: helperHeaders });
    expect(revokeResponse.status).toBe(200);
    expect(await revokeResponse.json()).toMatchObject({ data: { revoked_at: expect.any(String) }, schema_version: '0.2.0' });

    const withdrawResponse = await post(baseUrl, `/v1/consents/${consentEnvelope.data.consent_id}/withdraw`, {}, subjectHeaders);
    expect(withdrawResponse.status).toBe(201);
    expect(await withdrawResponse.json()).toMatchObject({ data: { withdrawn_at: expect.any(String) }, schema_version: '0.2.0' });

    const revokeDeviceResponse = await fetch(baseUrl + `/v1/devices/${helperDevice.device_id}`, { method: 'DELETE', headers: helperHeaders });
    expect(revokeDeviceResponse.status).toBe(200);
    expect(await revokeDeviceResponse.json()).toMatchObject({ data: { revoked: true }, schema_version: '0.2.0' });
  });

  it('exposes request, actor, extension, and response hooks without replacing core auth', async () => {
    const events: string[] = [];
    const { application, baseUrl } = await start({
      hooks: {
        onRequest: context => {
          context.extensions.trace = 'http-test';
          events.push(`request:${context.method}:${context.path.join('/')}`);
        },
        resolveActor: context => {
          events.push(`actor:${context.bearerToken.startsWith('nb_access_')}`);
          return context.authenticate();
        },
        onRoute: context => context.path.join('/') === 'v1/extensions/ping'
          ? { status: 202, data: { extension: 'handled' } }
          : undefined,
        onResponse: context => {
          events.push(`response:${context.status}:${context.extensions.trace ?? 'missing'}`);
        },
      },
    });
    const account = application.auth.createAccount({ account_id: 'hook-account' });
    const device = application.auth.bindDevice({ account_id: account.account_id, device_id: 'hook-device', device_secret: 'hook-secret' });
    const accessToken = await login(baseUrl, device.device_id, device.device_secret);
    const response = await fetch(baseUrl + '/v1/relations', { headers: { authorization: `Bearer ${accessToken}` } });
    expect(response.status).toBe(200);
    const extensionResponse = await fetch(baseUrl + '/v1/extensions/ping');
    expect(extensionResponse.status).toBe(202);
    expect(await extensionResponse.json()).toMatchObject({ data: { extension: 'handled' }, schema_version: '0.2.0' });
    expect(events).toContain('actor:true');
    expect(events).toContain('response:200:http-test');
    expect(events).toContain('response:202:http-test');
    expect(events.some(event => event === 'request:GET:v1/relations')).toBe(true);
  });

  it('maps todo patch fields through the HTTP contract before updating the sync service', async () => {
    const store = new InMemorySyncStore();
    const { application, baseUrl } = await start({ modules: { sync: { service: new SyncService(store), todos: new TodoService(store) } } });
    const account = application.auth.createAccount({ account_id: 'todo-http-account' });
    const device = application.auth.bindDevice({ account_id: account.account_id, device_id: 'todo-http-device', device_secret: 'todo-http-secret' });
    const accessToken = await login(baseUrl, device.device_id, device.device_secret);
    const headers = { authorization: `Bearer ${accessToken}` };
    const createResponse = await post(baseUrl, '/v1/todos', {
      title: '初始提醒',
      note_id: null,
      timezone: 'Asia/Shanghai',
      remind_at: '2026-10-18T09:00:00.000Z',
      repeat_rule: { frequency: 'none', interval: 1 },
      time_confirmed: true,
    }, headers);
    const created = await createResponse.json() as { data: { todo: { todo_id: string; version: number } } };
    expect(createResponse.status).toBe(201);
    const updateResponse = await fetch(baseUrl + `/v1/todos/${created.data.todo.todo_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': `"${created.data.todo.version}"`, ...headers },
      body: JSON.stringify({ patch: { remind_at: '2026-10-19T09:00:00.000Z', timezone: 'Asia/Shanghai', time_confirmed: true } }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({ data: { todo: { remind_at: '2026-10-19T09:00:00.000Z', timezone: 'Asia/Shanghai', version: 2 } }, schema_version: '0.2.0' });
  });
});

