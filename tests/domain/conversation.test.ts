import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConversation, type ConversationPort } from '@nuanban/application';
import type { ConversationEvent } from '@nuanban/contracts';
import { DemoConversation } from '@nuanban/mocks';

const started: ConversationEvent = { request_id: 'request', sequence: 0, type: 'started' };
const delta: ConversationEvent = { request_id: 'request', sequence: 1, type: 'delta', text: '下一步' };
const completed: ConversationEvent = { request_id: 'request', sequence: 2, type: 'completed' };
function port(events: ConversationEvent[]): ConversationPort {
  return { async *stream() { for (const event of events) yield event; } };
}
afterEach(() => vi.useRealTimers());

describe('流式消费与停止隔离', () => {
  it('只有按顺序完整结束才返回答案', async () => {
    const update = vi.fn();
    expect(await readConversation(port([started, delta, completed]), '怎么操作', new AbortController().signal, update)).toBe('下一步');
    expect(update).toHaveBeenCalledExactlyOnceWith('下一步', '下一步');
  });
  it.each([
    [], [delta, completed], [started, delta], [started, completed],
    [started, { ...delta, sequence: 3 }, completed],
    [started, { ...delta, request_id: 'other' }, completed],
    [started, { ...started, sequence: 1 }],
    [started, delta, completed, { ...delta, sequence: 3 }],
  ])('拒绝乱序、串线、空白或未完成的事件 %#', async (...events) => {
    await expect(readConversation(port(events), '怎么操作', new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });
  });
  it('已停止的请求不会调用供应适配器', async () => {
    const controller = new AbortController();
    controller.abort();
    const stream = vi.fn();
    await expect(readConversation({ stream }, '怎么操作', controller.signal, vi.fn())).rejects.toMatchObject({ name: 'AbortError' });
    expect(stream).not.toHaveBeenCalled();
  });
  it('不配合取消的来源也不能更新迟到字幕', async () => {
    const controller = new AbortController();
    const update = vi.fn();
    const source: ConversationPort = { async *stream() { yield started; controller.abort(); yield delta; yield completed; } };
    await expect(readConversation(source, '怎么操作', controller.signal, update)).rejects.toMatchObject({ name: 'AbortError' });
    expect(update).not.toHaveBeenCalled();
  });
  it('超长和空问题不会进入适配器', async () => {
    const stream = vi.fn();
    for (const text of ['', '  ', '字'.repeat(1501)]) await expect(readConversation({ stream }, text, new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(stream).not.toHaveBeenCalled();
  });
  it('累计答案有长度上限', async () => {
    const events = [started, ...Array.from({ length: 7 }, (_, index): ConversationEvent => ({ request_id: 'request', sequence: index + 1, type: 'delta', text: '字'.repeat(4000) }))];
    await expect(readConversation(port(events), '怎么操作', new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: 'STREAM_INTERRUPTED' });
  });
  it('长等待可以取消且计时器被清理', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const result = readConversation(new DemoConversation('loading'), '怎么操作', controller.signal, vi.fn());
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
