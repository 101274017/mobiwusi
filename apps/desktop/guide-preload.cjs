const { contextBridge, ipcRenderer } = require('electron');

function projectGuide(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const [field, kind] of Object.entries({ visible: 'boolean', label: 'string', instruction: 'string', presentation: 'string', expiresAt: 'number' })) {
    if (typeof value[field] === kind && (kind !== 'number' || Number.isFinite(value[field]))) result[field] = value[field];
  }
  if (value.rect && typeof value.rect === 'object') {
    result.rect = {};
    for (const field of ['x', 'y', 'width', 'height']) {
      if (typeof value.rect[field] === 'number' && Number.isFinite(value.rect[field])) result.rect[field] = value.rect[field];
    }
  }
  return result;
}

contextBridge.exposeInMainWorld('nuanbanGuide', Object.freeze({
  onState: listener => {
    if (typeof listener !== 'function') throw new TypeError('指引监听器必须是函数');
    const handler = (_event, state) => listener(projectGuide(state));
    ipcRenderer.on('nuanban:guide:state', handler);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      ipcRenderer.removeListener('nuanban:guide:state', handler);
    };
  },
}));
