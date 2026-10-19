const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nuanbanObservationRegion', Object.freeze({
  choose: region => ipcRenderer.send('nuanban:observation-region:select', region),
  cancel: () => ipcRenderer.send('nuanban:observation-region:select', null),
}));
