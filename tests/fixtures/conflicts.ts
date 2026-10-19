import { LocalConflictFailure, ServiceFailure, type LocalSnapshot, type Repository } from '@nuanban/application';
import { conflictSelection, type LocalConflict, type ConflictChoice } from '@nuanban/domain';

export async function preserveMockConflicts(repository: Repository, ownerId: string, proposed: LocalSnapshot): Promise<never> {
  const current = await repository.load(ownerId);
  if (!current) throw new ServiceFailure('VERSION_CONFLICT', '当前资料无法读取，修改未保存。');
  const drafts: LocalConflict[] = [];
  const createdAt = '2026-10-15T01:05:00.000Z';
  for (const note of proposed.notes) {
    const original = current.notes.find(item => item.id === note.id);
    if (JSON.stringify(original) === JSON.stringify(note)) continue;
    if (note.ownerId !== ownerId) throw new ServiceFailure('SCOPE_DENIED', '不能保存其他账号的草稿。');
    const updatedAt = new Date(Math.max(Date.parse((original ?? note).updatedAt), Date.parse(createdAt))).toISOString();
    const other = { ...structuredClone(original ?? note), summary: (original ?? note).summary + '\n合成另一版本：复习前先核对手机菜单。', version: (original?.version ?? 0) + 1, updatedAt };
    drafts.push({ id: `mock-note-${note.id}`, ownerId, baseVersion: original?.version ?? 0, createdAt, source: 'local', entityType: 'note', local: structuredClone(note), other });
  }
  for (const todo of proposed.todos) {
    const original = current.todos.find(item => item.id === todo.id);
    if (JSON.stringify(original) === JSON.stringify(todo)) continue;
    if (todo.ownerId !== ownerId) throw new ServiceFailure('SCOPE_DENIED', '不能保存其他账号的草稿。');
    const updatedAt = new Date(Math.max(Date.parse((original ?? todo).updatedAt), Date.parse(createdAt))).toISOString();
    const other = { ...structuredClone(original ?? todo), title: '另一处演示版本：' + (original ?? todo).title, version: (original?.version ?? 0) + 1, updatedAt };
    drafts.push({ id: `mock-todo-${todo.id}`, ownerId, baseVersion: original?.version ?? 0, createdAt, source: 'local', entityType: 'todo', local: structuredClone(todo), other });
  }
  if (!drafts.length) throw new ServiceFailure('VERSION_CONFLICT', '演示版本冲突：修改未保存，已保留原版本。请核对内容，不会自动覆盖。');
  const ids = new Set(drafts.map(draft => draft.id));
  const preserved = { ...current, conflicts: [...(current.conflicts ?? []).filter(draft => !ids.has(draft.id)), ...drafts] };
  if (repository.commitIfUnchanged) await repository.commitIfUnchanged(ownerId, current, preserved);
  else await repository.commit(ownerId, preserved);
  throw new LocalConflictFailure(preserved);
}

export async function resolveMockConflict(repository: Repository, ownerId: string, id: string, choice: ConflictChoice): Promise<LocalSnapshot> {
  const current = await repository.load(ownerId);
  const draft = current?.conflicts?.find(item => item.id === id && item.ownerId === ownerId && item.source === 'local');
  if (!current || !draft) throw new ServiceFailure('VERSION_CONFLICT', '冲突已变化或不属于当前账号，请重新读取。');
  const records = draft.entityType === 'note' ? current.notes : current.todos;
  if ((records.find(item => item.id === draft.local.id)?.version ?? 0) !== draft.baseVersion) throw new ServiceFailure('VERSION_CONFLICT', '当前资料已有新版本，不能用旧冲突选择覆盖。草稿仍保留。');
  const now = new Date(Math.max(Date.parse(draft.local.updatedAt), Date.parse(draft.other.updatedAt)) + 1000).toISOString();
  const selected = conflictSelection(draft, choice, now);
  const next = structuredClone(current);
  if (draft.entityType === 'note') next.notes = [...next.notes.filter(item => item.id !== selected.id), selected as typeof next.notes[number]];
  else next.todos = [...next.todos.filter(item => item.id !== selected.id), selected as typeof next.todos[number]];
  next.conflicts = next.conflicts?.filter(item => item.id !== id);
  next.outbox = next.outbox.filter(item => !(item.entityType === draft.entityType && item.entityId === selected.id));
  if (choice === 'local') next.outbox.push({ id: crypto.randomUUID(), ownerId, entityId: selected.id, entityType: draft.entityType, version: selected.version, status: 'pending', createdAt: now });
  if (repository.commitIfUnchanged) await repository.commitIfUnchanged(ownerId, current, next);
  else await repository.commit(ownerId, next);
  return next;
}
