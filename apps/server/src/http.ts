import { createServer as createNodeServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { schemaVersion as contractVersion } from '../../../packages/contracts/src/spec/primitives.ts';
import type { Scope } from '@nuanban/contracts';
import { AuthService, type AuthenticatedSession, type AuthOptions, type Clock } from './auth.ts';
import { DomainError, authenticationFailed, invalidRequest } from './errors.ts';
import { FamilyService, type FamilyOptions } from './family.ts';
import { createInMemoryRepositories, type ServerRepositories } from './repositories.ts';
import { createSqliteRepositories, defaultSqlitePath } from './sqlite.ts';
import { dispatchServiceRoute, type ServerServiceModules } from './service-modules.ts';
import { readIfMatch as ifMatch } from './versioning.ts';

export type ServerStorageOptions =
  | { kind: 'memory' }
  | { kind: 'sqlite'; path?: string; environment?: string };

export interface RequestHookContext {
  requestId: string;
  method: string;
  url: string;
  path: string[];
  body: Record<string, unknown>;
  request: IncomingMessage;
  actor?: AuthenticatedSession;
  extensions: Record<string, unknown>;
}

export interface AuthActorHookContext extends RequestHookContext {
  bearerToken: string;
  authenticate: () => AuthenticatedSession;
}

export interface ResponseHookContext {
  request: IncomingMessage;
  response: ServerResponse;
  requestId: string;
  status: number;
  body: unknown;
  actor?: AuthenticatedSession;
  extensions: Record<string, unknown>;
}

export interface RouteHookContext extends RequestHookContext {
  getActor: () => Promise<AuthenticatedSession>;
  respond: (status: number, data: unknown) => Promise<void>;
}

export type RouteHookResult = void | true | { status: number; data: unknown };

export interface ServerHooks {
  onRequest?: (context: RequestHookContext) => void | Promise<void>;
  resolveActor?: (context: AuthActorHookContext) => AuthenticatedSession | Promise<AuthenticatedSession>;
  onRoute?: (context: RouteHookContext) => RouteHookResult | Promise<RouteHookResult>;
  onResponse?: (context: ResponseHookContext) => void | Promise<void>;
}

export interface ServerOptions {
  repositories?: ServerRepositories;
  storage?: ServerStorageOptions;
  clock?: Clock;
  auth?: Omit<AuthOptions, 'now'>;
  family?: Omit<FamilyOptions, 'now'>;
  hooks?: ServerHooks;
  modules?: ServerServiceModules;
}

export interface ServerApplication {
  server: Server;
  auth: AuthService;
  family: FamilyService;
  repositories: ServerRepositories;
  modules?: ServerServiceModules;
}

const maxBodyBytes = 1024 * 1024;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requestId(request: IncomingMessage): string {
  const candidate = request.headers['x-request-id'];
  return typeof candidate === 'string' && requestIdPattern.test(candidate) ? candidate : randomUUID();
}

function send(response: ServerResponse, status: number, requestIdValue: string, data: unknown, version?: number): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-request-id', requestIdValue);
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const currentVersion = version ?? record.version ?? record.grant_revision;
  if (typeof currentVersion === 'number' && Number.isSafeInteger(currentVersion) && currentVersion > 0) response.setHeader('ETag', `"${currentVersion}"`);
  response.end(JSON.stringify({ data, request_id: requestIdValue, schema_version: contractVersion }));
}

function errorPayload(error: DomainError): { error: { code: string; message: string; retryable: boolean; details?: DomainError['details'] } } {
  const errorBody: { code: string; message: string; retryable: boolean; details?: DomainError['details'] } = { code: error.code, message: error.message, retryable: error.retryable };
  if (error.details) errorBody.details = error.details;
  return { error: errorBody };
}

function sendError(response: ServerResponse, status: number, requestIdValue: string, error: DomainError): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-request-id', requestIdValue);
  response.end(JSON.stringify({ ...errorPayload(error), request_id: requestIdValue, schema_version: contractVersion }));
}

async function notifyResponse(hooks: ServerHooks | undefined, context: RequestHookContext, response: ServerResponse, status: number, body: unknown): Promise<void> {
  try {
    await hooks?.onResponse?.({ request: context.request, response, requestId: context.requestId, status, body, actor: context.actor, extensions: context.extensions });
  } catch {
  }
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBodyBytes) throw invalidRequest('Request body is too large');
    chunks.push(buffer);
  }
  if (size === 0) return {};
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw invalidRequest('Request body must be valid JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidRequest('Request body must be an object');
  return value as Record<string, unknown>;
}

function stringField(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== 'string' || value.length === 0 || value.length > 8192) throw invalidRequest(`${name} must be a non-empty string`);
  return value;
}

function scopesField(body: Record<string, unknown>, name: string): Scope[] {
  const value = body[name];
  if (!Array.isArray(value) || value.some(scope => typeof scope !== 'string')) throw invalidRequest(`${name} must be an array of scopes`);
  return value as Scope[];
}

function bearer(request: IncomingMessage): string {
  const value = request.headers.authorization;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) throw authenticationFailed('Bearer access token is required');
  const token = value.slice('Bearer '.length);
  if (!token) throw authenticationFailed('Bearer access token is required');
  return token;
}

function pathParts(url: string): string[] {
  return url.split('?')[0].split('/').filter(Boolean);
}

