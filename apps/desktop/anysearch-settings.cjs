const fs = require('node:fs');
const path = require('node:path');

function validApiKey(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 4096 && /^[\x21-\x7E]+$/u.test(value);
}

function createAnySearchKeyStore({ userDataPath, safeStorage }) {
  if (typeof userDataPath !== 'string' || !path.isAbsolute(userDataPath)) throw new TypeError('搜索配置目录无效');
  const filePath = path.join(userDataPath, 'nuanban-anysearch-key.bin');
  const encryptionReady = () => {
    try {
      return safeStorage?.isEncryptionAvailable?.() === true && typeof safeStorage.encryptString === 'function'
        && typeof safeStorage.decryptString === 'function' && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
    } catch { return false; }
  };

  function read() {
    try {
      if (!encryptionReady() || !fs.existsSync(filePath)) return undefined;
      const details = fs.lstatSync(filePath);
      if (!details.isFile() || details.size < 1 || details.size > 16 * 1024) return undefined;
      const key = safeStorage.decryptString(fs.readFileSync(filePath));
      return validApiKey(key) ? key : undefined;
    } catch { return undefined; }
  }

  function save(key) {
    if (!validApiKey(key)) throw new TypeError('AnySearch 密钥格式无效');
    if (!encryptionReady()) throw new Error('系统加密不可用，未保存搜索密钥。');
    let encrypted;
    try { encrypted = safeStorage.encryptString(key); } catch { throw new Error('搜索密钥加密失败，未保存。'); }
    if (!Buffer.isBuffer(encrypted) || encrypted.length < 1 || encrypted.length > 16 * 1024) throw new Error('搜索密钥加密失败，未保存。');
    const temporaryPath = `${filePath}.tmp`;
    let created = false;
    try {
      fs.mkdirSync(userDataPath, { recursive: true });
      fs.writeFileSync(temporaryPath, encrypted, { flag: 'wx', mode: 0o600 });
      created = true;
      fs.renameSync(temporaryPath, filePath);
      created = false;
    } catch { throw new Error('搜索密钥保存失败，未保存明文。'); }
    finally { if (created) { try { fs.unlinkSync(temporaryPath); } catch {} } }
    return { saved: true };
  }

  return Object.freeze({ read, save });
}

module.exports = { createAnySearchKeyStore, validApiKey };
