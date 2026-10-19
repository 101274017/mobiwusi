const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { validateModelSummary } = require('./local-model.cjs');

function createLocalModelValidator({ BrowserWindow, ipcMain, timeoutMs = 20000 }) {
  const page = path.join(__dirname, 'model-validator.html');
  let active;
  let closed = false;
  function validate(payload) {
    if (closed || active) return Promise.reject(new Error('模型检查器未就绪，请稍后重试'));
    return new Promise((resolve, reject) => {
      const window = new BrowserWindow({ show: false, width: 360, height: 360, skipTaskbar: true,
        webPreferences: { preload: path.join(__dirname, 'model-validator-preload.cjs'), partition: 'nuanban-model-validation', sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false } });
      active = { window, cancel: () => finish(new Error('模型检查已取消，未更换桌宠')) };
      let settled = false;
      let readingMemory = false;
      const trusted = event => event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === pathToFileURL(page).href;
      function finish(error, summary) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(memoryTimer);
        ipcMain.removeHandler('nuanban:model-validator:read');
        ipcMain.removeHandler('nuanban:model-validator:complete');
        active = undefined;
        if (!window.isDestroyed()) window.destroy();
        if (error) reject(error); else resolve(summary);
      }
      const timeout = setTimeout(() => finish(new Error('模型检查超过 20 秒，已停止；请简化模型后重试')), timeoutMs);
      const memoryTimer = setInterval(async () => {
        if (readingMemory || settled || window.webContents.isDestroyed()) return;
        readingMemory = true;
        try {
          const memory = await window.webContents.getProcessMemoryInfo();
          if (memory.private > 512 * 1024) finish(new Error('模型解析内存超过 512 MiB，已停止并保留原桌宠'));
        } catch {} finally { readingMemory = false; }
      }, 400);
      ipcMain.handle('nuanban:model-validator:read', event => {
        if (!trusted(event)) throw new Error('不可信模型检查来源');
        return payload;
      });
      ipcMain.handle('nuanban:model-validator:complete', (event, result) => {
        if (!trusted(event)) throw new Error('不可信模型检查结果');
        if (typeof result?.error === 'string') finish(new Error(result.error.slice(0, 200)));
        else {
          try { finish(null, validateModelSummary(result?.summary)); } catch (error) { finish(error); }
        }
        return true;
      });
      window.setContentProtection(true);
      const allowedFiles = new Set([pathToFileURL(page).href, pathToFileURL(path.join(__dirname, 'model-runtime/model-renderer.js')).href]);
      window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      window.webContents.session.setPermissionCheckHandler(() => false);
      window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !allowedFiles.has(details.url) && !details.url.startsWith('blob:') && !details.url.startsWith('data:') }));
      window.webContents.setAudioMuted(true);
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', event => event.preventDefault());
      window.webContents.on('will-attach-webview', event => event.preventDefault());
      window.webContents.once('render-process-gone', () => finish(new Error('模型解析进程已停止，原桌宠未替换')));
      window.once('closed', () => finish(new Error('模型检查窗口已关闭，原桌宠未替换')));
      window.loadFile(page).catch(() => finish(new Error('本地 3D 检查组件未加载，请重新构建客户端')));
    });
  }
  return { validate, dispose: () => { closed = true; active?.cancel(); } };
}

module.exports = { createLocalModelValidator };