export function createApplication(options: ServerOptions = {}): ServerApplication {
  const repositories = options.repositories ?? (options.storage?.kind === 'sqlite'
    ? createSqliteRepositories({
      path: options.storage.path ?? defaultSqlitePath(options.storage.environment ?? process.env.NUANBAN_SERVER_ENV ?? process.env.NODE_ENV ?? 'development'),
      environment: options.storage.environment ?? process.env.NUANBAN_SERVER_ENV ?? process.env.NODE_ENV ?? 'development',
    })
    : createInMemoryRepositories());
  const now = options.clock;
  const auth = new AuthService(repositories, { ...options.auth, now });
  const family = new FamilyService(repositories, { ...options.family, now });

  const server = createNodeServer(async (request, response) => {
    const correlationId = requestId(request);
    const method = request.method ?? 'GET';
    const url = request.url ?? '/';
    const parts = pathParts(url);
    const context: RequestHookContext = { requestId: correlationId, method, url, path: parts, body: {}, request, extensions: {} };
    try {
      context.body = method === 'GET' || method === 'DELETE' ? {} : await readBody(request);
      await options.hooks?.onRequest?.(context);
      const emit = async (status: number, data: unknown, version?: number): Promise<void> => {
        const envelope = { data, request_id: context.requestId, schema_version: contractVersion };
        await notifyResponse(options.hooks, context, response, status, envelope);
        send(response, status, context.requestId, data, version);
      };
      const actor = async (): Promise<AuthenticatedSession> => {
        if (context.actor) return context.actor;
        const token = bearer(request);
        const authenticate = () => auth.authenticateAccessToken(token);
        const resolved = options.hooks?.resolveActor
          ? await options.hooks.resolveActor({ ...context, bearerToken: token, authenticate })
          : authenticate();
        if (!resolved) throw authenticationFailed('Authenticated actor is required');
        context.actor = resolved;
        return resolved;
      };
      const routeResult = await options.hooks?.onRoute?.({ ...context, getActor: actor, respond: emit });
      if (routeResult === true) return;
      if (routeResult && typeof routeResult === 'object') {
        await emit(routeResult.status, routeResult.data);
        return;
      }

      if (await dispatchServiceRoute({ method, url, parts, body: context.body, request, modules: options.modules, getActor: actor, emit })) return;

      if (method === 'GET' && url.split('?')[0] === '/healthz') {
        await emit(200, { status: 'ok', service: 'nuanban-server', storage: repositories instanceof Object && 'storage' in repositories ? repositories.storage : 'memory' });
        return;
      }

      if (method === 'POST' && parts.join('/') === 'v1/auth/device-challenges') {
        await emit(201, auth.issueDeviceChallenge(stringField(context.body, 'binding_id')));
        return;
      }
      if (method === 'POST' && parts.join('/') === 'v1/auth/device-exchange') {
        await emit(201, auth.exchangeDeviceChallenge(stringField(context.body, 'challenge_id'), stringField(context.body, 'signature')));
        return;
      }
      if (method === 'POST' && parts.join('/') === 'v1/auth/refresh') {
        await emit(201, auth.refreshSession(stringField(context.body, 'refresh_token')));
        return;
      }

      if (method === 'DELETE' && parts[0] === 'v1' && parts[1] === 'devices' && parts[2]) {
        await emit(200, auth.revokeDevice((await actor()).account_id, parts[2]));
        return;
      }
      if (method === 'POST' && parts.join('/') === 'v1/relations/invitations') {
        const session = await actor();
        await emit(201, family.invite(session.account_id, { helper_ref: stringField(context.body, 'helper_ref'), requested_scopes: scopesField(context.body, 'requested_scopes') }));
        return;
      }
      if (method === 'POST' && parts[0] === 'v1' && parts[1] === 'relations' && parts[2] && parts[3] === 'accept') {
        const session = await actor();
        await emit(201, family.accept(session.account_id, parts[2], { consent_id: stringField(context.body, 'consent_id'), scopes: scopesField(context.body, 'scopes') }));
        return;
      }
      if (method === 'GET' && parts.join('/') === 'v1/relations') {
        await emit(200, { items: family.list((await actor()).account_id), next_cursor: null });
        return;
      }
      if (method === 'PATCH' && parts[0] === 'v1' && parts[1] === 'relations' && parts[2] && parts[3] === 'grants') {
        const session = await actor();
        await emit(200, family.updateGrants(session.account_id, parts[2], scopesField(context.body, 'scopes'), stringField(context.body, 'consent_id'), ifMatch(request)));
        return;
      }
      if (method === 'DELETE' && parts[0] === 'v1' && parts[1] === 'relations' && parts[2]) {
        const session = await actor();
        await emit(200, family.revoke(session.account_id, parts[2]));
        return;
      }
      if (method === 'POST' && parts.join('/') === 'v1/consents') {
        const session = await actor();
        const purpose = stringField(context.body, 'purpose') as Parameters<FamilyService['createConsent']>[1]['purpose'];
        await emit(201, family.createConsent(session.account_id, { purpose, scopes: scopesField(context.body, 'scopes'), notice_version: stringField(context.body, 'notice_version'), subject_id: stringField(context.body, 'subject_id') }));
        return;
      }
      if (method === 'POST' && parts[0] === 'v1' && parts[1] === 'consents' && parts[2] && parts[3] === 'withdraw') {
        await emit(201, family.withdrawConsent((await actor()).account_id, parts[2]));
        return;
      }
      throw new DomainError(404, 'INVALID_REQUEST', 'Route not found');
    } catch (error) {
      const normalized = error instanceof DomainError ? error : new DomainError(500, 'PARTIAL_FAILURE', 'Internal server error', true);
      const envelope = { ...errorPayload(normalized), request_id: context.requestId, schema_version: contractVersion };
      await notifyResponse(options.hooks, context, response, normalized.status, envelope);
      sendError(response, normalized.status, correlationId, normalized);
    }
  });

  return { server, auth, family, repositories, modules: options.modules };
}

export function createServer(options: ServerOptions = {}): Server {
  return createApplication(options).server;
}

