export type AccountDemoMethod = 'carrier' | 'face' | 'device' | 'family' | 'community';
export interface AccountDemoInput {
  method: AccountDemoMethod;
  platform: 'android' | 'windows';
  subject: 'adult' | 'child';
  hasSim: boolean;
  bound: boolean;
  operatorAuthorized: boolean;
  purposeAccepted: boolean;
  outcome: 'success' | 'failure' | 'expired';
}
export interface AccountDemoState {
  phase: 'choose' | 'waiting' | 'await_confirmation' | 'demo_ready' | 'failed' | 'cancelled' | 'expired';
  generation: number;
  authenticated: false;
  input: AccountDemoInput | null;
  error: string | null;
}
export type AccountDemoEvent = { type: 'START'; input: AccountDemoInput } | { type: 'PROOF'; generation: number } | { type: 'FAIL'; generation: number; message: string; expired: boolean } | { type: 'CONFIRM'; consent: boolean; guardianVerified: boolean } | { type: 'CANCEL' | 'RESET' | 'EXPIRE' };
export const initialAccountDemo: AccountDemoState = { phase: 'choose', generation: 0, authenticated: false, input: null, error: null };

export function accountDemoEligibility(input: AccountDemoInput): string | null {
  if (!input.purposeAccepted) return '请先阅读并确认演示用途；没有采集真实身份信息。';
  if (!['carrier', 'face', 'device', 'family', 'community'].includes(input.method) || !['android', 'windows'].includes(input.platform) || !['adult', 'child'].includes(input.subject) || !['success', 'failure', 'expired'].includes(input.outcome)) return '不支持的演示登录路径。';
  if (input.method === 'carrier' && (input.platform !== 'android' || !input.hasSim)) return '这个设备场景没有本机号码能力，请改用已绑定设备或家属/社区协助，不强制验证码。';
  if (['face', 'device'].includes(input.method) && !input.bound) return '需要先有已登记的账号绑定，不能用陌生人脸或新设备自动建立账号。';
  if (['family', 'community'].includes(input.method) && !input.operatorAuthorized) return '协助开通需要已认证且获授权的操作员；名单或亲属称谓不代表授权。';
  return null;
}

export function accountDemoReducer(state: AccountDemoState, event: AccountDemoEvent): AccountDemoState {
  if (event.type === 'RESET') return { ...initialAccountDemo, generation: state.generation + 1 };
  if (event.type === 'CANCEL') return { ...state, phase: 'cancelled', generation: state.generation + 1, error: null };
  if ('generation' in event && event.generation !== state.generation) return state;
  if (event.type === 'START' && ['choose', 'failed', 'cancelled', 'expired'].includes(state.phase)) {
    const error = accountDemoEligibility(event.input);
    return { ...state, input: { ...event.input }, generation: state.generation + 1, phase: error ? 'failed' : 'waiting', error };
  }
  if (event.type === 'PROOF' && state.phase === 'waiting') return { ...state, phase: 'await_confirmation', error: null };
  if (event.type === 'FAIL' && state.phase === 'waiting') return { ...state, phase: event.expired ? 'expired' : 'failed', error: event.message };
  if (event.type === 'EXPIRE' && state.phase === 'await_confirmation') return { ...state, phase: 'expired', generation: state.generation + 1, error: '演示挑战或认领已过期，需要重新发起；不会自动激活。' };
  if (event.type === 'CONFIRM' && state.phase === 'await_confirmation') {
    if (!event.consent) return { ...state, error: '需要本人或有效监护人明确确认；操作员不能代替同意。' };
    if (state.input?.subject === 'child' && !event.guardianVerified) return { ...state, error: '儿童场景还需要有效监护关系核验；勾选用途不等于已核验。' };
    return { ...state, phase: 'demo_ready', error: null };
  }
  return state;
}
