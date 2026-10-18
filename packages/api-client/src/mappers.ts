import type { AssistSignal, ConversationEvent, NoteDto, Scope, ServiceStreamEvent, TodoDto } from '@nuanban/contracts';
import { contractValidator } from '../../contracts/src/validation';
import { ServiceFailure } from '@nuanban/application';

export interface WireContext { requestId: string; sessionId: string; generation: number; }

export function conversationEventMapper(context: WireContext): (raw: unknown) => ConversationEvent {
  let sequence = 0;
  let segments = 0;
  let finished = false;
  const eventIds = new Set<string>();
  const segmentIds = new Set<string>();
  return raw => {
    if (finished || !contractValidator('ServiceStreamEvent')(raw)) throw new ServiceFailure('STREAM_INTERRUPTED', '讲解事件不符合服务契约。', true);
    const event = raw as ServiceStreamEvent;
    if (event.request_id !== context.requestId || event.session_id !== context.sessionId || event.generation !== context.generation || event.seq !== sequence || eventIds.has(event.event_id)) throw new ServiceFailure('STREAM_INTERRUPTED', '讲解事件的会话、代际或顺序不匹配。', true);
    if (sequence === 0 ? event.type !== 'response.started' : event.type === 'response.started') throw new ServiceFailure('STREAM_INTERRUPTED', '讲解缺少唯一的开始事件。', true);
    if (event.type === 'response.failed') { finished = true; throw new ServiceFailure(event.payload.code, '服务讲解失败，请重试或使用文字入口。', event.payload.retryable); }
    if (event.type === 'response.cancelled') { finished = true; throw new DOMException('服务已取消', 'AbortError'); }
    if (event.type === 'guidance.risk') { finished = true; throw new ServiceFailure('RISK_PAUSED', '检测到风险，已停止本次讲解，不保留后续远端状态。'); }
    if (event.type === 'guidance.low_confidence') { finished = true; throw new ServiceFailure('LOW_CONFIDENCE', '无法可靠识别当前内容，已停止本次讲解。', true); }
    if (event.type === 'response.completed') {
      if (event.payload.final_segment_count !== segments) throw new ServiceFailure('STREAM_INTERRUPTED', '讲解片段缺失，未保存学习摘要。', true);
      finished = true;
    } else if (event.type === 'caption.segment') {
      if (event.payload.index !== segments || segmentIds.has(event.payload.segment_id)) throw new ServiceFailure('STREAM_INTERRUPTED', '讲解字幕片段重复或缺失。', true);
      segmentIds.add(event.payload.segment_id);
      segments++;
    } else if (event.type !== 'response.started') throw new ServiceFailure('STREAM_INTERRUPTED', '收到不属于讲解流的事件。', true);
    const mapped: ConversationEvent = event.type === 'caption.segment'
      ? { request_id: event.request_id, sequence, type: 'delta', text: event.payload.text }
      : { request_id: event.request_id, sequence, type: event.type === 'response.started' ? 'started' : 'completed' };
    eventIds.add(event.event_id);
    sequence++;
    return mapped;
  };
}

export interface FeatureStreamContext {
  requestId?: string;
  sessionId?: string;
  generation?: number;
}

export interface ServiceStreamMapperOptions {
  allowedTypes?: readonly ServiceStreamEvent['type'][];
  terminalTypes?: readonly ServiceStreamEvent['type'][];
}

