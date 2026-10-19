import type { LocalSnapshot } from '@nuanban/application';
import { localInstant, type Note, type Todo } from '@nuanban/domain';
import type { PetTodoInput } from './pet-library-store';
import { petLibrary as store } from './pet-library-composition';

const element = <ElementType extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as ElementType;
const input = (id: string) => element<HTMLInputElement>(id);
const editor = (id: string) => element<HTMLDetailsElement>(id);
const select = (id: string) => element<HTMLSelectElement>(id);
const repeatLabels = { none: '仅这一次', daily: '每天同一时间', weekly: '每周同一天' };
let snapshot: LocalSnapshot | null = null;
let available = false;
let loading = false;
let saving = false;
let disposed = false;
let activeSection: string | null = null;
let todoFilter: 'pending' | 'due' | 'completed' = 'pending';
let editingNote: { id: string; version: number } | undefined;
let editingTodo: { id: string; version: number } | undefined;
let pendingDelete: { kind: 'note' | 'todo'; id: string } | undefined;
let confirmedTodo = '';

function make<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, text = '', className = ''): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function dateLabel(value: string | null, timezone?: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '尚无记录';
  try { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', ...(timezone ? { timeZone: timezone } : {}) }).format(new Date(value)); }
  catch { return '时间或时区待核对'; }
}

function setStatus(page: 'archive' | 'todos', message: string): void { element(page + '-status').textContent = message; }

function setError(page: 'archive' | 'todos', error?: unknown): void {
  const target = element(page + '-error');
  target.textContent = error ? error instanceof Error ? error.message : '本机资料暂时不可用，请刷新后重试。' : '';
  target.hidden = !error;
}

function navigate(section: string): void {
  window.dispatchEvent(new CustomEvent('nuanban:pet:navigate', { detail: { section } }));
}

function action(label: string, key: string, callback: () => void, write = true): HTMLButtonElement {
  const button = make('button', label);
  button.type = 'button';
  button.dataset.libraryFocus = key;
  if (write) button.dataset.libraryWrite = 'true';
  button.addEventListener('click', () => { if (!write || (available && !saving && !loading)) callback(); });
  return button;
}

function removal(kind: 'note' | 'todo', entity: Note | Todo): HTMLElement {
  const pending = pendingDelete?.kind === kind && pendingDelete.id === entity.id;
  const row = make('div', '', pending ? 'library-confirmation' : 'button-row');
  if (pending) {
    row.append(make('p', kind === 'note' ? '确认删除这条笔记？关联待办会保留，并提示笔记已移除。' : '确认删除这项待办？关联学习笔记不会被删除。'));
    const controls = make('div', '', 'button-row');
    controls.append(action(kind === 'note' ? '确认删除笔记' : '确认删除待办', kind + '/' + entity.id + '/confirm-delete', () => {
      void write(kind === 'note' ? 'archive' : 'todos', () => store.remove(kind, entity.id, entity.version), kind === 'note' ? '笔记已从本机列表移除，关联待办仍保留。' : '待办已删除，不会再显示到期入口。');
    }), action('保留', kind + '/' + entity.id + '/keep', () => { pendingDelete = undefined; render(); }));
    row.append(controls);
  } else {
    const button = action(kind === 'note' ? '删除笔记' : '删除待办', kind + '/' + entity.id + '/delete', () => {
      pendingDelete = { kind, id: entity.id };
      render();
      focusKey(kind + '/' + entity.id + '/confirm-delete');
    });
    button.classList.add('danger-button');
    row.append(button);
  }
  return row;
}

function focusKey(key: string): void {
  [...document.querySelectorAll<HTMLElement>('[data-library-focus]')].find(node => node.dataset.libraryFocus === key)?.focus({ preventScroll: true });
}

function openRecords(list: HTMLElement): Set<string> {
  return new Set([...list.querySelectorAll<HTMLDetailsElement>('details[open]')].map(node => node.dataset.libraryId!));
}

function renderArchive(): void {
  const list = element('archive-list');
  const open = openRecords(list);
  const search = input('archive-search').value.trim().toLocaleLowerCase();
  const filter = select('archive-filter').value;
  const all = snapshot?.notes.filter(note => !note.deletedAt) ?? [];
  const notes = all.filter(note => (filter === 'all' || note.mastery === filter) && (note.question + ' ' + note.topic + ' ' + note.summary).toLocaleLowerCase().includes(search));
  element('archive-count').textContent = snapshot ? '共 ' + all.length + ' 条笔记 · 当前显示 ' + notes.length + ' 条' : '';
  const fragment = document.createDocumentFragment();
  for (const note of notes) {
    const item = make('li', '', 'library-card');
    const detail = make('details');
    detail.dataset.libraryId = note.id;
    detail.open = open.has(note.id);
    const summary = make('summary', note.topic || note.question);
    summary.dataset.libraryFocus = 'note/' + note.id + '/summary';
    const meta = make('span', (note.mastery === 'mastered' ? '本人确认掌握' : '还想再练') + ' · ' + dateLabel(note.createdAt), 'library-meta');
    const body = make('div', '', 'library-body');
    body.append(make('strong', '当时的问题'), make('p', note.question, 'library-content'), make('strong', '记住的要点'), make('p', note.summary, 'library-content'), make('p', '最近复习：' + dateLabel(note.reviewedAt), 'library-meta'));
    const controls = make('div', '', 'button-row');
    controls.append(
      action('编辑笔记', 'note/' + note.id + '/edit', () => openNote(note)),
      action(note.mastery === 'mastered' ? '改为待练习' : '我确认已掌握', 'note/' + note.id + '/mastery', () => { void write('archive', () => store.mastery(note.id, note.version, note.mastery !== 'mastered'), '掌握状态已按你的选择保存。'); }),
      action('记一次复习', 'note/' + note.id + '/review', () => { void write('archive', () => store.review(note.id, note.version), '本次复习已记录，掌握状态保持不变。'); }),
      action('安排复习', 'note/' + note.id + '/schedule', () => { navigate('todos'); openTodo(undefined, note); }),
    );
    body.append(controls, removal('note', note));
    detail.append(summary, meta, body);
    item.append(detail);
    fragment.append(item);
  }
  if (!notes.length) fragment.append(make('li', snapshot ? all.length ? '没有符合条件的笔记，试试其他关键词或掌握状态。' : '还没有笔记。点击“记一条笔记”，把真正学到的内容收好。' : '本机笔记尚未读取，请稍候或点击刷新资料。', 'library-empty'));
  list.replaceChildren(fragment);
}

function renderTodos(): void {
  const list = element('todos-list');
  const open = openRecords(list);
  const now = Date.now();
  const all = snapshot?.todos.filter(todo => !todo.deletedAt) ?? [];
  const due = all.filter(todo => !todo.completedAt && Date.parse(todo.dueAt) <= now);
  const todos = all.filter(todo => todoFilter === 'completed' ? Boolean(todo.completedAt) : !todo.completedAt && (todoFilter !== 'due' || Date.parse(todo.dueAt) <= now)).sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt));
  element('todos-count').textContent = snapshot ? '待完成 ' + all.filter(todo => !todo.completedAt).length + ' 项 · 已到期 ' + due.length + ' 项 · 当前显示 ' + todos.length + ' 项' : '';
  for (const filter of ['pending', 'due', 'completed']) element('todos-' + filter).setAttribute('aria-pressed', String(todoFilter === filter));
  const shortcut = element<HTMLButtonElement>('pet-due-todos');
  shortcut.hidden = !available || !due.length;
  shortcut.textContent = '到期待办 ' + due.length + ' 项 · 在桌宠查看';
  window.dispatchEvent(new CustomEvent('nuanban:pet:due-todos', { detail: { keys: available ? due.map(todo => JSON.stringify([todo.id, todo.dueAt])) : [] } }));
  const fragment = document.createDocumentFragment();
  for (const todo of todos) {
    const item = make('li', '', 'library-card');
    item.dataset.due = String(!todo.completedAt && Date.parse(todo.dueAt) <= now);
    const detail = make('details');
    detail.dataset.libraryId = todo.id;
    detail.open = open.has(todo.id);
    const summary = make('summary', todo.title);
    summary.dataset.libraryFocus = 'todo/' + todo.id + '/summary';
    const meta = make('span', (todo.completedAt ? '已完成' : Date.parse(todo.dueAt) <= now ? '已到期' : '待完成') + ' · ' + dateLabel(todo.dueAt, todo.timezone), 'library-meta');
    const body = make('div', '', 'library-body');
    body.append(make('p', '时区：' + todo.timezone + ' · ' + (repeatLabels[todo.repeat] ?? '重复方式待核对'), 'library-meta'));
    const note = snapshot?.notes.find(note => note.id === todo.noteId && !note.deletedAt);
    const controls = make('div', '', 'button-row');
    if (todo.noteId) {
      body.append(make('strong', note ? '复习笔记：' + note.topic : '关联笔记已移除'), make('p', note ? note.summary : '待办仍保留；可完成待办、重新关联其他笔记或删除待办。', 'library-content'));
      if (note) controls.append(action('查看学习笔记', 'todo/' + todo.id + '/note', () => showNote(note.id), false));
    }
    if (!todo.completedAt) {
      if (note) controls.append(action('我已复习，完成待办', 'todo/' + todo.id + '/review', () => { void write('todos', () => store.complete(todo.id, todo.version, true), '已记录复习并完成待办，笔记掌握状态未改变。'); }));
      controls.append(action('完成待办', 'todo/' + todo.id + '/complete', () => { void write('todos', () => store.complete(todo.id, todo.version), '待办已完成；重复待办会安排下一次，掌握状态不会自动改变。'); }), action('修改提醒', 'todo/' + todo.id + '/edit', () => openTodo(todo)));
    } else body.append(make('p', '完成于 ' + dateLabel(todo.completedAt), 'library-meta'));
    body.append(controls, removal('todo', todo));
    detail.append(summary, meta, body);
    item.append(detail);
    fragment.append(item);
  }
  if (!todos.length) fragment.append(make('li', !snapshot ? '本机待办尚未读取，请稍候或点击刷新资料。' : todoFilter === 'due' ? '目前没有到期待办。按自己的节奏来就好。' : todoFilter === 'completed' ? '还没有完成记录，完成一项真实待办后会出现在这里。' : '暂时没有待办。可以亲手添加，或从学习笔记安排复习。', 'library-empty'));
  list.replaceChildren(fragment);
}

