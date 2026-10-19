export type Mode = 'elder' | 'child' | 'accessible';
export { conflictSelection } from './conflicts';
export type { LocalConflict, ConflictChoice } from './conflicts';
export type Mastery = 'unmastered' | 'mastered';
export type Risk = 'safe' | 'private' | 'transaction' | 'unknown' | 'medical' | 'investment';
export interface Entity { id: string; ownerId: string; createdAt: string; updatedAt: string; version: number; deletedAt: string | null; }
export interface Note extends Entity { question: string; topic: string; summary: string; mastery: Mastery; masterySource: 'user' | null; reviewedAt: string | null; source: 'demo' | 'conversation' | 'guidance'; }
export interface Todo extends Entity { title: string; dueAt: string; timezone: string; noteId: string | null; completedAt: string | null; repeat: 'none' | 'daily' | 'weekly'; source: 'self' | 'review'; }
export interface PetAppearance { eyes: 'round' | 'happy' | 'sleepy'; mouth: 'smile' | 'small' | 'open'; color: string; action: 'idle' | 'greeting' | 'celebrating'; }
export interface PetConfiguration { kind: 'cat' | 'rabbit' | 'dog'; appearance: PetAppearance; }
export interface Preferences { mode: Mode; fontScale: number; captionSize: number; muted: boolean; speechRate: number; reducedMotion: boolean; pet: 'cat' | 'rabbit' | 'dog'; petColor: string; petAppearance?: Omit<PetAppearance, 'color'>; previousPet?: PetConfiguration | null; petRevision?: number; }
export interface Family { id: string; name: string; relation: string; status: 'active' | 'revoked'; scopes: ('notes:read' | 'todos:write')[]; }
export interface OutboxEntry { id: string; ownerId: string; entityId: string; entityType: 'note' | 'todo'; version: number; status: 'pending'; createdAt: string; }
export type GuideState = 'idle' | 'await_consent' | 'analyzing' | 'await_action' | 'verifying' | 'completed' | 'need_help' | 'risk_paused' | 'ended';
export interface GuideSession { state: GuideState; generation: number; step: number; failures: number; risk: Risk; }
export type GuideEvent = { type: 'START' } | { type: 'CONSENT' } | { type: 'TARGET'; generation: number } | { type: 'LOW_CONFIDENCE'; generation: number } | { type: 'USER_DONE' } | { type: 'VERIFY'; matched: boolean; final?: boolean; generation: number } | { type: 'RISK'; risk: Risk } | { type: 'RESUME' } | { type: 'STOP' };
export const initialGuide: GuideSession = { state: 'idle', generation: 0, step: 0, failures: 0, risk: 'unknown' };
export function guideReducer(state: GuideSession, event: GuideEvent): GuideSession {
  if (event.type === 'STOP') return { ...state, state: 'ended', generation: state.generation + 1, risk: 'unknown' };
  if ('generation' in event && event.generation !== state.generation) return state;
  if (event.type === 'START' && ['idle','ended','completed'].includes(state.state)) return { ...initialGuide, state: 'await_consent', generation: state.generation + 1 };
  if (event.type === 'CONSENT' && state.state === 'await_consent') return { ...state, state: 'analyzing', risk: 'safe' };
  if (event.type === 'RISK' && !['idle','ended','completed'].includes(state.state) && event.risk !== 'safe') return { ...state, state: 'risk_paused', risk: event.risk, generation: state.generation + 1 };
  if (event.type === 'RESUME' && state.state === 'risk_paused') return { ...state, state: 'await_consent', generation: state.generation + 1, risk: 'unknown' };
  if (event.type === 'LOW_CONFIDENCE' && state.state === 'analyzing') return { ...state, state: 'need_help', generation: state.generation + 1 };
  if (event.type === 'TARGET' && state.state === 'analyzing' && state.risk === 'safe') return { ...state, state: 'await_action' };
  if (event.type === 'USER_DONE' && state.state === 'await_action') return { ...state, state: 'verifying' };
  if (event.type === 'VERIFY' && state.state === 'verifying') {
    if (event.matched) return { ...state, state: event.final ? 'completed' : 'analyzing', step: state.step + 1, failures: 0 };
    const failures = state.failures + 1;
    return { ...state, state: failures >= 3 ? 'need_help' : 'analyzing', failures };
  }
  return state;
}
export function detectTextRisk(text: string): Risk {
  if (/转账|支付|付款|验证码|银行卡|汇款|充值/.test(text)) return 'transaction';
  if (/密码|私人聊天|身份证|账户口令/.test(text)) return 'private';
  if (/药量|剂量|停药|吃什么药|诊断|用药方案/.test(text)) return 'medical';
  if (/买什么股票|投资建议|稳赚|理财决策|基金推荐/.test(text)) return 'investment';
  return 'safe';
}
export function redactSecrets(text: string): string {
  return text.replace(/(?:验证码|密码|口令)\s*[:：是]?\s*[A-Za-z0-9]{3,}/g, '[敏感内容已移除]').replace(/\b\d{15,19}\b/g, '[长号码已移除]');
}
export function localInstant(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('请填写有效的提醒时间');
  return date.toISOString();
}
export function recurrenceNext(todo: Todo, now = new Date()): string | null {
  if (todo.repeat === 'none') return null;
  const date = new Date(todo.dueAt);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: todo.timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type,part.value]));
  const wall = new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second)));
  const interval = todo.repeat === 'daily' ? 1 : 7;
  let candidate = date;
  for (let count=0; count<400; count++) {
    wall.setUTCDate(wall.getUTCDate() + interval);
    let guess = new Date(wall);
    for (let attempt=0; attempt<3; attempt++) {
      const converted = Object.fromEntries(formatter.formatToParts(guess).map(part => [part.type,part.value]));
      const observed = Date.UTC(Number(converted.year),Number(converted.month)-1,Number(converted.day),Number(converted.hour),Number(converted.minute),Number(converted.second));
      guess = new Date(guess.getTime() + wall.getTime() - observed);
    }
    candidate = guess;
    if (candidate > now) return candidate.toISOString();
  }
  return null;
}