export function serviceStreamEventMapper(context: FeatureStreamContext, options: ServiceStreamMapperOptions = {}): (raw: unknown) => ServiceStreamEvent {
  let sequence = 0;
  let requestId = context.requestId;
  let sessionId = context.sessionId;
  let generation = context.generation;
  let finished = false;
  const eventIds = new Set<string>();
  return raw => {
    if (finished || !contractValidator('ServiceStreamEvent')(raw)) throw new ServiceFailure('STREAM_INTERRUPTED', '业务事件不符合服务契约。', true);
    const event = raw as ServiceStreamEvent;
    if (requestId === undefined) requestId = event.request_id;
    if (sessionId === undefined) sessionId = event.session_id;
    if (generation === undefined) generation = event.generation;
    if (event.request_id !== requestId || event.session_id !== sessionId || event.generation !== generation || event.seq !== sequence || eventIds.has(event.event_id)) {
      throw new ServiceFailure('STREAM_INTERRUPTED', '业务事件的会话、代际或顺序不匹配。', true);
    }
    if (options.allowedTypes && !options.allowedTypes.includes(event.type)) throw new ServiceFailure('STREAM_INTERRUPTED', '业务事件类型与当前 adapter 不匹配。', true);
    eventIds.add(event.event_id);
    sequence++;
    if (options.terminalTypes?.includes(event.type)) finished = true;
    return structuredClone(event);
  };
}

export interface AssistSignalContext extends FeatureStreamContext {
  assistId: string;
  grantRevision?: number;
}

export function assistSignalMapper(context: AssistSignalContext): (raw: unknown) => AssistSignal {
  let sequence = 0;
  let requestId = context.requestId;
  let sessionId = context.sessionId;
  let generation = context.generation;
  let finished = false;
  const eventIds = new Set<string>();
  return raw => {
    if (finished || !contractValidator('AssistSignal')(raw)) throw new ServiceFailure('STREAM_INTERRUPTED', '协助信令不符合服务契约。', true);
    const event = raw as AssistSignal;
    if (requestId === undefined) requestId = event.request_id;
    if (sessionId === undefined) sessionId = event.session_id;
    if (generation === undefined) generation = event.generation;
    if (event.request_id !== requestId || event.session_id !== sessionId || event.generation !== generation || event.seq !== sequence || eventIds.has(event.event_id)) {
      throw new ServiceFailure('STREAM_INTERRUPTED', '协助信令的会话、代际或顺序不匹配。', true);
    }
    if (event.payload.assist_id !== context.assistId) throw new ServiceFailure('SCOPE_DENIED', '协助信令不属于当前协助会话。');
    if (context.grantRevision !== undefined && 'grant_revision' in event.payload && event.payload.grant_revision !== context.grantRevision) {
      throw new ServiceFailure('SCOPE_DENIED', '协助信令的授权版本已失效。');
    }
    eventIds.add(event.event_id);
    sequence++;
    if (event.type === 'end') finished = true;
    return structuredClone(event);
  };
}

function owned<T extends { owner_id: string; version: number; created_at: string; updated_at: string; deleted_at: string | null }>(name: string, raw: unknown, ownerId: string, minimumVersion: number): T {
  if (!contractValidator(name)(raw)) throw new ServiceFailure('INVALID_REQUEST', '档案数据不符合服务契约。');
  const record = raw as T;
  if (record.owner_id !== ownerId) throw new ServiceFailure('SCOPE_DENIED', '这份资料不属于当前账号。');
  if (record.version < minimumVersion) throw new ServiceFailure('VERSION_CONFLICT', '不能用旧版本覆盖当前资料。');
  if (Date.parse(record.updated_at) < Date.parse(record.created_at) || (record.deleted_at && Date.parse(record.deleted_at) < Date.parse(record.created_at))) throw new ServiceFailure('INVALID_REQUEST', '档案时间顺序无效。');
  return structuredClone(record);
}

export const parseOwnedNote = (raw: unknown, ownerId: string, minimumVersion = 1): NoteDto => owned<NoteDto>('NoteDto', raw, ownerId, minimumVersion);
export const parseOwnedTodo = (raw: unknown, ownerId: string, minimumVersion = 1): TodoDto => owned<TodoDto>('TodoDto', raw, ownerId, minimumVersion);

export function localFamilyScopes(scopes: readonly ('notes:read' | 'todos:write')[]): Scope[] {
  return [...new Set(scopes.map(scope => {
    if (scope === 'notes:read') return 'learning.read' as const;
    if (scope === 'todos:write') return 'todo.write' as const;
    throw new ServiceFailure('SCOPE_DENIED', '未知本地权限，不能推断或扩大授权。');
  }))];
}
