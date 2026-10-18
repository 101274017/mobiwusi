import { describe, expect, it } from 'vitest';
import { IndexedDbRepository } from '@nuanban/local-data';
import { ScenarioRepository, createScenarioSnapshot } from '@nuanban/mocks';
import { conflictSelection, type LocalConflict } from '@nuanban/domain';
import { useApp } from '../../apps/web/src/store';

async function prepare(entity: 'note' | 'todo' = 'note') {
  const ownerId = crypto.randomUUID();
  const underlying = new IndexedDbRepository();
  const repository = new ScenarioRepository(underlying, 'version-conflict');
  await repository.load(ownerId);
  const initial = createScenarioSnapshot(ownerId, 'version-conflict');
  await repository.commit(ownerId, initial);
  const proposed = structuredClone(initial);
  if (entity === 'note') { proposed.notes[0].mastery = 'mastered'; proposed.notes[0].masterySource = 'user'; proposed.notes[0].version++; }
  else { proposed.todos[0].title = '本机修改提醒'; proposed.todos[0].version++; }
  await expect(repository.commit(ownerId, proposed)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  const preserved = (await underlying.load(ownerId))!;
  return { ownerId, underlying, repository, initial, preserved, draft: preserved.conflicts![0] };
}

describe('模拟资料冲突的比较、草稿持久化与明确选择', () => {
  it('明确清空资料也清除含有全文的冲突草稿，不被模拟冲突阻挡', async () => {
    const { ownerId, repository, underlying, initial } = await prepare();
    const conversation = { async *stream(): AsyncGenerator<never> { throw new Error('not connected'); } };
    await useApp.getState().initialize({ ownerId, repository, conversation }, () => initial);
    await useApp.getState().erase();
    const result = await underlying.load(ownerId);
    expect(result?.notes).toEqual([]);
    expect(result?.todos).toEqual([]);
    expect(result?.conflicts).toEqual([]);
  });
  it('失败只保留草稿，不改当前笔记；重开仍可比较', async () => {
    const { ownerId, underlying, preserved, initial, draft } = await prepare();
    expect(preserved.notes).toEqual(initial.notes);
    expect(draft.local).toMatchObject({ mastery: 'mastered', masterySource: 'user' });
    expect(draft.other).toMatchObject({ mastery: 'unmastered', version: 2 });
    const reopened = new ScenarioRepository(underlying, 'version-conflict');
    expect((await reopened.load(ownerId))?.conflicts).toEqual(preserved.conflicts);
  });
  it.each(['local', 'other'] as const)('明确选择 %s 并确认才更新当前内容', async choice => {
    const { ownerId, repository, underlying, draft } = await prepare();
    const result = await repository.resolveConflict(ownerId, draft.id, choice);
    expect(result.conflicts).toEqual([]);
    expect(result.notes.find(note => note.id === draft.local.id)?.mastery).toBe(choice === 'local' ? 'mastered' : 'unmastered');
    expect(result.outbox).toHaveLength(choice === 'local' ? 1 : 0);
    expect(await underlying.load(ownerId)).toEqual(result);
    await expect(repository.resolveConflict(ownerId, draft.id, choice)).rejects.toThrow('冲突已变化');
  });
  it('待办可以选择另一版本，不串号或影响笔记', async () => {
    const { ownerId, repository, draft, initial } = await prepare('todo');
    await expect(repository.resolveConflict(ownerId + '-other', draft.id, 'local')).rejects.toThrow();
    const next = await repository.resolveConflict(ownerId, draft.id, 'other');
    expect(next.todos[0].title).toContain('另一处演示版本');
    expect(next.notes).toEqual(initial.notes);
  });
  it('有新版本或另一份已删除时拒绝旧选择，保留草稿', async () => {
    const { ownerId, repository, underlying, preserved, draft } = await prepare();
    const changed = structuredClone(preserved); changed.notes[0].version = 5;
    await underlying.commit(ownerId, changed);
    await expect(repository.resolveConflict(ownerId, draft.id, 'local')).rejects.toThrow('已有新版本');
    expect((await underlying.load(ownerId))?.conflicts).toHaveLength(1);
    const deleted: LocalConflict = { ...draft, other: { ...draft.other, deletedAt: '2026-10-15T01:06:00Z' } } as LocalConflict;
    expect(() => conflictSelection(deleted, 'local', '2026-10-15T02:00:00Z')).toThrow('不能强制恢复');
    expect(conflictSelection(deleted, 'other', '2026-10-15T02:00:00Z').deletedAt).not.toBeNull();
  });
  it('原子比较写入避免两个页面同时用旧快照覆盖', async () => {
    const { ownerId, underlying, preserved } = await prepare();
    const first = { ...preserved, preferences: { ...preserved.preferences, captionSize: 38 } };
    const second = { ...preserved, preferences: { ...preserved.preferences, captionSize: 42 } };
    const results = await Promise.allSettled([underlying.commitIfUnchanged(ownerId, preserved, first), underlying.commitIfUnchanged(ownerId, preserved, second)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await underlying.load(ownerId))?.preferences.captionSize).toBe(38);
  });
});
