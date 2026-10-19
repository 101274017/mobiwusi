const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const maxPngBytes = 2 * 1024 * 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const builtinBackup = Buffer.from('nuanban-artwork:builtin\n');

function createLocalArtworkStore({ filePath, nativeImage, fileSystem = fs }) {
  if (!path.isAbsolute(filePath)) throw new Error('原画仓储必须使用固定本机路径');
  const backupPath = filePath + '.previous';

  function hasBackup() {
    try { fileSystem.statSync(backupPath); return true; } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  function validate(png, dimensions) {
    if (!Buffer.isBuffer(png) || png.length < 33 || png.length > maxPngBytes || !png.subarray(0, 8).equals(pngSignature)
      || png.readUInt32BE(8) !== 13 || png.toString('ascii', 12, 16) !== 'IHDR') throw new Error('只接受有效且不超过 2 MiB 的本地 PNG 原画');
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (!width || !height || width > 800 || height > 480 || (dimensions && (dimensions.width !== width || dimensions.height !== height))) throw new Error('原画尺寸无效或与预览不一致');
    const image = nativeImage.createFromBuffer(png);
    const size = image.getSize();
    if (image.isEmpty() || size.width !== width || size.height !== height) throw new Error('本机无法读取这张原画');
    const bitmap = image.toBitmap();
    let visible = false;
    for (let offset = 3; offset < bitmap.length; offset += 4) {
      if (bitmap[offset]) { visible = true; break; }
    }
    if (bitmap.length !== width * height * 4 || !visible) throw new Error('原画没有可见笔画');
    const canonicalPng = image.toPNG();
    if (!canonicalPng.length || canonicalPng.length > maxPngBytes) throw new Error('原画编码过大，请减少内容后重试');
    return { png: canonicalPng, width, height };
  }

  function state(artwork, updatedAt) {
    return { kind: 'drawing', dataUrl: 'data:image/png;base64,' + artwork.png.toString('base64'), width: artwork.width, height: artwork.height, updatedAt };
  }

  function read() {
    const backup = hasBackup();
    const currentPath = backup ? backupPath : filePath;
    let metadata;
    try { metadata = fileSystem.statSync(currentPath); } catch (error) {
      if (error.code === 'ENOENT') return { kind: 'builtin' };
      throw new Error('本机原画无法读取，未更换桌宠');
    }
    if (!metadata.isFile() || metadata.size > maxPngBytes) throw new Error('本机原画文件无效，请重新预览并应用');
    const png = fileSystem.readFileSync(currentPath);
    if (backup && png.equals(builtinBackup)) return { kind: 'builtin' };
    return state(validate(png), metadata.mtime.toISOString());
  }

  function copyWithRecovery(temporaryPath, png) {
    if (!hasBackup()) {
      let previous;
      try { previous = fileSystem.readFileSync(filePath); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        previous = builtinBackup;
      }
      try { fileSystem.writeFileSync(backupPath, previous, { flag: 'wx', flush: true }); } catch (error) {
        if (error.code !== 'EEXIST') { try { fileSystem.unlinkSync(backupPath); } catch {} }
        throw error;
      }
    }
    fileSystem.copyFileSync(temporaryPath, filePath);
    const descriptor = fileSystem.openSync(filePath, 'r+');
    try {
      fileSystem.fsyncSync(descriptor);
      if (!fileSystem.readFileSync(descriptor).equals(png)) throw new Error('原画写入核验未通过');
    } finally { fileSystem.closeSync(descriptor); }
    fileSystem.unlinkSync(backupPath);
  }

  function apply(input) {
    if (!input || typeof input.dataUrl !== 'string' || input.dataUrl.length > Math.ceil(maxPngBytes / 3) * 4 + 22
      || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.dataUrl)) throw new Error('只接受本机预览产生的 PNG 原画，不接受地址或文件路径');
    const encoded = input.dataUrl.slice(22);
    const png = Buffer.from(encoded, 'base64');
    if (png.toString('base64') !== encoded) throw new Error('原画编码无效');
    const artwork = validate(png, input);
    const temporaryPath = filePath + '.' + randomUUID() + '.tmp';
    try {
      fileSystem.mkdirSync(path.dirname(filePath), { recursive: true });
      fileSystem.writeFileSync(temporaryPath, artwork.png, { flag: 'wx', flush: true });
      if (hasBackup()) copyWithRecovery(temporaryPath, artwork.png);
      else {
        try { fileSystem.renameSync(temporaryPath, filePath); } catch (error) {
          if (error.code !== 'EXDEV') throw error;
          copyWithRecovery(temporaryPath, artwork.png);
        }
      }
    } catch (error) {
      const detail = error.code === 'ENOSPC' ? '（磁盘空间不足）'
        : ['EACCES', 'EPERM'].includes(error.code) ? '（本机资料目录无法写入）' : '';
      throw new Error('原画保存失败' + detail + '，上一张桌宠未替换，原稿仍保留，请重试');
    } finally {
      try { fileSystem.unlinkSync(temporaryPath); } catch {}
    }
    return state(artwork, new Date().toISOString());
  }

  function clear() {
    for (const currentPath of [filePath, backupPath]) {
      try { fileSystem.unlinkSync(currentPath); } catch (error) {
        if (error.code !== 'ENOENT') throw new Error('恢复内置桌宠失败，请重试');
      }
    }
    return { kind: 'builtin' };
  }

  return { read, apply, clear };
}

function registerLocalArtworkBridge({ ipcMain, store, isManagementTrusted, getManagementWindow, getToolWindow = () => undefined, getPetWindow, onChange = () => {} }) {
  const petUrl = pathToFileURL(path.join(__dirname, 'pet.html')).href;
  const channels = ['nuanban:artwork:read', 'nuanban:artwork:apply', 'nuanban:artwork:clear'];

  function trustedPet(event) {
    const window = getPetWindow();
    return window && !window.isDestroyed() && event.sender === window.webContents
      && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url.split('#')[0] === petUrl;
  }

  function publish(artwork) {
    for (const window of [getManagementWindow(), getToolWindow(), getPetWindow()]) {
      if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('nuanban:artwork:changed', artwork);
    }
    return artwork;
  }

  ipcMain.handle(channels[0], event => {
    if (!isManagementTrusted(event) && !trustedPet(event)) throw new Error('不可信原画读取来源');
    return store.read();
  });
  ipcMain.handle(channels[1], (event, input) => {
    if (!isManagementTrusted(event)) throw new Error('只有本人管理窗口可以确认使用原画');
    const artwork = store.apply(input);
    onChange();
    return publish(artwork);
  });
  ipcMain.handle(channels[2], event => {
    if (!isManagementTrusted(event)) throw new Error('只有本人管理窗口可以恢复内置桌宠');
    const artwork = store.clear();
    onChange();
    return publish(artwork);
  });
  return { dispose: () => channels.forEach(channel => ipcMain.removeHandler(channel)) };
}

module.exports = { createLocalArtworkStore, registerLocalArtworkBridge };
