import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FlaskConical, RotateCcw, ShieldCheck } from 'lucide-react';
import { scenarioCatalog } from '@nuanban/config';
import { config, resetCurrentScenario } from '../composition';
import { announce } from '../store';
import { Badge, Modal, PageTitle } from '../components';

export function ScenariosPage() {
  const [confirm, setConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const selected = scenarioCatalog.find(scenario => scenario.id === config.scenario)!;
  if (config.apiMode !== 'mock') return <p>真实服务模式不提供演示场景。</p>;
  async function reset() {
    setResetting(true);
    window.dispatchEvent(new Event('nuanban:stop'));
    try { await resetCurrentScenario(); window.location.reload(); }
    catch { announce('演示资料重置未完成，请重试；没有清理其他场景或真实账号。'); setResetting(false); }
  }
  return <>
    <PageTitle eyebrow="A03 · B10 可重放验收" title="开发验收场景" subtitle="这些是固定的合成场景，只验证前端行为，不代表原生能力或真实服务通过验收。"><Badge><FlaskConical size={16} />仅演示模式</Badge></PageTitle>
    <section className="panel scenario-current" aria-label="当前演示场景">
      <div><span className="eyebrow">当前场景 · {selected.id}</span><h2>{selected.name}</h2><p>{selected.description}</p><p className="small-note">初始夹具时钟：2026-10-15 09:00，Asia/Shanghai。新建内容使用实际操作时间。各场景资料独立，刷新保留；重置只清当前场景。</p></div>
      <div className="stack"><Link className="button primary" to={selected.target}>打开验证入口 <ArrowUpRight size={18} /></Link><button className="button secondary" onClick={() => setConfirm(true)}><RotateCcw size={18} />重置当前场景</button></div>
    </section>
    <div className="scenario-grid">{scenarioCatalog.map(scenario => <section className="panel scenario-card" key={scenario.id} aria-label={scenario.name}>
      <div className="scenario-card-heading"><code>{scenario.id}</code>{config.scenario === scenario.id && <Badge tone="sage">当前场景</Badge>}</div>
      <h2>{scenario.name}</h2><p>{scenario.description}</p>
      <a className="button secondary" href={'#' + scenario.target + '?scenario=' + scenario.id} onClick={event => { event.preventDefault(); window.location.hash = scenario.target + '?scenario=' + scenario.id; window.location.reload(); }} aria-current={config.scenario === scenario.id ? 'true' : undefined}>切换到{scenario.name} <ArrowUpRight size={18} /></a>
    </section>)}</div>
    <section className="inline-card"><ShieldCheck size={24} /><p>权限拒绝是服务夹具，不会修改系统授权；风险画面只来自应用内合成练习。真实模式报错不会回退 Mock，也不读取演示账号。邀请码、媒体和跨端同步仍未接入。</p></section>
    <Modal open={confirm} onOpenChange={open => { if (!resetting) setConfirm(open); }} title="重置当前演示场景？" description="会删除当前场景的本机笔记、待办、关系、设置和画稿，并恢复固定夹具；不会清理其他场景。"><div className="stack"><button className="button primary" disabled={resetting} onClick={() => void reset()}>{resetting ? '正在重置…' : '确认重置当前场景'}</button><button className="button secondary" disabled={resetting} onClick={() => setConfirm(false)}>先保留资料</button></div></Modal>
  </>;
}
