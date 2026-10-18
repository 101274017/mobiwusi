import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ConflictChoice, LocalConflict } from '@nuanban/domain';
import { config } from '../composition';
import { useApp } from '../store';
import { Badge, Empty, Modal, PageTitle, formatDate } from '../components';
import './conflicts.css';

function Contents({ conflict, side }: { conflict: LocalConflict; side: ConflictChoice }) {
  const record = side === 'local' ? conflict.local : conflict.other;
  return <section className="conflict-version" aria-label={side === 'local' ? '本机未保存草稿' : '另一份模拟版本'}>
    <h3>{side === 'local' ? '本机未保存草稿' : '另一份模拟版本'}</h3><Badge>版本 {record.version}</Badge>
    {record.deletedAt ? <p className="inline-error">这份内容已删除；选择它将保留删除状态。</p> : null}
    {'summary' in record ? <><h4>{record.topic}</h4><p>{record.question}</p><p className="conflict-body">{record.summary}</p><p>掌握状态：{record.mastery === 'mastered' ? '本人确认已掌握' : '还想再练练'}</p></> : <><h4>{record.title}</h4><p>提醒时间：{formatDate(record.dueAt)}</p><p>时区：{record.timezone}</p><p>重复：{record.repeat === 'daily' ? '每天' : record.repeat === 'weekly' ? '每周' : '仅一次'}</p><p>完成状态：{record.completedAt ? '已完成' : '未完成'}</p></>}
  </section>;
}

function ConflictCard({ conflict }: { conflict: LocalConflict }) {
  const [choice, setChoice] = useState<ConflictChoice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const busy = useApp(state => state.busy);
  async function resolve() {
    if (!choice) return;
    try { await useApp.getState().resolveConflict(conflict.id, choice); setConfirming(false); } catch { }
  }
  return <article className="panel conflict-card">
    <h2>{conflict.entityType === 'note' ? conflict.local.topic : conflict.local.title}</h2><p>原版本 {conflict.baseVersion} · 不会自动覆盖。可以先返回，草稿会继续保留。</p>
    <div className="conflict-comparison"><Contents conflict={conflict} side="local" /><Contents conflict={conflict} side="other" /></div>
    <fieldset className="conflict-choices"><legend>比较后，选择要保留的内容</legend><label><input type="radio" name={conflict.id} checked={choice === 'local'} disabled={!!conflict.other.deletedAt || busy} onChange={() => setChoice('local')} />保留本机草稿（生成更高演示版本）</label><label><input type="radio" name={conflict.id} checked={choice === 'other'} disabled={busy} onChange={() => setChoice('other')} />采用另一份模拟版本（放弃这份草稿）</label></fieldset>
    <button className="button primary" disabled={!choice || busy} onClick={() => setConfirming(true)}>核对选择并继续</button>
    <Modal open={confirming} onOpenChange={setConfirming} title="确认这次冲突选择？"><p>{choice === 'local' ? '保留你在本机做出的修改；模拟另一版本不会被静默采用。' : '采用合成的另一版本，并明确放弃这份未保存草稿。删除的内容不会自动恢复。'}这里只处理本机演示资料，不表示云同步成功。若资料又有变化，本次选择会被拒绝。</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>返回比较</button><button className="button primary" disabled={busy} onClick={() => void resolve()}>{busy ? '正在保存…' : '确认保留所选内容'}</button></div></Modal>
  </article>;
}

export function ConflictsPage() {
  const conflicts = useApp(state => state.snapshot?.conflicts ?? []);
  return <><Link className="back-link" to="/notes">‹ 返回学习笔记</Link><PageTitle eyebrow="B05 · 本机冲突草稿" title="逐项核对，不替你决定" subtitle="失败的修改与另一份合成版本并排比较；必须明确选择并确认。刷新或暂时离开不会清除待处理草稿。" /><Badge>Mock · 没有云同步</Badge>
    {config.apiMode !== 'mock' ? <Empty title="真实同步未接入" description="不能用模拟冲突代替真实服务结果。" /> : conflicts.length ? <div className="conflict-list">{conflicts.map(conflict => <ConflictCard key={conflict.id} conflict={conflict} />)}</div> : <Empty title="没有待处理的冲突草稿" description="正常保存不经过此页。开发场景中出现版本冲突时，修改会先保留在这里。"><Link className="button secondary" to="/todos">查看待办</Link></Empty>}
  </>;
}
