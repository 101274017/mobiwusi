// Configure or clear the server-side vision provider for the 寰厜鎸囧紩 (nuanban) ECS deployment.
//
// The provider triple (base URL / model / API key) is written to
// C:\nuanban\config\vision-provider.json, locked to SYSTEM + Administrators, and loaded into the
// Node service environment by infra/windows/start-server.ps1. Keys never enter the repository,
// the payload, the IIS site, or any frontend bundle.
//
// Usage:
//   # read the key from an environment variable (preferred; avoids shell history)
//   $env:NUANBAN_VISION_API_KEY='<key>'
//   node infra/windows/tools/configure-vision-provider.mjs --base-url https://gw.example.com/v1 \
//        --model gpt-4o-mini --instance i-xxx
//
//   # or from a local file (kept outside the repo, e.g. .cache/vision-key.txt)
//   node ... --api-key-file .cache/vision-key.txt ...
//
//   # clear the provider again
//   node ... --clear --instance i-xxx
//
// The server itself enforces HTTPS, rejects URL credentials/query/fragment, private hosts and
// IP literals before any request leaves the machine; this tool only validates the obvious parts.

import fs from 'node:fs';
import path from 'node:path';
import { createClient, loadCredentials } from './aliyun-ecs-api.mjs';

const REMOTE_CONFIG_DIR = 'C:\\nuanban\\config';
const REMOTE_CONFIG_FILE = `${REMOTE_CONFIG_DIR}\\vision-provider.json`;
const TASK_NAME = 'NuanbanServer';

function fail(message) {
  console.error(`configure-vision-provider: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { region: 'cn-beijing', clear: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) fail(`missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '--instance': args.instanceId = next(); break;
      case '--region': args.region = next(); break;
      case '--base-url': args.baseUrl = next(); break;
      case '--model': args.model = next(); break;
      case '--vision-model': args.visionModel = next(); break;
      case '--api-key-file': args.apiKeyFile = next(); break;
      case '--ak-file': args.akFile = next(); break;
      case '--clear': args.clear = true; break;
      default: fail(`unknown argument: ${arg}`);
    }
  }
  if (!args.instanceId) fail('--instance is required');
  if (!args.clear) {
    if (!args.baseUrl) fail('--base-url is required (or use --clear)');
    if (!args.model) fail('--model is required (or use --clear)');
    if (!args.apiKeyFile && !process.env.NUANBAN_VISION_API_KEY) {
      fail('set NUANBAN_VISION_API_KEY or pass --api-key-file (or use --clear)');
    }
  }
  return args;
}

function validateBaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('--base-url is not a valid URL');
  }
  if (url.protocol !== 'https:') fail('--base-url must use https:// (the server rejects plain HTTP in production)');
  if (url.username || url.password) fail('--base-url must not contain credentials');
  if (url.search || url.hash) fail('--base-url must not contain a query or fragment');
  return url.toString().replace(/\/$/, '');
}

function readApiKey(args) {
  if (args.apiKeyFile) {
    const file = path.resolve(args.apiKeyFile);
    if (!fs.existsSync(file)) fail(`api key file not found: ${file}`);
    return fs.readFileSync(file, 'utf8').trim();
  }
  return process.env.NUANBAN_VISION_API_KEY.trim();
}

const restarter = (kind) => `$ErrorActionPreference = 'Continue'
$configDir = '${REMOTE_CONFIG_DIR}'
$configFile = '${REMOTE_CONFIG_FILE}'
if (${kind === 'clear' ? '$true' : '$false'}) {
  if (Test-Path -LiteralPath $configFile) {
    Remove-Item -LiteralPath $configFile -Force
    Write-Host 'provider config removed'
  } else {
    Write-Host 'provider config already absent'
  }
} else {
  if (Test-Path -LiteralPath $configFile) {
    & icacls.exe $configFile /inheritance:r /grant 'SYSTEM:F' /grant 'Administrators:F' | Out-Null
    Write-Host 'provider config ACL locked to SYSTEM/Administrators'
  } else {
    throw 'provider config file missing after upload'
  }
}
# The supervisor reads provider env at start, so restart the task and its node child.
Stop-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue
try {
  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
} catch { }
try {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains('start-server.ps1') } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch { }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName '${TASK_NAME}'
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/healthz' -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
}
Write-Host ("service healthy: " + $healthy)
$log = 'C:\\nuanban\\logs\\server.log'
if (Test-Path -LiteralPath $log) {
  Get-Content -LiteralPath $log -Tail 6 -Encoding UTF8 | Where-Object { $_ -match 'vision provider|supervisor start|listening' } | ForEach-Object { Write-Host $_ }
}
if (-not $healthy) { exit 1 }
exit 0
`;

