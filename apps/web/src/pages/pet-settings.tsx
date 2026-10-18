import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, RotateCcw } from 'lucide-react';
import { currentPet, samePet } from '@nuanban/pet-engine';
import type { PetAppearance, PetConfiguration } from '@nuanban/domain';
import { useApp } from '../store';
import { Pet, PageTitle, Badge, Modal } from '../components';
import './pet-settings.css';

const pets = [{ id: 'cat', name: '小橘猫', color: '#D98347' }, { id: 'rabbit', name: '小白兔', color: '#D7C5AB' }, { id: 'dog', name: '小暖狗', color: '#C19165' }] as const;

export function PetsPage() {
  const preferences = useApp(state => state.snapshot!.preferences);
  const busy = useApp(state => state.busy);
  const [draft, setDraft] = useState<PetConfiguration>(() => currentPet(preferences));
  const [revision, setRevision] = useState(preferences.petRevision ?? 0);
  const [confirmation, setConfirmation] = useState<'apply' | 'undo' | null>(null);
  const [unsupported, setUnsupported] = useState<'generation' | '3d' | null>(null);
  const changed = !samePet(currentPet(preferences), draft);
  function tune<Key extends keyof PetAppearance>(key: Key, value: PetAppearance[Key]) {
    setDraft(previous => ({ ...previous, appearance: { ...previous.appearance, [key]: value } }));
  }
  function reload() {
    const current = useApp.getState().snapshot!.preferences;
    setDraft(currentPet(current)); setRevision(current.petRevision ?? 0);
    useApp.getState().clearError();
  }
  async function confirm() {
    try {
      if (confirmation === 'undo') await useApp.getState().undoPet(revision);
      else await useApp.getState().applyPet(draft, revision);
      reload(); setConfirmation(null);
    } catch { }
  }
  return <>
    <PageTitle eyebrow="B03 · 内置原创 SVG" title="我的小伙伴" subtitle="微调的是内置演示伙伴，不是手绘生成资产。先预览，明确确认后才替换；上一套设置可撤回。" />
    <div className="pet-editor-grid">
      <section className="panel pet-editor-preview" aria-label="桌宠微调预览">
        <Badge tone="sage">当前陪伴伙伴</Badge><div className="pet-editor-current"><Pet kind={preferences.pet} color={preferences.petColor} /><p>当前设置 · 本机保存</p></div>
        <div className="pet-editor-candidate"><Badge>尚未应用的预览</Badge><Pet kind={draft.kind} color={draft.appearance.color} appearance={draft.appearance} /><p aria-live="polite">{changed ? '只有右侧预览改变，当前伙伴未替换。' : '预览与当前设置相同。'}</p></div>
      </section>
      <section className="panel pet-editor-controls" aria-label="内置伙伴微调">
        <h2>让小伙伴，更像你喜欢的样子。</h2><p>所有选项只改变本页预览。不上传画稿，不调用生成服务。</p>
        <fieldset><legend>选择内置伙伴</legend><div className="pet-kind-options">{pets.map(pet => <button key={pet.id} className={'button ' + (draft.kind === pet.id ? 'primary' : 'secondary')} aria-pressed={draft.kind === pet.id} onClick={() => setDraft(previous => ({ kind: pet.id, appearance: { ...previous.appearance, color: pet.color } }))}>{pet.name}</button>)}</div></fieldset>
        <div className="pet-tuning-fields">
          <label>眼睛<select aria-label="眼睛" value={draft.appearance.eyes} onChange={event => tune('eyes', event.target.value as PetAppearance['eyes'])}><option value="round">圆圆眼</option><option value="happy">弯弯笑眼</option><option value="sleepy">眯眯眼</option></select></label>
          <label>嘴型<select aria-label="嘴型" value={draft.appearance.mouth} onChange={event => tune('mouth', event.target.value as PetAppearance['mouth'])}><option value="smile">微笑</option><option value="small">小嘴</option><option value="open">张嘴</option></select></label>
          <label>动作姿态<select aria-label="动作姿态" value={draft.appearance.action} onChange={event => tune('action', event.target.value as PetAppearance['action'])}><option value="idle">安静陪伴</option><option value="greeting">招招手</option><option value="celebrating">一起庆祝</option></select></label>
          <label>伙伴颜色<input type="color" aria-label="伙伴颜色" value={draft.appearance.color} onChange={event => tune('color', event.target.value)} /></label>
        </div>
        <p className="small-note">姿态是内置 SVG 演示，不代表生成动画或已验证的原生浮层。</p>
        <div className="stack"><button className="button primary" disabled={!changed || busy} onClick={() => setConfirmation('apply')}><Check size={19} />预览满意，确认应用</button><button className="button secondary" disabled={busy} onClick={reload}>放弃预览，读取当前设置</button><button className="button secondary" disabled={!preferences.previousPet || busy} onClick={() => setConfirmation('undo')}><RotateCcw size={18} />撤回上次应用</button></div>
      </section>
    </div>
    <section className="panel custom-pet-section"><div><span className="eyebrow">儿童模式 · 画一画</span><h2>把想象中的小伙伴，画出来。</h2><p>画稿与模拟任务独立保留；原画预览不会替换桌宠。</p></div><Link className="button primary" to="/pets/draw"><Pencil size={20} />去画一画</Link><button className="button secondary" onClick={() => setUnsupported('generation')}>查看生成状态</button><button className="button secondary" onClick={() => setUnsupported('3d')}>3D 模型导入说明</button></section>
    <Modal open={confirmation !== null} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }} title={confirmation === 'undo' ? '撤回到上一套内置桌宠？' : '确认应用内置桌宠微调？'}><p>{confirmation === 'undo' ? '恢复上次替换前的形象、五官、配色和姿态。这次撤回不会删除画稿，也不会改变模式或语音偏好。' : '确认后才替换当前内置伙伴，并在本机保留上一套设置供撤回。它不是 AI 生成资产，不会更改你的画稿。'}</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirmation(null)}>暂不更改</button><button className="button primary" disabled={busy} onClick={() => void confirm()}>{busy ? '正在保存…' : confirmation === 'undo' ? '确认撤回' : '确认应用到本机'}</button></div></Modal>
    <Modal open={unsupported !== null} onOpenChange={open => { if (!open) setUnsupported(null); }} title={unsupported === '3d' ? '电脑端 3D 导入尚未接入' : '真实桌宠生成尚未接入'}><p>{unsupported === '3d' ? 'VRM / FBX / GLB 解析、资源扫描、骨骼和动作兼容仍需 C/E 验证。浏览器和 Android 不开放该能力，不收取真实模型文件。' : '生成供应、任务队列、资产扫描和动画验收尚未接入。内置微调与画稿任务模拟均不等同手绘转可动桌宠。'}</p><Badge tone="soft">未接入，不代表生成成功</Badge></Modal>
  </>;
}
