import type { Note, Todo } from './index';

interface ConflictBase { id: string; ownerId: string; baseVersion: number; createdAt: string; source: 'local'; }
export type LocalConflict = ConflictBase & ({ entityType: 'note'; local: Note; other: Note } | { entityType: 'todo'; local: Todo; other: Todo });
export type ConflictChoice = 'local' | 'other';

export function conflictSelection(conflict: LocalConflict, choice: ConflictChoice, now: string): Note | Todo {
  if (choice !== 'local' && choice !== 'other') throw new Error('请明确选择保留哪一份内容。');
  if (choice === 'local' && conflict.other.deletedAt) throw new Error('另一版本已删除，不能强制恢复；本机草稿继续保留。');
  const record = structuredClone(choice === 'local' ? conflict.local : conflict.other);
  if (record.ownerId !== conflict.ownerId || record.id !== conflict.other.id || record.id !== conflict.local.id) throw new Error('冲突资料与当前账号不匹配。');
  if (choice === 'local') { record.version = Math.max(conflict.local.version, conflict.other.version) + 1; record.updatedAt = now; }
  return record;
}
