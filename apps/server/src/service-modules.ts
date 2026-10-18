import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { AuthenticatedSession } from './auth.ts';
import { DomainError, invalidRequest } from './errors.ts';
import { readIfMatch as ifMatch } from './versioning.ts';
import { AssetServiceError, AssetService, ConfigurationService, type AssetContext, type GenerationInput } from '../../../packages/asset-service/src/index.ts';
import { MediaSessionError, MediaSessionService, type MediaCreateRequest, type MediaEndReason, type MediaJoinRequest } from '../../../packages/media-session/src/index.ts';
import { NoteService, ReminderService, SyncEngineError, SyncService, TodoService, type ChangeEnvelope, type NoteCreateInput, type NotePatch, type RequestContext, type StoredEntity, type SyncMutation, type TodoCreateInput, type TodoPatch } from '../../../packages/sync-engine/src/index.ts';

export interface MediaModuleOptions {
  service: MediaSessionService;
  createRequest?: (actor: AuthenticatedSession, body: Record<string, unknown>) => MediaCreateRequest | Promise<MediaCreateRequest>;
}

export interface ServerServiceModules {
  sync?: { service: SyncService; notes?: NoteService; todos?: TodoService; reminders?: ReminderService };
  assets?: { service: AssetService; configurations?: ConfigurationService };
  media?: MediaModuleOptions;
}

export interface ServiceRouteContext {
  method: string;
  url: string;
  parts: string[];
  body: Record<string, unknown>;
  request: IncomingMessage;
  modules?: ServerServiceModules;
  getActor: () => Promise<AuthenticatedSession>;
  emit: (status: number, data: unknown, version?: number) => Promise<void>;
}

function stringField(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== 'string' || value.length === 0 || value.length > 8192) throw invalidRequest(`${name} must be a non-empty string`);
  return value;
}

function optionalString(body: Record<string, unknown>, name: string): string | undefined {
  const value = body[name];
  if (value === undefined || value === null) return undefined;
  return stringField(body, name);
}

function numberField(body: Record<string, unknown>, name: string, minimum = 0): number {
  const value = body[name];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw invalidRequest(`${name} must be a safe integer`);
  return value;
}