function renderNoteOptions(): void {
  const target = select('todo-note');
  const selected = target.value;
  const options = [new Option('不关联笔记', '')];
  for (const note of snapshot?.notes.filter(note => !note.deletedAt) ?? []) options.push(new Option(note.topic, note.id));
  if (selected && !options.some(option => option.value === selected)) options.push(new Option('已移除的笔记（请重新选择）', selected));
  target.replaceChildren(...options);
  target.value = selected;
}

function renderAvailability(): void {
  const disabled = !available || loading || saving;
  for (const root of ['archive-view', 'todos-view']) element(root).setAttribute('aria-busy', String(loading || saving));
  for (const control of document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-library-write], #archive-add, #todos-add, #archive-form input, #archive-form textarea, #archive-form button, #todo-form input, #todo-form select, #todo-form button')) control.disabled = disabled;
  for (const root of ['archive-refresh', 'todos-refresh']) element<HTMLButtonElement>(root).disabled = loading || saving;
}

function render(): void {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.libraryFocus : undefined;
  renderArchive();
  renderTodos();
  renderNoteOptions();
  renderAvailability();
  if (focused) focusKey(focused);
}

async function refresh(manual = false): Promise<void> {
  if (disposed || loading || saving) return;
  loading = true;
  renderAvailability();
  try {
    const next = await store.load();
    if (disposed) return;
    const firstRead = !snapshot;
    snapshot = next;
    available = true;
    if (firstRead || manual) for (const page of ['archive', 'todos'] as const) {
      setStatus(page, manual ? '已重新读取本机资料，未更改编辑草稿。' : '本机资料已就绪，不会自动上云。');
      setError(page);
    }
  } catch (error) {
    if (disposed) return;
    available = false;
    for (const page of ['archive', 'todos'] as const) { setError(page, error); setStatus(page, '本机资料读取失败，写入已暂停；可以点击刷新资料重试。'); }
  } finally {
    loading = false;
    if (!disposed) render();
  }
}

