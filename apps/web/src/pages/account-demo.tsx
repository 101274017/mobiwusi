import { useEffect, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Square } from 'lucide-react';
import { accountDemoReducer, initialAccountDemo, type AccountDemoInput, type AccountDemoMethod } from '@nuanban/domain';
import { ServiceFailure } from '@nuanban/application';
import { accountDemoService } from '../composition';
import { Badge, Empty, PageTitle } from '../components';
import './account-demo.css';

const methods: { id: AccountDemoMethod; title: string; detail: string }[] = [
  { id: 'carrier', title: '本机号码一键登录', detail: '只模拟 Android 有 SIM 且具备运营商能力的情况。' },
  { id: 'face', title: '已登记账号的人脸登录', detail: '必须先有服务端绑定；这里不调用相机或人脸供应。' },
  { id: 'device', title: '已绑定设备免密登录', detail: '设备私钥挑战与人脸登录不是同一种证明。' },
  { id: 'family', title: '家属协助开通与认领', detail: '协助者先有开通权限，再由本人或有效监护人确认。' },
  { id: 'community', title: '社区批次中的本人认领', detail: '逐人确认，名单导入不代表已激活或有权查看资料。' },
];
const phaseNames = { choose: '选择演示路径', waiting: '正在等待模拟校验', await_confirmation: '等待本人或有效监护人确认', demo_ready: '模拟流程结束 · 仍是本机演示', failed: '校验未完成，请检查条件', cancelled: '本次演示已停止', expired: '本次演示已过期' };
const defaultInput: AccountDemoInput = { method: 'family', platform: 'android', subject: 'adult', hasSim: true, bound: false, operatorAuthorized: false, purposeAccepted: false, outcome: 'success' };