function objectField(body: Record<string, unknown>, name: string): Record<string, unknown> {
  const value = body[name];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidRequest(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function arrayField(body: Record<string, unknown>, name: string): unknown[] {
  const value = body[name];
  if (!Array.isArray(value)) throw invalidRequest(`${name} must be an array`);
  return value;
}

function requestContext(actor: AuthenticatedSession): RequestContext {
  return { actorId: actor.account_id, subjectId: actor.account_id, deviceId: actor.device_id };
}

function assetContext(actor: AuthenticatedSession): AssetContext {
  return { actorId: actor.account_id };
}

function iso(value: number): string {
  const result = new Date(value).toISOString();
  return result;
}

function noteDto(note: Extract<StoredEntity, { entityType: 'note' }>): Record<string, unknown> {
  return {
    note_id: note.id,
    owner_id: note.ownerId,
    asked_at: note.askedAt,
    question: note.question,
    topic: note.topic,
    answer_summary: note.summary,
    mastery: note.mastery,
    mastery_source: note.masterySource,
    reviewed_at: note.reviewedAt,
    source: note.source,
    source_session_id: note.sourceSessionId,
    version: note.version,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
  };
}

function todoDto(todo: Extract<StoredEntity, { entityType: 'todo' }>): Record<string, unknown> {
  return {
    todo_id: todo.id,
    owner_id: todo.ownerId,
    creator_id: todo.creatorId,
    title: todo.title,
    note_id: todo.noteId,
    timezone: todo.timezone,
    remind_at: todo.remindAt,
    repeat_rule: todo.repeatRule,
    status: todo.status,
    completed_at: todo.completedAt,
    source: todo.source,
    next_fire_at: todo.nextFireAt,
    version: todo.version,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    deleted_at: todo.deletedAt,
  };
}

function entityDto(entity: StoredEntity): Record<string, unknown> {
  return entity.entityType === 'note' ? noteDto(entity) : todoDto(entity);
}

function syncResult(result: Awaited<ReturnType<SyncService['applyMutation']>>): Record<string, unknown> {
  return {
    mutation_id: result.mutationId,
    status: result.status,
    version: result.version,
    conflict: result.conflict ? {
      conflict_id: result.mutationId,
      entity_id: result.conflict.entityId,
      entity_type: result.conflict.entityType,
      base_version: result.conflict.baseVersion,
      current_version: result.conflict.currentVersion,
      current: result.conflict.current ? entityDto(result.conflict.current) : null,
      reason: result.conflict.reason === 'missing' ? 'updated' : result.conflict.reason,
    } : null,
    error_code: null,
  };
}

function changeDto(change: ChangeEnvelope): Record<string, unknown> {
  return { entity_type: change.entityType, entity_id: change.entityId, version: change.version, operation: change.operation, entity: change.entity ? entityDto(change.entity) : null };
}

function generationInput(body: Record<string, unknown>): GenerationInput {
  const input = body.input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidRequest('input must contain an explicit generation input');
  return input as GenerationInput;
}

function petJobDto(job: Awaited<ReturnType<AssetService['get']>>): Record<string, unknown> {
  const status = job.state === 'preview' || job.state === 'confirmed' ? 'succeeded' : job.state === 'failed' ? 'failed' : job.state;
  const progress = status === 'queued' ? 0 : status === 'processing' ? 50 : 100;
  return {
    job_id: job.jobId,
    status,
    progress,
    assets: [],
    generation: job.generation,
    error: job.error ? { code: job.error, message: job.error } : null,
  };
}

export function mapError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  if (error instanceof SyncEngineError) {
    if (error.code === 'FORBIDDEN') return new DomainError(403, 'PERMISSION_DENIED', error.message);
    if (error.code === 'VERSION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT') return new DomainError(409, 'VERSION_CONFLICT', error.message);
    if (error.code === 'NOT_FOUND') return new DomainError(404, 'INVALID_REQUEST', error.message);
    return new DomainError(400, 'INVALID_REQUEST', error.message);
  }
  if (error instanceof AssetServiceError) {
    if (error.code === 'SCOPE_DENIED') return new DomainError(403, 'SCOPE_DENIED', error.message);
    if (error.code === 'VERSION_CONFLICT') return new DomainError(409, 'VERSION_CONFLICT', error.message);
    if (error.code === 'SIGNING_UNAVAILABLE') return new DomainError(503, 'PROVIDER_UNAVAILABLE', error.message, true);
    return new DomainError(error.code === 'NOT_FOUND' ? 404 : 400, 'INVALID_REQUEST', error.message);
  }
  if (error instanceof MediaSessionError) {
    if (error.code === 'SCOPE_DENIED') return new DomainError(403, 'SCOPE_DENIED', error.message);
    if (error.code === 'CONSENT_REQUIRED') return new DomainError(403, 'CONSENT_REQUIRED', error.message);
    if (error.code === 'GRANT_REVOKED') return new DomainError(403, 'PERMISSION_DENIED', error.message);
    if (error.code === 'LEASE_EXPIRED') return new DomainError(408, 'TIMEOUT', error.message, true);
    if (error.code === 'ALLOCATION_FAILED') return new DomainError(503, 'PARTIAL_FAILURE', error.message, true);
    return new DomainError(error.code === 'NOT_FOUND' ? 404 : 409, 'INVALID_REQUEST', error.message);
  }
  return new DomainError(500, 'PARTIAL_FAILURE', 'Internal server error', true);
}

async function dispatchSyncRoute(context: ServiceRouteContext, actor: AuthenticatedSession, service: ServerServiceModules['sync']): Promise<boolean> {
  if (!service) return false;
  const syncContext = requestContext(actor);
  const path = context.parts.join('/');
  if (context.method === 'GET' && path === 'v1/notes') {
    const items = (await service.service.list(syncContext, 'note')).filter((entity): entity is Extract<StoredEntity, { entityType: 'note' }> => entity.entityType === 'note').map(noteDto);
    await context.emit(200, { items, next_cursor: null });
    return true;
  }
  if (context.method === 'POST' && path === 'v1/notes') {
    const noteInput: NoteCreateInput = { id: randomUUID(), askedAt: stringField(context.body, 'asked_at'), question: stringField(context.body, 'question'), topic: stringField(context.body, 'topic'), summary: stringField(context.body, 'answer_summary'), source: 'conversation', sourceSessionId: context.body.source_session_id === null ? null : optionalString(context.body, 'source_session_id') ?? null };
    const note = await (service.notes ?? service.service as NoteService).create(syncContext, noteInput);
    await context.emit(201, { note: noteDto(note), version: note.version });
    return true;
  }
  if (context.method === 'PATCH' && context.parts[0] === 'v1' && context.parts[1] === 'notes' && context.parts[2]) {
    const raw = context.body;
    const patch: NotePatch = {};
    if (raw.answer_summary !== undefined) patch.summary = stringField(raw, 'answer_summary');
    if (raw.mastery !== undefined) patch.mastery = raw.mastery as NotePatch['mastery'];
    if (raw.mastery_source !== undefined) patch.masterySource = raw.mastery_source as NotePatch['masterySource'];
    const note = await (service.notes ?? service.service as NoteService).update(syncContext, context.parts[2], ifMatch(context.request), patch);
    await context.emit(200, { note: noteDto(note), version: note.version });
    return true;
  }
  if (context.method === 'DELETE' && context.parts[0] === 'v1' && context.parts[1] === 'notes' && context.parts[2]) {
    const note = await (service.notes ?? service.service as NoteService).delete(syncContext, context.parts[2], ifMatch(context.request));
    await context.emit(200, { deleted_at: note.deletedAt }, note.version);
    return true;
  }
  if (context.method === 'GET' && path === 'v1/todos') {
    const items = (await (service.todos ?? service.service as TodoService).list(syncContext, 'todo')).filter((entity): entity is Extract<StoredEntity, { entityType: 'todo' }> => entity.entityType === 'todo').map(todoDto);
    await context.emit(200, { items, next_cursor: null });
    return true;
  }
  if (context.method === 'POST' && path === 'v1/todos') {
    if (context.body.time_confirmed !== true) throw invalidRequest('time_confirmed must be true');
    const todoInput: TodoCreateInput = { id: randomUUID(), title: stringField(context.body, 'title'), noteId: context.body.note_id === null ? null : optionalString(context.body, 'note_id') ?? null, timezone: stringField(context.body, 'timezone'), remindAt: stringField(context.body, 'remind_at'), repeatRule: objectField(context.body, 'repeat_rule') as unknown as TodoCreateInput['repeatRule'], timeConfirmed: true, source: 'self' };
    const todo = await (service.todos ?? service.service as TodoService).create(syncContext, todoInput);
    await context.emit(201, { todo: todoDto(todo), version: todo.version });
    return true;
  }
  if (context.method === 'PATCH' && context.parts[0] === 'v1' && context.parts[1] === 'todos' && context.parts[2]) {
    const rawPatch = objectField(context.body, 'patch');
    const allowedFields = ['title', 'note_id', 'remind_at', 'timezone', 'repeat_rule', 'time_confirmed'];
    if (!Object.keys(rawPatch).length || Object.keys(rawPatch).some(field => !allowedFields.includes(field))) throw invalidRequest('patch contains unsupported fields');
    const scheduleFields = ['remind_at', 'timezone', 'repeat_rule', 'time_confirmed'];
    if (Object.keys(rawPatch).some(field => scheduleFields.includes(field)) && (rawPatch.remind_at === undefined || rawPatch.timezone === undefined || rawPatch.time_confirmed !== true)) {
      throw invalidRequest('schedule changes require remind_at, timezone, and time_confirmed');
    }
    const patch: TodoPatch = {};
    if (rawPatch.title !== undefined) patch.title = stringField(rawPatch, 'title');
    if (rawPatch.note_id !== undefined) patch.noteId = rawPatch.note_id === null ? null : stringField(rawPatch, 'note_id');
    if (rawPatch.remind_at !== undefined) patch.remindAt = stringField(rawPatch, 'remind_at');
    if (rawPatch.timezone !== undefined) patch.timezone = stringField(rawPatch, 'timezone');
    if (rawPatch.repeat_rule !== undefined) patch.repeatRule = objectField(rawPatch, 'repeat_rule') as unknown as TodoPatch['repeatRule'];
    if (rawPatch.time_confirmed !== undefined) {
      if (rawPatch.time_confirmed !== true) throw invalidRequest('time_confirmed must be true');
      patch.timeConfirmed = true;
    }
    const todo = await (service.todos ?? service.service as TodoService).update(syncContext, context.parts[2], ifMatch(context.request), patch);
    await context.emit(200, { todo: todoDto(todo), version: todo.version });
    return true;
  }
  if (context.method === 'DELETE' && context.parts[0] === 'v1' && context.parts[1] === 'todos' && context.parts[2]) {
    const todo = await (service.todos ?? service.service as TodoService).cancel(syncContext, context.parts[2], ifMatch(context.request));
    await context.emit(200, { cancelled: todo.status === 'cancelled' }, todo.version);
    return true;
  }
  if (context.method === 'POST' && context.parts[0] === 'v1' && context.parts[1] === 'todos' && context.parts[2] && context.parts[3] === 'occurrences' && context.parts[4] && context.parts[5] === 'complete') {
    const todo = await (service.todos ?? service.service as TodoService).completeOccurrence(syncContext, context.parts[2], context.parts[4], new Date().toISOString());
    await context.emit(200, { result: 'completed', next_fire_at: todo.nextFireAt });
    return true;
  }
  if (context.method === 'POST' && path === 'v1/sync/mutations') {
    const mutations = arrayField(context.body, 'mutations');
    const results: Record<string, unknown>[] = [];
    for (const value of mutations) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidRequest('mutations must contain objects');
      const raw = value as Record<string, unknown>;
      const mutation: SyncMutation = { mutationId: stringField(raw, 'mutation_id'), ownerId: actor.account_id, entityType: stringField(raw, 'entity_type') as SyncMutation['entityType'], entityId: stringField(raw, 'entity_id'), operation: stringField(raw, 'operation') as SyncMutation['operation'], baseVersion: numberField(raw, 'base_version'), patch: objectField(raw, 'patch'), createdAt: optionalString(raw, 'created_at') ?? new Date().toISOString() };
      try { results.push(syncResult(await service.service.applyMutation(syncContext, mutation))); } catch (error) {
        const normalized = mapError(error);
        const code = normalized.code === 'VERSION_CONFLICT' || normalized.code === 'SCOPE_DENIED' ? normalized.code : 'INVALID_REQUEST';
        results.push({ mutation_id: mutation.mutationId, status: 'failed', version: null, conflict: null, error_code: code });
      }
    }
    await context.emit(200, { results });
    return true;
  }
  if (context.method === 'GET' && path === 'v1/sync/changes') {
    const url = new URL(context.url, 'http://nuanban.local');
    const page = await service.service.changes(syncContext, url.searchParams.get('cursor') ?? undefined, Number(url.searchParams.get('limit') ?? 100));
    await context.emit(200, { changes: page.changes.map(changeDto), next_cursor: page.nextCursor });
    return true;
  }
  if (context.method === 'POST' && context.parts[0] === 'v1' && context.parts[1] === 'reminders' && context.parts[2] && context.parts[3] === 'receipts' && service.reminders) {
    const state = stringField(context.body, 'state');
    if (!['submitted', 'delivered', 'opened'].includes(state)) throw invalidRequest('Unsupported reminder receipt state');
    const result = await service.reminders.receipt(syncContext, actor.account_id, stringField(context.body, 'todo_id'), context.parts[2], state as 'submitted' | 'delivered' | 'opened', new Date().toISOString());
    await context.emit(200, { accepted: Boolean(result) });
    return true;
  }
  return false;
}