async function write(page: 'archive' | 'todos', operation: () => Promise<LocalSnapshot>, message: string): Promise<boolean> {
  if (disposed || !available || saving || loading) return false;
  saving = true;
  setError(page);
  setStatus(page, '正在保存到本机…');
  renderAvailability();
  let saved = false;
  try {
    const next = await operation();
    if (disposed) return false;
    snapshot = next;
    pendingDelete = undefined;
    setStatus(page, message);
    saved = true;
    return true;
  } catch (error) {
    if (!disposed) { setError(page, error); setStatus(page, '修改未保存，编辑草稿仍保留；不会自动覆盖其他窗口的资料。'); }
    return false;
  } finally {
    saving = false;
    if (!disposed) { render(); if (!saved) void refresh(); }
  }
}

function openNote(note?: Note): void {
  editingNote = note ? { id: note.id, version: note.version } : undefined;
  editor('archive-editor').hidden = false;
  editor('archive-editor').open = true;
  element('archive-editor-title').textContent = note ? '编辑这条学习笔记' : '记下这次学到的';
  input('archive-question').value = note?.question ?? '';
  element<HTMLTextAreaElement>('archive-summary').value = note?.summary ?? '';
  input('archive-question').focus();
}

function closeNote(): void {
  editor('archive-editor').hidden = true;
  editingNote = undefined;
  element<HTMLFormElement>('archive-form').reset();
  element('archive-add').focus({ preventScroll: true });
}

