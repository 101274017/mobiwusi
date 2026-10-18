import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileIndex = process.argv.indexOf('--file');
const relativeFile = fileIndex >= 0 ? process.argv[fileIndex + 1] : null;

const metadata = {
  'docs/implementation/evidence/privacy-c03-results.json': {
    scope: 'C03 local frame privacy gate synthetic test report',
    limitations: [
      '仅覆盖本地合成输入、授权/代际/时效门控和失败回退规则。',
      '没有真实 OCR、人脸模型、设备帧、编码器、网络发送或独立隐私复核记录。',
    ],
  },
  'docs/implementation/evidence/media-c04-results.json': {
    scope: 'C04 controlled media relay synthetic test report',
    limitations: [
      '仅覆盖内存中的安全票据、有界队列、双出口 stop fence 和合成失败路径。',
      '没有真实编码器、WebRTC、网络接收端、抓包结果或独立媒体安全复核记录。',
    ],
  },
};

if (!relativeFile || !metadata[relativeFile]) {
  throw new Error(`Unsupported evidence file: ${relativeFile ?? '(missing)'}`);
}

const absoluteFile = path.resolve(root, relativeFile);
const report = JSON.parse(readFileSync(absoluteFile, 'utf8'));
const now = new Date();
const enriched = {
  ...report,
  generatedAt: now.toISOString(),
  generatedDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(now),
  generatedTimeZone: 'Asia/Shanghai',
  scope: metadata[relativeFile].scope,
  testReport: path.basename(relativeFile),
  limitations: metadata[relativeFile].limitations,
};
writeFileSync(absoluteFile, `${JSON.stringify(enriched, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ file: relativeFile, generatedAt: enriched.generatedAt, scope: enriched.scope }, null, 2));
