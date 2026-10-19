import { describe, expect, it } from 'vitest';
import { IndexedDbRepository } from '@nuanban/local-data';
import { emptyLocalSnapshot } from '../../apps/web/src/local-snapshot';
import { PetLibraryStore } from '../../apps/web/src/pet-library-store';
import { useApp } from '../../apps/web/src/store';

const now = new Date('2026-10-18T10:00:00.000Z');
const dueAt = '2026-10-19T10:00:00.000Z';

function fixture() {
  const repository = new IndexedDbRepository();
  const ownerId = 'pet-library-' + crypto.randomUUID();
  const store = new PetLibraryStore(repository, ownerId, () => new Date(now));
  return { repository, ownerId, store };
}

describe('桌宠内置学习档案与待办（真实 IndexedDB 仓储、隔离测试账号）', () => {
  it('初次读取不写入示例资料，第一次保存以空版本事务创建', async () => {
    const { repository, ownerId, store } = fixture();
    expect(await store.load()).toMatchObject({ notes: [], todos: [], outbox: [] });
    expect(await repository.load(ownerId)).toBeNull();
    const snapshot = await store.saveNote({ question: '如何保存文件', summary: '先选择文件夹，再确认文件名。' });
    expect(snapshot.notes).toHaveLength(1);
    expect(snapshot.notes[0]).toMatchObject({ ownerId, mastery: 'unmastered', version: 1 });
    expect(snapshot.outbox[0]).toMatchObject({ ownerId, entityId: snapshot.notes[0].id, entityType: 'note', version: 1 });
    expect(await new PetLibraryStore(repository, ownerId).load()).toEqual(snapshot);
  });

  it('编辑和本人掌握确认会递增版本，复习不自动掌握', async () => {
    const { store } = fixture();
    const first = await store.saveNote({ question: '保存文件', summary: '选择保存位置。' });
    const note = first.notes[0];
    const edited = await store.saveNote({ id: note.id, version: 1, question: note.question, summary: '先选择保存位置，再检查文件名。' });
    expect(edited.notes[0]).toMatchObject({ version: 2, mastery: 'unmastered' });
    const reviewed = await store.review(note.id, 2);
    expect(reviewed.notes[0]).toMatchObject({ reviewedAt: now.toISOString(), mastery: 'unmastered', masterySource: null, version: 3 });
    const mastered = await store.mastery(note.id, 3, true);
    expect(mastered.notes[0]).toMatchObject({ mastery: 'mastered', masterySource: 'user', version: 4 });
    expect(mastered.outbox).toHaveLength(4);
    await expect(store.mastery(note.id, 1, false)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await store.load()).notes[0].mastery).toBe('mastered');
  });

  it('秘密脱敏后再写入，非法标题和过去时间不创建资料', async () => {
    const { store } = fixture();
    const saved = await store.saveNote({ question: '验证码是123456', summary: '密码是abc123' });
    expect(JSON.stringify(saved)).not.toContain('123456');
    expect(JSON.stringify(saved)).not.toContain('abc123');
    await expect(store.saveNote({ question: '', summary: '学习要点' })).rejects.toThrow('标题');
    await expect(store.saveTodo({ title: '练习', dueAt: now.toISOString(), timezone: 'Asia/Shanghai', repeat: 'none', noteId: null })).rejects.toThrow('现在之后');
    await expect(store.saveTodo({ title: '练习', dueAt, timezone: 'not-a-timezone', repeat: 'none', noteId: null })).rejects.toThrow('时区');
    expect((await store.load()).todos).toEqual([]);
  });

  it('复习与完成待办一次事务保存，重复待办只产生下一项', async () => {
    const { store } = fixture();
    const first = await store.saveNote({ question: '怎样保存文件', summary: '检查文件夹和文件名。' });
    const note = first.notes[0];
    const scheduled = await store.saveTodo({ title: '复习保存文件', dueAt, timezone: 'Asia/Shanghai', repeat: 'daily', noteId: note.id });
    const todo = scheduled.todos[0];
    const completed = await store.complete(todo.id, 1, true);
    expect(completed.notes[0]).toMatchObject({ reviewedAt: now.toISOString(), mastery: 'unmastered', version: 2 });
    expect(completed.todos.find(item => item.id === todo.id)).toMatchObject({ completedAt: now.toISOString(), version: 2 });
    const pending = completed.todos.filter(item => !item.completedAt);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ dueAt: '2026-10-20T10:00:00.000Z', noteId: note.id, repeat: 'daily', version: 1 });
    expect(completed.outbox).toHaveLength(5);
    await expect(store.complete(todo.id, 1, true)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await store.load()).todos).toHaveLength(2);
  });

  it('删除笔记保留关联待办，缺失笔记不能伪造复习成功', async () => {
    const { store } = fixture();
    const first = await store.saveNote({ question: '怎样创建文件夹', summary: '亲手使用新建文件夹。' });
    const note = first.notes[0];
    const scheduled = await store.saveTodo({ title: '复习新建文件夹', dueAt, timezone: 'Asia/Shanghai', repeat: 'none', noteId: note.id });
    const todo = scheduled.todos[0];
    await store.remove('note', note.id, note.version);
    await expect(store.complete(todo.id, todo.version, true)).rejects.toThrow('笔记已移除');
    const preserved = await store.load();
    expect(preserved.todos[0]).toMatchObject({ noteId: note.id, completedAt: null, deletedAt: null });
    const completed = await store.complete(todo.id, todo.version);
    expect(completed.todos[0].completedAt).toBe(now.toISOString());
    const removed = await store.remove('todo', todo.id, completed.todos[0].version);
    expect(removed.todos[0].deletedAt).toBe(now.toISOString());
  });

  it('同一桌宠的连续写入串行保存，不丢掉前一条笔记', async () => {
    const { store } = fixture();
    await Promise.all([store.saveNote({ question: '第一条真实笔记', summary: '步骤一' }), store.saveNote({ question: '第二条真实笔记', summary: '步骤二' })]);
    expect((await store.load()).notes).toHaveLength(2);
  });

  it('两个窗口同时初始化只有一个成功，不覆盖先保存的笔记', async () => {
    const { repository, ownerId } = fixture();
    const first = emptyLocalSnapshot();
    const second = { ...emptyLocalSnapshot(), preferences: { ...first.preferences, muted: true } };
    const results = await Promise.allSettled([repository.commitIfUnchanged(ownerId, null, first), repository.commitIfUnchanged(ownerId, null, second)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await repository.load(ownerId)).toEqual(first);
  });

  it('客户端陈旧快照不能覆盖桌宠刚保存的笔记，刷新后可重试', async () => {
    const { repository, ownerId, store } = fixture();
    await useApp.getState().initialize({ ownerId, repository, conversation: { async *stream() { throw new Error('此资料测试不调用模型'); } } }, emptyLocalSnapshot);
    await store.saveNote({ question: '桌宠里记录的笔记', summary: '不可被客户端的旧快照覆盖。' });
    await expect(useApp.getState().preferences({ muted: true })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await repository.load(ownerId))?.notes).toHaveLength(1);
    expect(useApp.getState().snapshot?.notes).toHaveLength(1);
    await useApp.getState().preferences({ muted: true });
    expect((await store.load()).preferences.muted).toBe(true);
    expect((await store.load()).notes).toHaveLength(1);
  });
});