async function main() {
  const args = parseArgs(process.argv);
  const client = createClient({ credentials: loadCredentials({ akFile: args.akFile }), regionId: args.region });
  const instance = await client.describeInstance(args.instanceId);
  if (instance.Status !== 'Running') fail(`instance is ${instance.Status}, expected Running`);

  if (args.clear) {
    const invoke = await client.runCommand({
      instanceId: args.instanceId,
      script: restarter('clear'),
      timeout: 180,
      name: 'nuanban-vision-clear',
    });
    await report(client, invoke.InvokeId);
    return;
  }

  const baseUrl = validateBaseUrl(args.baseUrl);
  const apiKey = readApiKey(args);
  if (!apiKey || apiKey.length < 8) fail('api key looks empty or too short');
  if (!args.model.trim()) fail('--model must not be empty');

  const payload = JSON.stringify(
    {
      baseUrl,
      model: args.model.trim(),
      visionModel: (args.visionModel ?? args.model).trim(),
      apiKey,
      updatedAt: new Date().toISOString(),
      note: 'Owner-provided server-side vision provider. Loaded by start-server.ps1 into NUANBAN_VISION_*.',
    },
    null,
    2
  );

  // SendFile writes plain/base64 content through Cloud Assistant; the key is not echoed back.
  const invoke = await client.sendFile({
    instanceId: args.instanceId,
    name: 'vision-provider.json',
    contentBase64: Buffer.from(payload, 'utf8').toString('base64'),
    targetDir: REMOTE_CONFIG_DIR,
    timeout: 120,
    overwrite: true,
  });
  console.log(`provider file dispatched (${invoke.InvokeId}); restarting service`);
  for (let i = 0; i < 40; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const results = await client.describeSendFileResults(args.instanceId, 'vision-provider.json');
    const latest = results.sort((a, b) => Date.parse(b.CreationTime) - Date.parse(a.CreationTime))[0];
    if (latest && ['Success', 'Failed', 'Timeout', 'PartialFailed'].includes(latest.InvocationStatus)) {
      if (latest.InvocationStatus !== 'Success') fail(`SendFile failed: ${latest.InvocationStatus}`);
      break;
    }
  }

  const command = await client.runCommand({
    instanceId: args.instanceId,
    script: restarter('apply'),
    timeout: 180,
    name: 'nuanban-vision-apply',
  });
  await report(client, command.InvokeId, { baseUrl, model: args.model.trim() });
}

async function report(client, invokeId, details) {
  for (let i = 0; i < 60; i++) {
    const results = await client.describeInvocationResults(invokeId);
    const invocation = results[0];
    const status = invocation?.InvocationStatus;
    if (status && !['Pending', 'Running'].includes(status)) {
      const output = invocation.Output ?? '';
      const text = /^[A-Za-z0-9+/=\r\n]+$/.test(output.trim()) && output.trim()
        ? Buffer.from(output.trim(), 'base64').toString('utf8')
        : output;
      console.log(text);
      if (details) console.log(`provider: ${details.baseUrl} model=${details.model} (api key hidden)`);
      if (status !== 'Success') process.exitCode = 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  fail('timed out waiting for the on-host command');
}

main().catch((error) => {
  console.error(`configure-vision-provider failed: ${error.message}`);
  process.exitCode = 1;
});
