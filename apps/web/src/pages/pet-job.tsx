import { Link } from 'react-router-dom';
import { Empty } from '../components';

export function PetJobPage() {
  return <Empty title="桌宠生成服务尚未接通" description="已移除模拟队列、进度和生成结果。原始画稿仍保存在本机，可直接用作桌宠，或导入自己的本机模型。"><Link className="button primary" to="/pets/draw">返回我的画稿</Link></Empty>;
}
