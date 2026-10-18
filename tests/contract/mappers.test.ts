import { describe, expect, it } from 'vitest';
import { conversationEventMapper, localFamilyScopes, parseOwnedNote, parseOwnedTodo } from '../../packages/api-client/src/mappers';
import { readConversation } from '@nuanban/application';
import type { ResponseRequest } from '@nuanban/contracts';
import { fixture } from './fixtures';

const requestId = '00000000-0000-4000-8000-000000000001';
const sessionId = '00000000-0000-4000-8000-000000000002';
const context = { requestId, sessionId, generation: 2 };
function event(type: string, seq: number, payload: unknown = {}) {
  return { type, seq, payload, request_id: requestId, session_id: sessionId, generation: 2, event_id: `00000000-0000-4000-8000-${String(seq + 10).padStart(12, '0')}` };
}
const started = event('response.started', 0);
const caption = event('caption.segment', 1, { segment_id: sessionId, index: 0, text: '先打开设置。' });
const completed = event('response.completed', 2, { final_segment_count: 1 });

describe('服务 DTO 与内部用例的显式边界', () => {
  it('完整服务事件流映射到现有用例，完整结束才返回回答', async () => {
    const map = conversationEventMapper(context);
    const request: ResponseRequest = { input_id: requestId, generation: 2, text: '如何打开设置' };
    const port = { async *stream() { for (const item of [started, caption, completed]) yield map(item); } };
    expect(await readConversation(port, request.text!, new AbortController().signal, () => undefined)).toBe('先打开设置。');
    expect(() => map(completed)).toThrow();
  });
  it.each([
    { ...caption, request_id: sessionId },
    { ...caption, session_id: requestId },
    { ...caption, generation: 1 },
    { ...caption, seq: 2 },
    { ...caption, event_id: started.event_id },
    { ...caption, payload: { segment_id: sessionId, index: 1, text: '缺片段' } },
    event('guidance.low_confidence', 1, { action: 'request_help' }),
  ])('拒绝过期/跨会话/缺号/重复/串类型事件 %#', invalid => {
    const map = conversationEventMapper(context);
    map(started);
    expect(() => map(invalid)).toThrow();
  });
  it('缺少开始、结束片段数错误、失败和取消不能伪装成完成', () => {
    expect(() => conversationEventMapper(context)(caption)).toThrow();
    const map = conversationEventMapper(context);
    map(started); map(caption);
    expect(() => map(event('response.completed', 2, { final_segment_count: 2 }))).toThrow();
    const failed = conversationEventMapper(context); failed(started);
    expect(() => failed(event('response.failed', 1, { code: 'TIMEOUT', retryable: true }))).toThrow();
    const cancelled = conversationEventMapper(context); cancelled(started);
    expect(() => cancelled(event('response.cancelled', 1, { reason: 'user_stop' }))).toThrowError(DOMException);
  });
  it('账号、版本和时间顺序校验不丢弃来源与 tombstone', () => {
    const note = fixture('NoteDto');
    const todo = fixture('TodoDto');
    expect(parseOwnedNote(note, requestId)).toEqual(note);
    expect(parseOwnedTodo(todo, requestId)).toEqual(todo);
    expect(() => parseOwnedNote(note, sessionId)).toThrow();
    expect(() => parseOwnedNote(note, requestId, 2)).toThrow();
    expect(() => parseOwnedTodo({ ...todo, timezone: 'UTC+8' }, requestId)).toThrow();
    expect(() => parseOwnedNote({ ...note, updated_at: '2025-01-01T00:00:00Z' }, requestId)).toThrow();
    expect(() => parseOwnedNote({ ...note, deleted_at: '2025-01-01T00:00:00Z' }, requestId)).toThrow();
  });
  it('旧本地 scope 显式映射，不额外授予掌握或协助权限', () => {
    expect(localFamilyScopes(['notes:read', 'todos:write', 'notes:read'])).toEqual(['learning.read', 'todo.write']);
    expect(localFamilyScopes([])).toEqual([]);
    expect(() => localFamilyScopes(['unknown' as never])).toThrow();
  });
});
