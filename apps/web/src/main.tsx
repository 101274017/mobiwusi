import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './support.css';
import './responsive.css';
import './scenarios.css';
void import('./bootstrap').then(({ startApp }) => startApp()).catch(() => {
  createRoot(document.getElementById('root')!).render(<main className="loading-screen"><h1>启动配置不可用</h1><p>演示场景或运行模式无效，已停止启动，不会自动切换到模拟服务。</p><a className="button primary" href={window.location.pathname + '#/'}>移除场景参数后重试</a></main>);
});
