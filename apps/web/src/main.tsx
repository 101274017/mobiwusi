import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './support.css';
import './responsive.css';
import './conversation-status.css';
void import('./bootstrap').then(({ startApp }) => startApp()).catch(() => {
    createRoot(document.getElementById('root')!).render(<main className="loading-screen"><h1>启动配置不可用</h1><p>请检查本机或远程业务服务配置。系统不会回退演示服务。</p><a className="button primary" href={window.location.pathname + '#/'}>重新打开首页</a></main>);
});