async function dispatchAssetRoute(context: ServiceRouteContext, actor: AuthenticatedSession, module: NonNullable<ServerServiceModules['assets']>): Promise<boolean> {
  const path = context.parts.join('/');
  if (context.method === 'POST' && path === 'v1/pet-jobs') {
    const job = await module.service.create(assetContext(actor), actor.account_id, generationInput(context.body));
    await context.emit(201, { job_id: job.jobId, status: 'queued' });
    return true;
  }
  if (context.method === 'GET' && context.parts[0] === 'v1' && context.parts[1] === 'pet-jobs' && context.parts[2]) {
    const job = await module.service.get(assetContext(actor), context.parts[2]);
    await context.emit(200, petJobDto(job));
    return true;
  }
  if (context.method === 'DELETE' && context.parts[0] === 'v1' && context.parts[1] === 'pet-jobs' && context.parts[2]) {
    await module.service.cancel(assetContext(actor), context.parts[2]);
    await context.emit(200, { status: 'cancelled' });
    return true;
  }
  return false;
}

function defaultMediaRequest(actor: AuthenticatedSession, body: Record<string, unknown>): MediaCreateRequest {
  const requestedMedia = arrayField(body, 'requested_media');
  if (!requestedMedia.length || requestedMedia.some(value => value !== 'screen' && value !== 'audio')) throw invalidRequest('requested_media is invalid');
  return {
    sessionId: optionalString(body, 'session_id') ?? randomUUID(),
    ownerId: optionalString(body, 'owner_id') ?? actor.account_id,
    helperId: stringField(body, 'helper_id'),
    relationId: stringField(body, 'relation_id'),
    consentId: optionalString(body, 'consent_id') ?? stringField(body, 'local_consent_id'),
    requestedMedia: requestedMedia as MediaCreateRequest['requestedMedia'],
    grantRevision: body.grant_revision === undefined ? 1 : numberField(body, 'grant_revision', 1),
    expiresAt: body.expires_at === undefined ? Date.now() + 5 * 60_000 : numberField(body, 'expires_at', Date.now() + 1),
  };
}

