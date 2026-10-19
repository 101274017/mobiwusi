import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarCheck, MessageCircle, Monitor, PawPrint } from 'lucide-react';
import { useApp } from '../store';
import { PageTitle, Pet } from '../components';
import { ScreenObservationPanel } from '../screen-observation';
import { ProviderStatusPanel } from '../provider-status';

export function HomePage() {
  const snapshot = useApp(state => state.snapshot!);
  const notes = snapshot.notes.filter(note => !note.deletedAt);
  const todos = snapshot.todos.filter(todo => !todo.deletedAt && !todo.completedAt);
  return <>
    <PageTitle eyebrow="不用着急，我们慢慢来" title="今天想学点什么？" subtitle="从你的问题开始。不会预置学习记录，也不会替你点击电脑。" />
    <section className="panel"><Pet kind={snapshot.preferences.pet} color={snapshot.preferences.petColor} /><h2>暖伴在这里，陪你一步一步学会。</h2><p>可以打字、选图片，或通过独立桌宠在本人确认后观察真实软件。</p><div className="button-row"><Link className="button primary" to="/chat/new"><MessageCircle size={20} />和暖伴说说</Link><Link className="button secondary" to="/overlay/guide"><Monitor size={20} />真实软件教学</Link></div></section>
    <div className="capabilities-grid"><Link className="panel" to="/notes"><BookOpen /><h2>我的学习笔记</h2><p>{notes.length ? `已保存 ${notes.length} 条学习记录` : '还没有学习记录，从一次真实提问开始。'}</p><ArrowRight /></Link><Link className="panel" to="/todos"><CalendarCheck /><h2>待办与复习</h2><p>{todos.length ? `${todos.length} 项待办未完成` : '没有待办，可按需要亲手创建。'}</p><ArrowRight /></Link><Link className="panel" to="/pets"><PawPrint /><h2>我的小伙伴</h2><p>使用内置形象、自己的画稿或本机模型。</p><ArrowRight /></Link></div>
    <ProviderStatusPanel />
  </>;
}

export function GuidePage() {
  return <>
    <PageTitle eyebrow="真实软件，由你亲手操作" title="让桌宠陪你一步一步学" subtitle="不再使用应用内假手机或模拟核验。请在独立桌宠中选择范围、确认观察并提问。" />
    <section className="panel"><ScreenObservationPanel onPractice={() => { window.location.hash = '/chat/new'; }} /><p className="small-note">屏幕与麦克风默认关闭。未知、敏感或检测失败时暂停；模型不会获得点击、键盘或系统操作权限。</p></section>
  </>;
}