function datetimeInput(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function invalidateTodo(): void {
  confirmedTodo = '';
  element('todo-confirmation').hidden = true;
  element('todo-save').textContent = '下一步：核对提醒时间';
}

function openTodo(todo?: Todo, note?: Note): void {
  editingTodo = todo ? { id: todo.id, version: todo.version } : undefined;
  editor('todo-editor').hidden = false;
  editor('todo-editor').open = true;
  element('todo-editor-title').textContent = todo ? '修改这个提醒' : note ? '给这条笔记安排复习' : '添加一个温暖提醒';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  input('todo-title').value = todo?.title ?? (note ? '复习：' + note.topic : '');
  input('todo-time').value = datetimeInput(todo?.dueAt ?? tomorrow.toISOString());
  select('todo-repeat').value = todo?.repeat ?? 'none';
  select('todo-note').value = todo?.noteId ?? note?.id ?? '';
  element('todo-timezone').textContent = '本次使用时区：' + Intl.DateTimeFormat().resolvedOptions().timeZone + '。保存前会再次复述时间。';
  invalidateTodo();
  editor('todo-editor').scrollIntoView({ block: 'start' });
  input('todo-title').focus({ preventScroll: true });
}

function closeTodo(): void {
  editor('todo-editor').hidden = true;
  editingTodo = undefined;
  element<HTMLFormElement>('todo-form').reset();
  invalidateTodo();
  element('todos-add').focus({ preventScroll: true });
}

function showNote(id: string): void {
  input('archive-search').value = '';
  select('archive-filter').value = 'all';
  navigate('archive');
  render();
  const detail = [...element('archive-list').querySelectorAll<HTMLDetailsElement>('details')].find(node => node.dataset.libraryId === id);
  if (detail) { detail.open = true; detail.scrollIntoView({ block: 'start' }); focusKey('note/' + id + '/summary'); }
}

element('archive-add').addEventListener('click', () => openNote());
element('archive-cancel').addEventListener('click', closeNote);
element('archive-search').addEventListener('input', render);
element('archive-filter').addEventListener('change', render);
element('archive-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = { ...editingNote, question: input('archive-question').value, summary: element<HTMLTextAreaElement>('archive-summary').value };
  void write('archive', () => store.saveNote(value), '学习笔记已保存在本机。').then(saved => { if (saved) closeNote(); });
});
element('todos-add').addEventListener('click', () => openTodo());
element('todo-cancel').addEventListener('click', closeTodo);
element('todo-form').addEventListener('input', invalidateTodo);
element('todo-form').addEventListener('change', invalidateTodo);
element('todo-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!available || saving || loading) return;
  setError('todos');
  try {
    const value: PetTodoInput = { ...editingTodo, title: input('todo-title').value.trim(), dueAt: localInstant(input('todo-time').value), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, repeat: select('todo-repeat').value as Todo['repeat'], noteId: select('todo-note').value || null };
    if (!value.title || value.title.length > 120 || Date.parse(value.dueAt) <= Date.now()) throw new Error('请填写标题，并选择现在之后的有效提醒时间。');
    const signature = JSON.stringify(value);
    if (confirmedTodo !== signature) {
      confirmedTodo = signature;
      element('todo-confirmation-text').textContent = dateLabel(value.dueAt, value.timezone) + '（' + value.timezone + '），提醒你「' + value.title + '」。' + repeatLabels[value.repeat] + '。';
      element('todo-confirmation').hidden = false;
      element('todo-save').textContent = '确认这个时间并保存';
      element('todo-confirmation').scrollIntoView({ block: 'nearest' });
      return;
    }
    void write('todos', () => store.saveTodo(value), '提醒已保存在本机；桌宠运行时会显示到期待办入口。').then(saved => { if (saved) closeTodo(); });
  } catch (error) { invalidateTodo(); setError('todos', error); }
});
for (const page of ['archive', 'todos']) element(page + '-refresh').addEventListener('click', () => { void refresh(true); });
for (const filter of ['pending', 'due', 'completed'] as const) element('todos-' + filter).addEventListener('click', () => { todoFilter = filter; render(); });
element('pet-due-todos').addEventListener('click', () => { todoFilter = 'due'; render(); });
window.addEventListener('nuanban:pet:show-due-todos', () => { todoFilter = 'due'; render(); });
window.addEventListener('nuanban:pet:view-changed', event => {
  activeSection = (event as CustomEvent<{ section: string | null }>).detail.section;
  pendingDelete = undefined;
  if (activeSection === 'archive' || activeSection === 'todos') void refresh();
});
const onFocus = () => { if (activeSection === 'archive' || activeSection === 'todos') void refresh(); };
window.addEventListener('focus', onFocus);
const refreshTimer = window.setInterval(() => { void refresh(); }, 15000);
window.addEventListener('pagehide', () => { disposed = true; window.clearInterval(refreshTimer); window.removeEventListener('focus', onFocus); }, { once: true });
render();
void refresh();
