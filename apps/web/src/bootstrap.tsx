import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { services, initialSnapshot } from './composition';
import { useApp } from './store';
import { App } from './App';

export function startApp() {
  void useApp.getState().initialize(services, initialSnapshot);
  createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><App /></HashRouter></React.StrictMode>);
}
