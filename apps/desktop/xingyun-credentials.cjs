const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { externalScriptPath } = require('./external-script-path.cjs');

function decryptSecret(encrypted) {
  return new Promise((resolve, reject) => {
    const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', externalScriptPath(path.join(__dirname, 'read-provider-secret.ps1'))], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => child.kill(), 6000);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 4096) child.kill(); else chunks.push(chunk); });
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('星云凭证解密失败')); });
    child.on('close', code => {
      clearTimeout(timer);
      const bytes = Buffer.concat(chunks);
      const secret = bytes.toString('utf8');
      bytes.fill(0);
      for (const chunk of chunks) chunk.fill(0);
      if (code !== 0 || size > 4096 || !/^[A-Za-z0-9_-]{16,128}$/.test(secret)) reject(new Error('星云凭证解密失败'));
      else resolve(secret);
    });
    child.stdin.end(encrypted);
  });
}

async function loadXingyunCredentials(options = {}) {
  const configurationPath = options.configurationPath ?? path.join(process.env.LOCALAPPDATA ?? '', 'Nuanban', 'xingyun-avatar.json');
  let content;
  try { content = await readFile(configurationPath); } catch (error) { if (error.code === 'ENOENT') return undefined; throw new Error('星云配置读取失败'); }
  if (content.length > 32768) throw new Error('星云配置无效');
  let configuration;
  try { configuration = JSON.parse(content.toString('utf8')); } catch { throw new Error('星云配置无效'); }
  if (configuration?.version !== 1 || configuration.credentialFormat !== 'windows-dpapi-v1'
    || typeof configuration.appId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(configuration.appId)
    || typeof configuration.encryptedSecret !== 'string' || !/^[A-Za-z0-9+/]{20,24000}={0,2}$/.test(configuration.encryptedSecret)) throw new Error('星云配置无效');
  const appSecret = await (options.decrypt ?? decryptSecret)(configuration.encryptedSecret);
  if (typeof appSecret !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(appSecret)) throw new Error('星云凭证无效');
  return { appId: configuration.appId, appSecret };
}

module.exports = { loadXingyunCredentials };