async function dispatchMediaRoute(context: ServiceRouteContext, actor: AuthenticatedSession, module: NonNullable<ServerServiceModules['media']>): Promise<boolean> {
  const path = context.parts.join('/');
  if (context.method === 'POST' && path === 'v1/assists') {
    const request = await (module.createRequest?.(actor, context.body) ?? defaultMediaRequest(actor, context.body));
    const session = await module.service.create(actor.account_id, request);
    await context.emit(201, { assist_id: session.sessionId, expires_at: iso(session.expiresAt) });
    return true;
  }
  if (context.method === 'POST' && context.parts[0] === 'v1' && context.parts[1] === 'assists' && context.parts[2] && context.parts[3] === 'accept') {
    const session = await module.service.accept(actor.account_id, context.parts[2]);
    await context.emit(200, { state: session.state });
    return true;
  }
  if (context.method === 'POST' && context.parts[0] === 'v1' && context.parts[1] === 'assists' && context.parts[2] && context.parts[3] === 'join') {
    const request: MediaJoinRequest = { actorId: actor.account_id, deviceId: stringField(context.body, 'device_id'), consentId: stringField(context.body, 'consent_id'), grantRevision: numberField(context.body, 'grant_revision', 1) };
    const response = await module.service.join(request, context.parts[2]);
    await context.emit(200, { signal_ticket: response.signalTicket, turn_credentials: response.turnCredentials, expires_at: iso(response.expiresAt), relay_only: true });
    return true;
  }
  if (context.method === 'POST' && context.parts[0] === 'v1' && context.parts[1] === 'assists' && context.parts[2] && context.parts[3] === 'end') {
    const reason = stringField(context.body, 'reason') as MediaEndReason;
    const session = await module.service.end(actor.account_id, context.parts[2], reason);
    await context.emit(200, { state: session.state });
    return true;
  }
  return false;
}

