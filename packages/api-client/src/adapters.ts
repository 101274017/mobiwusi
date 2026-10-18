import { ServiceFailure, type LocalSnapshot, type Repository } from '@nuanban/application';
import type { Family, Note, Preferences, Todo } from '@nuanban/domain';
import type { ConversationMessagePage, ConversationMessageDto, NoteDto, NotePage, RelationDto, RelationPage, SyncChangesResponse, SyncMutationDto, SyncResponse, TodoDto, TodoPage } from '@nuanban/contracts';
import { contractValidator } from '../../contracts/src/validation';
import { RemoteApiClient } from './remote';

export interface RemoteRepositoryOptions {
  defaultPreferences?: Preferences;
  createId?: () => string;
}

export interface RemotePageOptions {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

const defaultPreferences: Preferences = {
  mode: 'elder', fontScale: 1, captionSize: 32, muted: false, speechRate: 1,
  reducedMotion: false, pet: 'cat', petColor: '#D98347',
  petAppearance: { eyes: 'round', mouth: 'smile', action: 'idle' }, previousPet: null, petRevision: 1,
};

function id(): string { return globalThis.crypto.randomUUID(); }
function assertOwner(ownerId: string, actual: string): void {
  if (ownerId !== actual) throw new ServiceFailure('SCOPE_DENIED', '远端资料不属于当前账号。');
}
function assertContract(name: string, value: unknown): void {
  if (!contractValidator(name)(value)) throw new ServiceFailure('STREAM_INTERRUPTED', `远端 ${name} 不符合服务契约。`, true);
}
function mapNote(ownerId: string, dto: NoteDto): Note {
  assertOwner(ownerId, dto.owner_id);
  return { id: dto.note_id, ownerId: dto.owner_id, question: dto.question, topic: dto.topic, summary: dto.answer_summary, mastery: dto.mastery, masterySource: dto.mastery_source === null ? null : 'user', reviewedAt: dto.reviewed_at, source: dto.source, createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version, deletedAt: dto.deleted_at };
}
function mapTodo(ownerId: string, dto: TodoDto): Todo {
  assertOwner(ownerId, dto.owner_id);
  return { id: dto.todo_id, ownerId: dto.owner_id, title: dto.title, dueAt: dto.remind_at, timezone: dto.timezone, noteId: dto.note_id, completedAt: dto.completed_at, repeat: dto.repeat_rule.frequency, source: dto.source === 'authorized_family' ? 'self' : dto.source, createdAt: dto.created_at, updatedAt: dto.updated_at, version: dto.version, deletedAt: dto.deleted_at };
}
function mapFamily(ownerId: string, dto: RelationDto): Family {
  assertOwner(ownerId, dto.subject_id);
  return { id: dto.relation_id, name: dto.label, relation: dto.label, status: dto.status, scopes: dto.scopes.flatMap(scope => scope === 'learning.read' ? ['notes:read'] : scope === 'todo.write' ? ['todos:write'] : []) };
}
function toPreferences(preferences: Preferences) {
  return {
    mode: preferences.mode, font_scale: preferences.fontScale, caption_size: preferences.captionSize,
    reduced_motion: preferences.reducedMotion, voice: { muted: preferences.muted, rate: preferences.speechRate },
    appearance: { eyes: preferences.petAppearance?.eyes ?? 'round', mouth: preferences.petAppearance?.mouth ?? 'smile', color: preferences.petColor, action: 'idle' as const },
  };
}
function fromPreferences(value: { mode: Preferences['mode']; font_scale: number; caption_size: number; reduced_motion: boolean; voice: { muted: boolean; rate: number }; appearance: { eyes: 'round' | 'happy' | 'sleepy'; mouth: 'smile' | 'small' | 'open'; color: string } }): Preferences {
  return { mode: value.mode, fontScale: value.font_scale, captionSize: value.caption_size, reducedMotion: value.reduced_motion, muted: value.voice.muted, speechRate: value.voice.rate, pet: 'cat', petColor: value.appearance.color, petAppearance: { eyes: value.appearance.eyes, mouth: value.appearance.mouth, action: 'idle' }, previousPet: null, petRevision: 1 };
}
function noteCreate(note: Note): SyncMutationDto {
  return { mutation_id: id(), entity_id: note.id, entity_type: 'note', base_version: 0, operation: 'create', patch: { asked_at: note.createdAt, question: note.question, topic: note.topic, answer_summary: note.summary, source_session_id: null } };
}
function noteMutation(note: Note, baseVersion: number): SyncMutationDto {
  const patch: { answer_summary?: string; mastery?: Note['mastery']; mastery_source?: 'self' | 'authorized_family' } = {};
  if (note.summary) patch.answer_summary = note.summary;
  patch.mastery = note.mastery;
  if (note.masterySource) patch.mastery_source = 'self';
  return { mutation_id: id(), entity_id: note.id, entity_type: 'note', base_version: baseVersion, operation: note.deletedAt ? 'delete' : 'update', patch: note.deletedAt ? {} : patch } as SyncMutationDto;
}
function todoCreate(todo: Todo): SyncMutationDto {
  return { mutation_id: id(), entity_id: todo.id, entity_type: 'todo', base_version: 0, operation: 'create', patch: { title: todo.title, note_id: todo.noteId, remind_at: todo.dueAt, timezone: todo.timezone, repeat_rule: { frequency: todo.repeat, interval: 1 }, time_confirmed: true } };
}
function todoMutation(todo: Todo, baseVersion: number): SyncMutationDto {
  const patch = { title: todo.title, note_id: todo.noteId, remind_at: todo.dueAt, timezone: todo.timezone, repeat_rule: { frequency: todo.repeat, interval: 1 }, time_confirmed: true as const };
  return { mutation_id: id(), entity_id: todo.id, entity_type: 'todo', base_version: baseVersion, operation: todo.deletedAt ? 'delete' : 'update', patch: todo.deletedAt ? {} : patch } as SyncMutationDto;
}

async function page<T>(client: RemoteApiClient, operation: 'noteList' | 'todoList' | 'relationList', options: RemotePageOptions = {}): Promise<T[]> {
  const items: T[] = [];
  let cursor = options.cursor;
  do {
    const result = await client.request<{ items: T[]; next_cursor: string | null }>(operation, { query: { cursor, limit: options.limit }, signal: options.signal });
    items.push(...result.data.items);
    cursor = result.data.next_cursor ?? undefined;
  } while (cursor);
  return items;
}

export class RemoteRepository implements Repository {
  private readonly acknowledged = new Set<string>();
  private readonly baselines = new Map<string, { preferences: Preferences; preferenceVersion: number; preferenceEtag: string | null; family: Family[] }>();
  private readonly defaults: Preferences;
  private readonly createId: () => string;

