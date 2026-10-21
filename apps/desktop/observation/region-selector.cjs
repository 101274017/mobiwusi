const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { validateObservationRegion } = require('./observation-region.cjs');
const { ObservationError } = require('./observation-common.cjs');

function createObservationRegionSelector({ BrowserWindow, ipcMain }) {
  const page = path.join(__dirname, 'region-selector.html');
  const channel = 'nuanban:observation-region:select';
  let active = null;

  function cancel() { active?.finish(null); }

  function select(geometry) {
    if (active) return Promise.reject(new ObservationError('busy'));
    if (!geometry || !['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(geometry[key])) || geometry.width < 32 || geometry.height < 32) return Promise.reject(new ObservationError('capture_region_invalid'));
    const screenBounds = { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height };
    return new Promise((resolve, reject) => {
      let window;
      let contentBounds;
      let pageUrl;
      let settled = false;
      const finish = (region, error) => {
        if (settled) return;
        settled = true;
        active = null;
        ipcMain.removeListener(channel, receive);
        if (window && !window.isDestroyed()) window.destroy();
        if (error) reject(error);
        else resolve(region);
      };
      const receive = (event, payload) => {
        if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
          || event.senderFrame.url !== pageUrl) return;
        if (payload === null) { finish(null); return; }
        try {
          const selection = validateObservationRegion(payload, contentBounds.width, contentBounds.height);
          const bounds = window.getContentBounds();
          if (!['x', 'y', 'width', 'height'].every(key => bounds[key] === contentBounds[key])) throw new ObservationError('capture_region_invalid');
          const region = selection && validateObservationRegion({ ...selection,
            x: contentBounds.x - screenBounds.x + selection.x, y: contentBounds.y - screenBounds.y + selection.y }, screenBounds.width, screenBounds.height);
          if (!region || region.width < 32 || region.height < 32) throw new ObservationError('capture_region_invalid');
          finish(region);
        } catch { finish(null, new ObservationError('capture_region_invalid')); }
      };
      active = { finish };
      try {
        window = new BrowserWindow({ ...screenBounds,
          title: '微光指引 · 本人框选观察区域', frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
          show: false, resizable: false, movable: false, hasShadow: false,
          webPreferences: { preload: path.join(__dirname, 'region-selector-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } });
        window.setContentProtection(true);
        window.setBounds(screenBounds);
        contentBounds = { ...window.getContentBounds() };
        if (!['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(contentBounds[key]))) throw new ObservationError('capture_region_invalid');
        const left = Math.max(screenBounds.x, contentBounds.x);
        const top = Math.max(screenBounds.y, contentBounds.y);
        const viewport = validateObservationRegion({ x: left - contentBounds.x, y: top - contentBounds.y,
          width: Math.min(screenBounds.x + screenBounds.width, contentBounds.x + contentBounds.width) - left,
          height: Math.min(screenBounds.y + screenBounds.height, contentBounds.y + contentBounds.height) - top }, contentBounds.width, contentBounds.height);
        if (viewport.width < 32 || viewport.height < 32) throw new ObservationError('capture_region_invalid');
        const query = Object.fromEntries(Object.entries(viewport).map(([key, value]) => [key, String(value)]));
        const url = pathToFileURL(page);
        url.search = new URLSearchParams(query).toString();
        pageUrl = url.href;
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', event => event.preventDefault());
        window.webContents.on('render-process-gone', () => finish(null, new ObservationError('capture_region_unavailable')));
        window.on('closed', () => finish(null));
        window.on('unresponsive', () => finish(null, new ObservationError('capture_region_unavailable')));
        window.on('blur', () => finish(null));
        ipcMain.on(channel, receive);
        Promise.resolve(window.loadFile(page, { query })).then(() => {
          if (!settled && !window.isDestroyed()) { window.show(); window.focus(); }
        }).catch(() => finish(null, new ObservationError('capture_region_unavailable')));
      } catch (error) { finish(null, new ObservationError(error?.code === 'capture_region_invalid' ? 'capture_region_invalid' : 'capture_region_unavailable')); }
    });
  }

  return { select, cancel, dispose: cancel };
}

module.exports = { createObservationRegionSelector };
