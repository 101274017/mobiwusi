export type EntityType = 'note' | 'todo';
export type MutationOperation = 'create' | 'update' | 'delete';
export type ChangeOperation = 'upsert' | 'delete';
export type AccessAction = 'read' | 'write' | 'schedule' | 'receipt';
export type RepeatFrequency = 'none' | 'daily' | 'weekly';

export interface RequestContext {
  actorId: string;
  subjectId: string;
  deviceId?: string;
}

export interface ObjectAuthorizationRequest {
  actorId: string;
  subjectId: string;
  entityType: EntityType;
  entityId: string;
  ownerId: string;
  action: AccessAction;
}

export interface ObjectAuthorizer {
  authorize(request: ObjectAuthorizationRequest): Promise<boolean>;
}

export interface ClockPort {
  now(): string;
}

export interface VersionedRecord {
  id: string;
  ownerId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NoteRecord extends VersionedRecord {
  entityType: 'note';
  askedAt: string;
  question: string;
  topic: string;
  summary: string;
  mastery: 'unmastered' | 'mastered';
  masterySource: 'self' | 'authorized_family' | null;
  reviewedAt: string | null;
  source: 'conversation' | 'guidance' | 'demo';
  sourceSessionId: string | null;
}

export interface RepeatRule {
  frequency: RepeatFrequency;
  interval: number;
}

export interface TodoRecord extends VersionedRecord {
  entityType: 'todo';
  creatorId: string;
  title: string;
  noteId: string | null;
  timezone: string;
  remindAt: string;
  repeatRule: RepeatRule;
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: string | null;
  source: 'self' | 'review' | 'authorized_family';
  nextFireAt: string | null;
  scheduleRevision: number;
  lastCompletedInstanceId: string | null;
}

export type StoredEntity = NoteRecord | TodoRecord;

export interface NoteCreateInput {
  id: string;
  askedAt: string;
  question: string;
  topic: string;
  summary: string;
  source: NoteRecord['source'];
  sourceSessionId?: string | null;
}

export interface NotePatch {
  summary?: string;
  mastery?: NoteRecord['mastery'];
  masterySource?: NoteRecord['masterySource'];
  reviewedAt?: string | null;
}

export interface TodoCreateInput {
  id: string;
  title: string;
  noteId?: string | null;
  timezone: string;
  remindAt: string;
  repeatRule: RepeatRule;
  timeConfirmed: true;
  source?: TodoRecord['source'];
}

export interface TodoPatch {
  title?: string;
  noteId?: string | null;
  timezone?: string;
  remindAt?: string;
  repeatRule?: RepeatRule;
  timeConfirmed?: true;
  status?: 'pending' | 'cancelled';
  completion?: { instanceId: string; completedAt: string };
}

export interface SyncMutation {
  mutationId: string;
  ownerId: string;
  entityType: EntityType;
  entityId: string;
  operation: MutationOperation;
  baseVersion: number;
  patch: Record<string, unknown>;
  createdAt: string;
}

export interface Conflict {
  entityType: EntityType;
  entityId: string;
  ownerId: string;
  baseVersion: number;
  currentVersion: number;
  reason: 'updated' | 'deleted' | 'missing';
  current: StoredEntity | null;
}

export interface MutationResult {
  mutationId: string;
  status: 'acked' | 'conflict';
  version: number | null;
  entity: StoredEntity | null;
  conflict: Conflict | null;
}

export interface MutationReceipt {
  actorId: string;
  ownerId: string;
  fingerprint: string;
  mutation: SyncMutation;
  result: MutationResult;
}

export interface ChangeEnvelope {
  sequence: number;
  ownerId: string;
  entityType: EntityType;
  entityId: string;
  version: number;
  operation: ChangeOperation;
  entity: StoredEntity | null;
}

export interface OutboxItem {
  id: string;
  mutationId: string;
  ownerId: string;
  entityType: EntityType;
  entityId: string;
  operation: MutationOperation;
  version: number;
  status: 'pending' | 'acknowledged';
  createdAt: string;
  actorId: string;
  mutation: SyncMutation;
}

export interface SyncTransaction {
  getEntity(entityType: EntityType, entityId: string, ownerId: string): Promise<StoredEntity | null>;
  getEntityById(entityType: EntityType, entityId: string): Promise<StoredEntity | null>;
  listEntities(entityType: EntityType, ownerId: string): Promise<StoredEntity[]>;
  putEntity(entity: StoredEntity): Promise<void>;
  appendChange(change: Omit<ChangeEnvelope, 'sequence'>): Promise<ChangeEnvelope>;
  listChanges(afterSequence: number, limit: number): Promise<ChangeEnvelope[]>;
  getChangeSequence(): Promise<number>;
  getMutation(actorId: string, ownerId: string, mutationId: string): Promise<MutationReceipt | null>;
  saveMutation(receipt: MutationReceipt): Promise<void>;
  enqueueOutbox(item: OutboxItem): Promise<void>;
  getOutbox(id: string): Promise<OutboxItem | null>;
  listOutbox(ownerId: string): Promise<OutboxItem[]>;
  acknowledgeOutbox(id: string): Promise<void>;
}

export interface SyncStore {
  transaction<T>(work: (transaction: SyncTransaction) => Promise<T>): Promise<T>;
}

export interface ReminderOccurrence {
  ownerId: string;
  todoId: string;
  instanceId: string;
  plannedAt: string;
  timezone: string;
  scheduleRevision: number;
  repeatRule: RepeatRule;
  state: 'scheduled' | 'submitted' | 'delivered' | 'opened' | 'cancelled';
  submittedAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ReminderTransaction {
  get(ownerId: string, instanceId: string): Promise<ReminderOccurrence | null>;
  list(ownerId: string): Promise<ReminderOccurrence[]>;
  save(occurrence: ReminderOccurrence): Promise<void>;
}

export interface ReminderStore extends ReminderTransaction {
  transaction<Result>(work: (transaction: ReminderTransaction) => Promise<Result>): Promise<Result>;
  listPending(): Promise<ReminderOccurrence[]>;
}

export type ReminderScheduleInput = Pick<ReminderOccurrence, 'ownerId' | 'todoId' | 'instanceId' | 'plannedAt' | 'timezone' | 'scheduleRevision' | 'repeatRule'>;

export interface ReminderTodoPort {
  getTodo(ownerId: string, todoId: string): Promise<TodoRecord | null>;
}

export interface ReminderTask {
  id: string;
  ownerId: string;
  occurrenceId: string;
  availableAt: string;
  status: 'queued' | 'running' | 'completed' | 'cancelled';
  attempts: number;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
}

export interface TaskQueuePort {
  enqueue(task: ReminderTask): Promise<void>;
  listReady(now: string): Promise<ReminderTask[]>;
  claim(taskId: string, now: string, leaseMilliseconds?: number): Promise<ReminderTask | null>;
  complete(taskId: string, leaseToken: string): Promise<void>;
  retry(taskId: string, leaseToken: string, availableAt: string, error: string): Promise<void>;
  cancel(taskId: string): Promise<void>;
  recover(now: string): Promise<void>;
}

export interface ReminderDeliveryPort {
  submit(occurrence: ReminderOccurrence, idempotencyKey?: string): Promise<void>;
}

export interface CursorPage {
  changes: ChangeEnvelope[];
  nextCursor: string;
}

export class SyncEngineError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'VERSION_CONFLICT' | 'INVALID_TRANSITION' | 'IDEMPOTENCY_CONFLICT', message: string) {
    super(message);
    this.name = 'SyncEngineError';
  }
}
