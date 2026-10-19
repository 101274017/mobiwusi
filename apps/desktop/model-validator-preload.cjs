const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nuanbanModelValidator', Object.freeze({
  read: () => ipcRenderer.invoke('nuanban:model-validator:read'),
  complete: result => ipcRenderer.invoke('nuanban:model-validator:complete', { summary: result?.summary, error: result?.error }),
}));
