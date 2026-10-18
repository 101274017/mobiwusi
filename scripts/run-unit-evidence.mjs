import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDirectory = path.join(root, 'docs', 'implementation', 'evidence');
const outputPath = path.join(evidenceDirectory, 'unit-results.json');
const logPath = path.join(evidenceDirectory, 'unit.txt');

fs.mkdirSync(evidenceDirectory, { recursive: true });

const vitestArguments = [
  'exec',
  'vitest',
  'run',
  '--reporter=default',
  '--reporter=json',
  `--outputFile=${path.relative(root, outputPath).split(path.sep).join('/')}`,
];
const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const argumentsForCommand = process.platform === 'win32'
  ? ['/d', '/s', '/c', ['pnpm', ...vitestArguments].join(' ')]
  : vitestArguments;
const child = spawn(command, argumentsForCommand, {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

const log = fs.createWriteStream(logPath, { encoding: 'utf8' });

function mirror(stream, output) {
  stream.on('data', chunk => {
    output.write(chunk);
    log.write(chunk);
  });
}

mirror(child.stdout, process.stdout);
mirror(child.stderr, process.stderr);

child.on('error', error => {
  log.end(() => {
    console.error(error);
    process.exitCode = 1;
  });
});

child.on('close', (code, signal) => {
  log.end(() => {
    process.exitCode = typeof code === 'number' ? code : 1;
    if (signal) process.exitCode = 1;
  });
});