export function AccountDemoPage() {
  const [state, dispatch] = useReducer(accountDemoReducer, initialAccountDemo);
  const [input, setInput] = useState<AccountDemoInput>(defaultInput);
  const [consent, setConsent] = useState(false);
  const [guardianVerified, setGuardianVerified] = useState(false);
  const locked = ['waiting', 'await_confirmation', 'demo_ready'].includes(state.phase);
  function edit<Key extends keyof AccountDemoInput>(key: Key, value: AccountDemoInput[Key]) {
    setInput(previous => ({ ...previous, [key]: value }));
  }
  function reset() { dispatch({ type: 'RESET' }); setConsent(false); setGuardianVerified(false); }
  useEffect(() => {
    const stop = () => dispatch({ type: 'CANCEL' });
    window.addEventListener('nuanban:stop', stop);
    return () => window.removeEventListener('nuanban:stop', stop);
  }, []);
  useEffect(() => {
    if (state.phase !== 'waiting' || !state.input || !accountDemoService) return;
    const controller = new AbortController();
    const generation = state.generation;
    void accountDemoService.attempt(state.input, controller.signal).then(result => {
      if (!controller.signal.aborted && result.source === 'mock' && result.authenticated === false) dispatch({ type: 'PROOF', generation });
    }).catch(error => {
      if (!controller.signal.aborted) dispatch({ type: 'FAIL', generation, expired: error instanceof ServiceFailure && error.code === 'INVITE_EXPIRED', message: error instanceof Error ? error.message : '演示校验未完成。' });
    });
    return () => controller.abort();
  }, [state.phase, state.generation, state.input]);
  if (!accountDemoService) return <Empty title="真实身份服务未接入" description="不会改用模拟证明、发放凭证或建立真实账号。" />;
  return <>
    <Link className="back-link" to="/onboarding/mode">‹ 返回模式配置</Link><PageTitle eyebrow="B06 · 登录与认领交互模拟" title="先说明用途，再一步步确认" subtitle="没有真实认证或开通。不会收取手机号、验证码、人脸、姓名或组织名单；所有证明条件都只是合成夹具。" />
    <div className="account-demo-layout">
      <section className="panel account-demo-options" aria-label="登录路径与合成条件">
        <h2>你想演练哪一条路径？</h2><div className="account-fixture-fields"><label>演示设备<select aria-label="演示设备" value={input.platform} disabled={locked} onChange={event => edit('platform', event.target.value as AccountDemoInput['platform'])}><option value="android">Android 合成设备</option><option value="windows">Windows 合成设备</option></select></label><label>被开通者<select aria-label="被开通者" value={input.subject} disabled={locked} onChange={event => edit('subject', event.target.value as AccountDemoInput['subject'])}><option value="adult">成年使用者示例</option><option value="child">儿童使用者示例</option></select></label></div>
        <fieldset className="account-methods"><legend>免密或协助路径</legend>{methods.map(method => <label className={input.method === method.id ? 'selected' : ''} key={method.id}><input type="radio" name="account-method" value={method.id} checked={input.method === method.id} disabled={locked || (method.id === 'carrier' && input.platform === 'windows')} onChange={() => edit('method', method.id)} /><span><strong>{method.title}</strong><small>{method.detail}</small></span></label>)}</fieldset>
        {input.platform === 'windows' && <p className="account-boundary">此 Windows 场景不提供本机号码能力。可用已绑定设备或家属/社区路径，不改为强制验证码。</p>}
        {input.method === 'carrier' && <label className="account-check"><input type="checkbox" checked={input.hasSim} disabled={locked} onChange={event => edit('hasSim', event.target.checked)} />模拟设备有 SIM 与运营商一键能力</label>}
        {['face', 'device'].includes(input.method) && <label className="account-check"><input type="checkbox" checked={input.bound} disabled={locked} onChange={event => edit('bound', event.target.checked)} />使用合成的已登记账号绑定（不是建立真实绑定）</label>}
        {['family', 'community'].includes(input.method) && <label className="account-check"><input type="checkbox" checked={input.operatorAuthorized} disabled={locked} onChange={event => edit('operatorAuthorized', event.target.checked)} />模拟协助者已认证且具备开通权限</label>}
        <label className="account-check"><input type="checkbox" checked={input.purposeAccepted} disabled={locked} onChange={event => edit('purposeAccepted', event.target.checked)} />已阅读：只演练流程，不采集或认证真实身份</label>
        <details><summary>开发验收：模拟校验结果</summary><label className="form-stack">模拟结果<select aria-label="模拟校验结果" value={input.outcome} disabled={locked} onChange={event => edit('outcome', event.target.value as AccountDemoInput['outcome'])}><option value="success">模拟通过，仍需本人/监护确认</option><option value="failure">模拟验证失败</option><option value="expired">模拟挑战或认领过期</option></select></label></details>
        <button className="button primary full" disabled={locked} onClick={() => { setConsent(false); setGuardianVerified(false); dispatch({ type: 'START', input }); }}>{['failed', 'cancelled', 'expired'].includes(state.phase) ? '按当前条件重新演练' : '开始这条路径的演练'}</button>
      </section>
      <section className="panel account-demo-status" aria-label="登录认领演练状态"><ShieldCheck size={34} /><Badge>Mock · authenticated: false</Badge><h2 aria-live="polite">{phaseNames[state.phase]}</h2>{state.error && <p role="alert" className="inline-error">{state.error}</p>}
        {state.phase === 'choose' && <p>选择路径不会登录、切换真实账号、授予家属权限或开启共享。</p>}
        {state.phase === 'waiting' && <p>正在演练短期挑战。随时停止后，迟到结果不会自动恢复。</p>}
        {state.phase === 'await_confirmation' && <><p>{['family', 'community'].includes(state.input!.method) ? '模拟认领等待逐人确认；操作员不能替本人或有效监护人同意。' : '合成挑战已通过，但没有发放会话凭证，仍需确认用途。'}</p>{state.input!.subject === 'child' && <label className="account-check"><input type="checkbox" checked={guardianVerified} onChange={event => setGuardianVerified(event.target.checked)} />模拟有效监护关系已核验（不是实际核验）</label>}<label className="account-check"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />{state.input!.subject === 'child' ? '由模拟监护人明确确认本次认领与用途' : '由模拟本人明确确认本次认领与用途'}</label><button className="button primary full" onClick={() => dispatch({ type: 'CONFIRM', consent, guardianVerified })}>确认本次模拟认领</button><button className="button secondary full" onClick={() => dispatch({ type: 'EXPIRE' })}>演示认领到期</button></>}
        {state.phase === 'demo_ready' && <><p>仅完成交互演练。没有真实账号、登录令牌、监护关系、亲情权限或云端资料。模式选择与设备能力相互独立。</p><Link className="button primary full" to="/onboarding/mode">继续选择本机演示模式</Link></>}
        {state.phase !== 'choose' && <button className="button secondary full" onClick={reset}>返回选择其他路径</button>}
        <button className="button stop-outline full" onClick={() => dispatch({ type: 'CANCEL' })}><Square size={16} />停止本次认领演练</button>
      </section>
    </div>
  </>;
}
