import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Box, Leaf, Monitor, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge, Modal, PageTitle, Pet } from '../components';
import { localCompanionBridge, showLiliCompanion } from '../local-companion';
import { lumiModel } from '../three-d/builtin-models';
import { LumiCard } from '../three-d/lumi-card';
import './companions.css';

export function CompanionCatalog() {
  return <section className="companion-catalog" aria-label="小鹿与小猫伙伴收藏">
    <Link className="companion-card companion-card-lili" to="/pets/lili">
      <div className="companion-card-art">
        <span className="companion-number">01 / 森林里的小灯</span>
        <Pet kind="lili" />
        <span className="companion-format"><Leaf size={15} aria-hidden="true" />二维动作角色</span>
      </div>
      <div className="companion-card-copy">
        <span className="eyebrow">LILI · 栗栗小鹿</span>
        <h2>提一盏灯，陪你慢慢来。</h2>
        <p>条纹围巾、小黄灯，还有六种表情与六个动作。已有角色资源，离线也能陪伴。</p>
        <span className="companion-card-link">认识小鹿栗栗<ArrowUpRight size={20} aria-hidden="true" /></span>
      </div>
    </Link>
    <Link className="companion-card companion-card-lumi" to="/pets/lumi">
      <div className="companion-card-art">
        <span className="companion-number">02 / 日常里的小魔法</span>
        <img src={lumiModel.posterUrl} alt="露米小猫，穿着紫色披风、手持星星魔杖" width="1000" height="1250" />
        <span className="companion-format"><Box size={15} aria-hidden="true" />本地 3D 模型</span>
      </div>
      <div className="companion-card-copy">
        <span className="eyebrow">LUMI · 露米小猫</span>
        <h2>把每一天，变成小魔法。</h2>
        <p>真实三维模型，可以转一转、打招呼，试试九个动作。预览不会替换当前桌宠。</p>
        <span className="companion-card-link">认识小猫露米<ArrowUpRight size={20} aria-hidden="true" /></span>
      </div>
    </Link>
  </section>;
}

function LiliCard() {
  const canCall = Boolean(localCompanionBridge());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function summon() {
    if (busy || !canCall) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const resource = await showLiliCompanion();
      setConfirm(false);
      setNotice(`栗栗 ${resource.version} 已切换并显示在桌面。`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '栗栗未能显示，当前设置不会假装切换成功。请重试。');
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel lili-companion" aria-labelledby="lili-title">
    <div className="lili-companion-stage">
      <span className="companion-number"><Leaf size={15} aria-hidden="true" />本机伙伴 · 栗栗</span>
      <Pet kind="lili" />
      <span className="lili-stage-caption">一盏小灯，一份不催促的陪伴</span>
    </div>
    <div className="lili-companion-details">
      <span className="eyebrow">森林里的小伙伴 / LITTLE DEER</span>
      <h2 id="lili-title">栗栗 <span>Lili</span></h2>
      <p className="lili-companion-description">围好围巾，提起小灯。学会一点新东西、休息一下，栗栗都愿意陪在你身旁。</p>
      <Badge tone="sage">已内置 · 无需下载</Badge>
      <dl className="lili-companion-facts">
        <div><dt>角色类型</dt><dd>二维动作桌宠</dd></div>
        <div><dt>表情与动作</dt><dd>六种表情 · 六个动作</dd></div>
        <div><dt>运行方式</dt><dd>本机播放 · 不依赖云渲染</dd></div>
        <div><dt>资源来源</dt><dd>已有角色工程导出的 PNG 图集</dd></div>
      </dl>
      <p className="companion-boundary">这里展示真实角色原画；动作在独立桌宠中播放。栗栗目前不是 3D 模型，不支持三维旋转或通用五官微调。</p>
      <button className="button primary" type="button" disabled={!canCall || busy} onClick={() => { setError(''); setConfirm(true); }}>
        <Monitor size={19} aria-hidden="true" />{busy ? '正在请栗栗到桌面…' : '请栗栗到桌面'}
      </button>
      {!canCall && <p className="small-note">浏览器里可查看角色；切换桌宠需要在微光指引桌面客户端中完成。</p>}
      {notice && <p className="companion-notice" role="status">{notice}</p>}
      {error && !confirm && <p className="inline-error" role="alert">{error}</p>}
    </div>
    <Modal open={confirm} onOpenChange={open => { if (!busy) setConfirm(open); }} title="确认将栗栗请到桌面？" description="确认后通过本机角色接口切换并显示栗栗，不会上传角色资源，也不会启动屏幕或麦克风采集。">
      <p>仅浏览此页面不会替换桌宠。确认后，原桌宠会切换为栗栗。</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="button secondary" type="button" disabled={busy} onClick={() => setConfirm(false)}>先不更换</button>
        <button className="button primary" type="button" disabled={busy} onClick={() => void summon()}>{busy ? '正在切换…' : '确认切换并显示栗栗'}</button>
      </div>
    </Modal>
  </section>;
}

export function CompanionPage({ companion }: { companion: 'lili' | 'lumi' }) {
  const isLili = companion === 'lili';
  return <>
    <PageTitle eyebrow="每个小伙伴，都有自己的小天地" title={isLili ? '小鹿栗栗' : '小猫露米'} subtitle={isLili ? '提一盏暖灯，陪你一步一步来。本页只介绍和切换栗栗，不混入其他伙伴的设置。' : '一只把陪伴变成小魔法的猫。在这里预览真实 3D 与动作，再决定是否请到桌面。'}>
      <Link className="button secondary" to="/pets"><ArrowLeft size={18} aria-hidden="true" />返回伙伴收藏</Link>
    </PageTitle>
    <nav className="companion-switch" aria-label="选择伙伴详情">
      <NavLink to="/pets/lili" className={({ isActive }) => isActive ? 'active' : ''}><Leaf size={18} aria-hidden="true" />小鹿栗栗<span>二维动作角色</span></NavLink>
      <NavLink to="/pets/lumi" className={({ isActive }) => isActive ? 'active' : ''}><Sparkles size={18} aria-hidden="true" />小猫露米<span>本地 3D 模型</span></NavLink>
    </nav>
    {isLili ? <LiliCard /> : <LumiCard />}
    <div className="companion-management"><Link className="button secondary" to="/pets/import-3d"><Box size={18} aria-hidden="true" />管理本机模型与切回原画</Link></div>
    <p className="companion-local-note"><ShieldCheck size={18} aria-hidden="true" />浏览与预览仅在本机进行；切换桌宠需要你亲手确认，不会自动授权屏幕或麦克风。</p>
  </>;
}
