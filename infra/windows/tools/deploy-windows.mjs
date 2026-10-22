// Push the 微光指引 (nuanban) Windows payload to an Aliyun ECS instance and run the
// on-host deployment script through Cloud Assistant.
//
// Usage:
//   node infra/windows/tools/deploy-windows.mjs --instance i-xxx [--region cn-beijing]
//        [--port 80] [--api-port 3000] [--skip-proxy] [--open-port] [--inspect-only]
//        [--ak-file .cache/aliyun-ak.json] [--chunk-bytes 20000] [--concurrency 4]
//
// Credentials: ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET, or a gitignored JSON file.
// This tool never prints the secret and never writes credentials into the repository.

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { createClient, loadCredentials, sleep } from './aliyun-ecs-api.mjs';
import { buildPayload } from './package-payload.mjs';

const root = path.resolve(import.meta.dirname, '..', '..', '..');

function parseArgs(argv) {
  const args = {
    region: 'cn-beijing',
    port: 80,
    apiPort: 3000,
    chunkBytes: 20_000,
    concurrency: 4,
    skipProxy: false,
    openPort: false,
    inspectOnly: false,
    noPackage: false,
    chunkDir: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '--instance': args.instanceId = next(); break;
      case '--region': args.region = next(); break;
      case '--port': args.port = Number.parseInt(next(), 10); break;
      case '--api-port': args.apiPort = Number.parseInt(next(), 10); break;
      case '--ak-file': args.akFile = next(); break;
      case '--chunk-bytes': args.chunkBytes = Number.parseInt(next(), 10); break;
      case '--concurrency': args.concurrency = Number.parseInt(next(), 10); break;
      case '--chunk-dir': args.chunkDir = next(); break;
      case '--skip-proxy': args.skipProxy = true; break;
      case '--open-port': args.openPort = true; break;
      case '--inspect-only': args.inspectOnly = true; break;
      case '--no-package': args.noPackage = true; break;
      default: throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!args.instanceId) throw new Error('--instance is required (e.g. i-2zedkag2x1e9e610v8jh)');
  return args;
}

function log(message) {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`[${time}] ${message}`);
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function publicHttpGet(url, timeoutMs = 15_000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    try {
      const req = client.get(url, { headers: { 'user-agent': 'nuanban-deploy-check' } }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
        );
      });
      req.on('error', (error) => resolve({ status: 0, error: error.message }));
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve({ status: 0, error: 'timeout' });
      });
    } catch (error) {
      resolve({ status: 0, error: error.message });
    }
  });
}

async function pollSendFileResults(client, instanceId, names, timeoutMs = 300_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const invocations = [];
    for (let page = 1; page <= 8; page++) {
      const batch = await client.describeSendFileResults(instanceId, undefined, page);
      invocations.push(...batch);
      if (batch.length < 50) break;
    }
    const byName = new Map();
    for (const invocation of invocations) byName.set(invocation.Name, invocation);
    const states = names.map((name) => byName.get(name)?.InvocationStatus ?? 'Missing');
    const pending = states.filter((state) => !['Success', 'Failed', 'Timeout', 'PartialFailed'].includes(state));
    if (pending.length === 0) return { states, invocations };
    await sleep(5000);
  }
  throw new Error('timed out waiting for SendFile results');
}