export async function dispatchServiceRoute(context: ServiceRouteContext): Promise<boolean> {
  if (!context.modules) return false;
  const path = context.parts.join('/');
  const syncRoute = path === 'v1/notes' || path === 'v1/todos' || path === 'v1/sync/mutations' || path === 'v1/sync/changes' || (context.parts[0] === 'v1' && context.parts[1] === 'notes') || (context.parts[0] === 'v1' && context.parts[1] === 'todos') || (context.parts[0] === 'v1' && context.parts[1] === 'reminders');
  const assetRoute = path === 'v1/pet-jobs' || (context.parts[0] === 'v1' && context.parts[1] === 'pet-jobs');
  const mediaRoute = path === 'v1/assists' || (context.parts[0] === 'v1' && context.parts[1] === 'assists');
  if ((!context.modules.sync || !syncRoute) && (!context.modules.assets || !assetRoute) && (!context.modules.media || !mediaRoute)) return false;
  try {
    const actor = await context.getActor();
    if (context.modules.sync && syncRoute && await dispatchSyncRoute(context, actor, context.modules.sync)) return true;
    if (context.modules.assets && assetRoute && await dispatchAssetRoute(context, actor, context.modules.assets)) return true;
    if (context.modules.media && mediaRoute && await dispatchMediaRoute(context, actor, context.modules.media)) return true;
    return false;
  } catch (error) {
    throw mapError(error);
  }
}