  constructor(private readonly client: RemoteApiClient, options: RemoteRepositoryOptions = {}) {
    this.defaults = structuredClone(options.defaultPreferences ?? defaultPreferences);
    this.createId = options.createId ?? id;
  }

  async load(ownerId: string, signal?: AbortSignal): Promise<LocalSnapshot> {
    const [me, notes, todos, relations] = await Promise.all([
      this.client.request<{ user: { user_id: string; preferences: Parameters<typeof fromPreferences>[0]; version: number } }>('meGet', { signal }),
      page<NoteDto>(this.client, 'noteList', { signal }),
      page<TodoDto>(this.client, 'todoList', { signal }),
      page<RelationDto>(this.client, 'relationList', { signal }),
    ]);
    assertOwner(ownerId, me.data.user.user_id);
    for (const value of notes) assertContract('NoteDto', value);
    for (const value of todos) assertContract('TodoDto', value);
    for (const value of relations) assertContract('RelationDto', value);
    const family = relations.filter(value => value.subject_id === ownerId).map(value => mapFamily(ownerId, value));
    const preferences = fromPreferences(me.data.user.preferences);
    this.baselines.set(ownerId, { preferences: structuredClone(preferences), preferenceVersion: me.data.user.version, preferenceEtag: null, family: structuredClone(family) });
    return { notes: notes.map(value => mapNote(ownerId, value)), todos: todos.map(value => mapTodo(ownerId, value)), preferences, family, outbox: [], initialized: true, conflicts: [] };
  }

