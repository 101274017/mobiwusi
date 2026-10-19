import { Link } from 'react-router-dom';
import { Empty, PageTitle } from '../components';

export function AccountPage() {
  return <><PageTitle eyebrow="不伪造身份授权" title="账号与身份" subtitle="本机使用不等于账号登录。" /><Empty title="账号认证尚未接通" description="已移除模拟登录、人脸验证和认领流程。不会收取手机号、人脸、验证码，也不会发放假凭证。"><Link className="button secondary" to="/">返回首页</Link></Empty></>;
}
