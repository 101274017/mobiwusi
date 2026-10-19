import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PawPrint } from 'lucide-react';
import './pet-workspace.css';

type WorkspaceMode = 'management' | 'pet-tool';

declare global {
  interface Window {
    nuanbanWorkspace?: {
      status(): Promise<WorkspaceMode>;
      onMode(listener: (mode: WorkspaceMode) => void): () => void;
      returnToPet(): Promise<boolean>;
    };
  }
}

function checkedMode(value: unknown): WorkspaceMode {
  if (value !== 'management' && value !== 'pet-tool') throw new Error('桌宠工具状态未确认');
  return value;
}

export function useDesktopWorkspace() {
  const bridge = window.nuanbanWorkspace;
  const [state, setState] = useState<{ mode: WorkspaceMode | null; error: string }>({ mode: bridge ? null : 'management', error: '' });
  useEffect(() => {
    if (!bridge) return;
    let disposed = false;
    let revision = 0;
    let unsubscribe: (() => void) | undefined;
    const fail = () => { if (!disposed) setState({ mode: null, error: '桌宠工具状态未确认，请重新打开工具窗口。' }); };
    try {
      unsubscribe = bridge.onMode(value => {
        if (disposed) return;
        revision += 1;
        try { setState({ mode: checkedMode(value), error: '' }); } catch { fail(); }
      });
      if (typeof unsubscribe !== 'function') throw new Error('桌宠工具订阅不可用');
      const requestedRevision = revision;
      void bridge.status().then(value => {
        if (!disposed && revision === requestedRevision) setState({ mode: checkedMode(value), error: '' });
      }).catch(() => { if (revision === requestedRevision) fail(); });
    } catch { fail(); }
    return () => { disposed = true; if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [bridge]);
  return state;
}

export function PetWorkspaceHeader() {
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState('');

  async function returnToPet() {
    if (returning) return;
    setReturning(true);
    setError('');
    try {
      if (!window.nuanbanWorkspace || await window.nuanbanWorkspace.returnToPet() !== true) throw new Error('桌宠返回未确认');
    } catch { setError('未能返回桌宠，请重试。当前工具和草稿仍保留。'); }
    finally { setReturning(false); }
  }

  return <header className="pet-workspace-header" aria-label="桌宠工具小屋">
    <div className="pet-workspace-brand"><PawPrint size={28} aria-hidden="true"/><div><strong>暖暖的工具小屋</strong><p>由桌宠打开，做完就回到暖暖身边。</p></div></div>
    <button className="button secondary" type="button" disabled={returning} onClick={() => void returnToPet()}><ArrowLeft size={18}/>{returning ? '正在返回桌宠…' : '返回桌宠全部功能'}</button>
    <nav className="pet-workspace-shortcuts" aria-label="桌宠工具快捷入口"><Link to="/chat/new">文字与图片</Link><Link to="/notes">学习档案</Link><Link to="/todos">待办复习</Link><Link to="/pets">我的桌宠</Link><Link to="/settings">设置与隐私</Link></nav>
    {error && <p className="pet-workspace-error" role="alert">{error}</p>}
  </header>;
}