  async commit(ownerId: string, snapshot: LocalSnapshot): Promise<void> {
    const baseline = this.baselines.get(ownerId);
    if (!baseline) throw new ServiceFailure('INVALID_REQUEST', '必须先加载远端账号资料。');
    if (JSON.stringify(snapshot.family) !== JSON.stringify(baseline.family)) throw new ServiceFailure('SCOPE_DENIED', '关系视图必须通过显式 family API 修改。');
    if (JSON.stringify(snapshot.preferences) !== JSON.stringify(baseline.preferences)) {
      const result = await this.client.request<{ version: number }>('preferencesUpdate', { body: { mode: snapshot.preferences.mode, preferences: toPreferences(snapshot.preferences) }, idempotencyKey: this.createId(), ifMatch: `"${baseline.preferenceVersion}"` });
      baseline.preferences = structuredClone(snapshot.preferences);
      baseline.preferenceVersion = result.data.version;
      baseline.preferenceEtag = result.etag;
    }
    const mutations: SyncMutationDto[] = [];
    const latest = new Map<string, typeof snapshot.outbox[number]>();
    for (const entry of snapshot.outbox) if (!this.acknowledged.has(entry.id)) latest.set(`${entry.entityType}:${entry.entityId}`, entry);
    for (const entry of latest.values()) {
      const entity = entry.entityType === 'note' ? snapshot.notes.find(item => item.id === entry.entityId) : snapshot.todos.find(item => item.id === entry.entityId);
      if (!entity || entity.ownerId !== ownerId) throw new ServiceFailure('SCOPE_DENIED', '同步对象不属于当前账号。');
      mutations.push(entry.entityType === 'note' ? (entity.version === 1 ? noteCreate(entity as Note) : noteMutation(entity as Note, entity.version - 1)) : (entity.version === 1 ? todoCreate(entity as Todo) : todoMutation(entity as Todo, entity.version - 1)));
    }
    if (!mutations.length) return;
    const result = await this.client.request<SyncResponse>('syncMutations', { body: { mutations }, idempotencyKey: this.createId() });
    for (const item of result.data.results) {
      const entry = [...latest.values()].find(value => value.entityId === item.mutation_id || value.entityId === mutations.find(mutation => mutation.mutation_id === item.mutation_id)?.entity_id);
      if (item.status === 'conflict') throw new ServiceFailure('VERSION_CONFLICT', '远端资料有新版本，草稿已保留。');
      if (item.status === 'failed') throw new ServiceFailure(item.error_code ?? 'INVALID_REQUEST', '远端同步拒绝了这次修改。');
      if (entry) this.acknowledged.add(entry.id);
    }
  }

  async clear(_ownerId: string): Promise<void> { throw new ServiceFailure('INVALID_REQUEST', '真实账号不支持通过本地清空操作删除远端资料。'); }
}

export interface RemoteFamilyView { relationId: string; label: string; status: RelationDto['status']; scopes: RelationDto['scopes']; grantRevision: number; version: number; }
export interface RemoteSyncView { changes: SyncChangesResponse['changes']; next_cursor: string | null; }
export interface RemoteConversationView { items: ConversationMessageDto[]; next_cursor: string | null; }

export class RemoteViews {
  constructor(private readonly client: RemoteApiClient) {}

  async notes(options: RemotePageOptions = {}): Promise<NotePage> { const items = await page<NoteDto>(this.client, 'noteList', options); items.forEach(value => assertContract('NoteDto', value)); return { items, next_cursor: null }; }
  async todos(options: RemotePageOptions = {}): Promise<TodoPage> { const items = await page<TodoDto>(this.client, 'todoList', options); items.forEach(value => assertContract('TodoDto', value)); return { items, next_cursor: null }; }
  async family(options: RemotePageOptions = {}): Promise<RemoteFamilyView[]> { const items = await page<RelationDto>(this.client, 'relationList', options); items.forEach(value => assertContract('RelationDto', value)); return items.map(value => ({ relationId: value.relation_id, label: value.label, status: value.status, scopes: value.scopes, grantRevision: value.grant_revision, version: value.version })); }
  async changes(cursor: string | undefined, signal?: AbortSignal): Promise<RemoteSyncView> { const result = await this.client.request<SyncChangesResponse>('syncChanges', { query: { cursor }, signal }); return result.data; }
  async mutations(mutations: SyncMutationDto[], signal?: AbortSignal): Promise<SyncResponse> { return (await this.client.request<SyncResponse>('syncMutations', { body: { mutations }, idempotencyKey: id(), signal })).data; }
  async reminderReceipt(instanceId: string, body: { device_id: string; channel: 'local' | 'push'; state: 'submitted' | 'delivered' | 'opened' | 'failed' | 'missed' | 'unknown' }, signal?: AbortSignal): Promise<void> { await this.client.request('reminderReceipt', { path: { instance_id: instanceId }, body, idempotencyKey: id(), signal }); }
  async conversation(sessionId: string, cursor?: string, signal?: AbortSignal): Promise<RemoteConversationView> { const result = await this.client.request<ConversationMessagePage>('conversationMessages', { path: { id: sessionId }, query: { cursor }, signal }); return result.data; }
}