async function main() {
  const args = parseArgs(process.argv);
  const credentials = loadCredentials({ akFile: args.akFile });
  const client = createClient({ credentials, regionId: args.region });
  log(`using credentials from ${credentials.source}; endpoint ${client.endpoint}`);

  const instance = await client.describeInstance(args.instanceId);
  const info = {
    instanceId: instance.InstanceId,
    name: instance.InstanceName,
    status: instance.Status,
    os: instance.OSName,
    publicIp: instance.PublicIpAddress?.IpAddress?.[0] ?? null,
    privateIp: instance.PrivateIpAddress?.IpAddress?.[0] ?? instance.VpcAttributes?.PrivateIpAddress?.IpAddress?.[0] ?? null,
    securityGroups: instance.SecurityGroupIds?.SecurityGroupId ?? [],
    region: instance.RegionId,
  };
  console.log(JSON.stringify(info, null, 2));

  if (info.status !== 'Running') throw new Error(`instance is ${info.status}, expected Running`);

  const assistant = await client.cloudAssistantStatus(args.instanceId);
  log(`cloud assistant: installed=${assistant.CloudAssistantStatus} version=${assistant.CloudAssistantVersion ?? 'unknown'}`);
  if (assistant.CloudAssistantStatus !== 'true' && assistant.CloudAssistantStatus !== true) {
    throw new Error('cloud assistant agent is not running on the instance');
  }

  if (args.inspectOnly) {
    for (const groupId of info.securityGroups) {
      const rules = await client.describeSecurityGroupAttribute(groupId);
      const permissions = rules.Permissions?.Permission ?? [];
      console.log(`\nsecurity group ${groupId} ingress rules:`);
      for (const rule of permissions) {
        const port = rule.PortRange ?? '-';
        if (rule.IpProtocol === 'tcp' || rule.IpProtocol === '-1') {
          console.log(`  ${rule.IpProtocol} ${port} <- ${rule.SourceCidrIp} (${rule.Description ?? ''})`);
        }
      }
    }
    log('inspect-only: stopping before payload changes');
    return;
  }

  // ---------------------------------------------------------------- security group
  const portOpen = (groupId, port) =>
    client.describeSecurityGroupAttribute(groupId).then((rules) =>
      (rules.Permissions?.Permission ?? []).some((rule) => {
        if (rule.IpProtocol !== 'tcp') return false;
        const [from, to] = String(rule.PortRange ?? '').split('/').map((v) => Number.parseInt(v, 10));
        return from <= port && port <= (Number.isNaN(to) ? from : to);
      })
    );
  for (const groupId of info.securityGroups) {
    const open = await portOpen(groupId, args.port);
    log(`security group ${groupId}: tcp/${args.port} ${open ? 'open' : 'closed'}`);
    if (!open) {
      if (!args.openPort) {
        throw new Error(`tcp/${args.port} is closed in ${groupId}; re-run with --open-port to authorize 0.0.0.0/0`);
      }
      await client.authorizeSecurityGroupIngress({ securityGroupId: groupId, port: args.port });
      log(`authorized inbound tcp/${args.port} in ${groupId}`);
    }
  }

  // ---------------------------------------------------------------- payload
  let payload;
  if (args.noPackage) {
    const zipPath = path.join(root, '.cache', 'windows-release', 'nuanban-payload.zip');
    payload = { zipPath, bytes: fs.statSync(zipPath).size };
    log(`reusing payload ${zipPath}`);
  } else {
    payload = buildPayload();
    log(`payload built: ${payload.zipPath} (${payload.files} files, ${payload.bytes} bytes)`);
  }
  const zip = fs.readFileSync(payload.zipPath);

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const remoteChunkDir = args.chunkDir ?? `C:\\nuanban\\staging\\chunks-${stamp}`;
  const chunks = [];
  for (let offset = 0, index = 0; offset < zip.length; offset += args.chunkBytes, index++) {
    const slice = zip.subarray(offset, Math.min(offset + args.chunkBytes, zip.length));
    chunks.push({
      name: `payload.part-${String(index + 1).padStart(4, '0')}.bin`,
      base64: slice.toString('base64'),
      bytes: slice.length,
    });
  }
  log(`pushing ${chunks.length} chunks of <=${args.chunkBytes} bytes to ${remoteChunkDir}`);

  let uploaded = 0;
  await runPool(chunks, args.concurrency, async (chunk) => {
    await client.sendFile({
      instanceId: args.instanceId,
      name: chunk.name,
      contentBase64: chunk.base64,
      targetDir: remoteChunkDir,
      timeout: 120,
    });
    uploaded += 1;
    if (uploaded % 10 === 0 || uploaded === chunks.length) log(`  sendfile dispatched ${uploaded}/${chunks.length}`);
  });

  const { states } = await pollSendFileResults(client, args.instanceId, chunks.map((c) => c.name));
  const failed = states.filter((state) => state !== 'Success');
  if (failed.length) {
    const detail = chunks
      .map((chunk, index) => ({ name: chunk.name, state: states[index] }))
      .filter((entry) => entry.state !== 'Success')
      .slice(0, 10);
    throw new Error(`SendFile failures: ${JSON.stringify(detail)}`);
  }
  log(`all ${chunks.length} chunks delivered`);

  // ---------------------------------------------------------------- deploy command
  const deployArgs = [`-HttpPort ${args.port}`, `-ApiPort ${args.apiPort}`];
  if (args.skipProxy) deployArgs.push('-SkipProxy');
  const launcher = `$ErrorActionPreference = 'Stop'
$staging = 'C:\\nuanban\\staging'
$chunkDir = '${remoteChunkDir}'
$chunks = @(Get-ChildItem -LiteralPath $chunkDir -Filter 'payload.part-*.bin' | Sort-Object Name)
if ($chunks.Count -ne ${chunks.length}) { throw "expected ${chunks.length} chunks, found $($chunks.Count)" }
$zipPath = Join-Path $staging 'payload.zip'
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
$stream = [System.IO.File]::Create($zipPath)
try {
  foreach ($chunk in $chunks) {
    $bytes = [System.IO.File]::ReadAllBytes($chunk.FullName)
    $stream.Write($bytes, 0, $bytes.Length)
  }
} finally { $stream.Dispose() }
Write-Host "[launcher] assembled $((Get-Item -LiteralPath $zipPath).Length) bytes from $($chunks.Count) chunks"
$extract = Join-Path $staging 'extract'
if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
Expand-Archive -LiteralPath $zipPath -DestinationPath $extract -Force
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'scripts\\deploy-server.ps1') -PayloadDir $extract ${deployArgs.join(' ')}
exit $LASTEXITCODE
`;
  log('running deploy-server.ps1 through Cloud Assistant (this can take several minutes)');
  const run = await client.runCommand({
    instanceId: args.instanceId,
    script: launcher,
    timeout: 1800,
    name: `nuanban-deploy-${stamp}`,
  });
  log(`command dispatched: ${run.InvokeId}`);

  let invocation = null;
  const started = Date.now();
  while (Date.now() - started < 25 * 60_000) {
    const results = await client.describeInvocationResults(run.InvokeId);
    invocation = results.find((entry) => entry.InstanceId === args.instanceId) ?? results[0];
    const status = invocation?.InvocationStatus;
    if (status && !['Pending', 'Running', 'Stopped'].includes(status)) break;
    await sleep(10_000);
  }
  const output = invocation?.Output ?? '';
  console.log('\n----- deploy output -----');
  console.log(output);
  console.log('----- end deploy output -----\n');
  log(`invocation status: ${invocation?.InvocationStatus ?? 'unknown'}, exit code: ${invocation?.ExitCode ?? 'n/a'}`);

  // ---------------------------------------------------------------- public verification
  if (info.publicIp) {
    const base = `http://${info.publicIp}${args.port === 80 ? '' : `:${args.port}`}`;
    for (const [label, url] of [
      ['index', `${base}/`],
      ['manifest.json', `${base}/models/lumi/character_manifest.json`],
      ['healthz', `${base}/healthz`],
    ]) {
      const response = await publicHttpGet(url);
      const preview = response.body ? response.body.replace(/\s+/g, ' ').slice(0, 160) : response.error ?? '';
      log(`public ${label}: HTTP ${response.status} ${preview}`);
    }
  } else {
    log('instance has no public IP; skipping public verification');
  }

  if (!invocation || invocation.InvocationStatus !== 'Success') {
    process.exitCode = 1;
    log('deploy command did not report Success; check the transcript path printed above');
  } else {
    log('deploy finished successfully');
  }
}

main().catch((error) => {
  console.error(`deploy failed: ${error.message}`);
  if (error.code) console.error(`code: ${error.code}, requestId: ${error.requestId ?? 'n/a'}`);
  process.exitCode = 1;
});
