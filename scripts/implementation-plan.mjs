import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const canonicalName = '暖伴AI公益助手-项目实施计划-Codex高效续作版.md';

export function readImplementationPlan(rootDirectory) {
  const candidates = [];
  for (const directory of ['', 'docs']) {
    const absoluteDirectory = path.resolve(rootDirectory, directory);
    if (!existsSync(absoluteDirectory)) continue;
    for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const relativePath = [directory, entry.name].filter(Boolean).join('/');
      const contents = readFileSync(path.resolve(rootDirectory, relativePath));
      const text = contents.toString('utf8');
      if (!/^# [^\r\n]*项目实施计划/mu.test(text) || !/^\|\s*版本\s*\|\s*V1\.2[，,\s|]/mu.test(text)) continue;
      candidates.push({ path: relativePath, exists: true, text, bytes: contents.byteLength, contentSha256: createHash('sha256').update(contents).digest('hex') });
    }
  }
  if (candidates.length === 0) return { path: canonicalName, exists: false, text: '', bytes: 0, contentSha256: null };
  if (new Set(candidates.map(candidate => candidate.contentSha256)).size !== 1) throw new Error('Conflicting V1.2 implementation plans; refusing to select different task baselines silently.');
  candidates.sort((left, right) => Number(left.path.includes('/')) - Number(right.path.includes('/'))
    || Number(left.path !== canonicalName) - Number(right.path !== canonicalName)
    || left.path.localeCompare(right.path));
  return candidates[0];
}
