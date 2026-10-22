// Minimal Aliyun ECS OpenAPI (RPC style, SignatureVersion 1.0) client used by the Windows
// deployment tooling under infra/windows/tools.
//
// Credentials are read from the environment (ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET)
// or from a local JSON file that must stay outside version control (default:
// .cache/aliyun-ak.json, which is gitignored). Secrets are never printed by this module.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ENDPOINT = 'https://ecs.cn-beijing.aliyuncs.com/';
const API_VERSION = '2014-05-26';

function percentEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

export function loadCredentials({ akFile } = {}) {
  const fromEnv = {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  };
  if (fromEnv.accessKeyId && fromEnv.accessKeySecret) {
    return { ...fromEnv, source: 'env' };
  }
  const file = akFile ?? process.env.ALIYUN_AK_FILE ?? path.resolve('.cache/aliyun-ak.json');
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const accessKeyId = parsed.accessKeyId ?? parsed.AccessKeyId ?? parsed.AccessKeyID;
    const accessKeySecret =
      parsed.accessKeySecret ?? parsed.AccessKeySecret ?? parsed.AccessKeySecretValue;
    if (accessKeyId && accessKeySecret) {
      return { accessKeyId, accessKeySecret, source: `file:${path.basename(file)}` };
    }
  }
  throw new Error(
    'Missing Aliyun credentials: set ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET, ' +
      'or write {"accessKeyId":"...","accessKeySecret":"..."} to .cache/aliyun-ak.json'
  );
}

export function signParams(params, accessKeySecret) {
  const keys = Object.keys(params).sort();
  const canonical = keys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const stringToSign = `POST&%2F&${percentEncode(canonical)}`;
  const signature = crypto
    .createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign, 'utf8')
    .digest('base64');
  return { ...params, Signature: signature };
}

function buildBody(signed) {
  return Object.keys(signed)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(signed[k])}`)
    .join('&');
}

async function httpsPost(endpoint, body) {
  const url = new URL(endpoint);
  const payload = Buffer.from(body, 'utf8');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': String(payload.length),
      'x-acs-version': API_VERSION,
    },
    body: payload,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Aliyun API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }
  if (!res.ok || parsed.Code) {
    const err = new Error(
      `Aliyun API ${parsed.Code ?? 'HTTP ' + res.status}: ${parsed.Message ?? text.slice(0, 300)}`
    );
    err.code = parsed.Code;
    err.requestId = parsed.RequestId;
    err.status = res.status;
    throw err;
  }
  return parsed;
}

export function createClient({ credentials, regionId = 'cn-beijing', endpoint } = {}) {
  const creds = credentials ?? loadCredentials();
  const resolvedEndpoint =
    endpoint ?? `https://ecs.${regionId}.aliyuncs.com/`;

  async function call(action, params = {}, { retries = 3 } = {}) {
    const base = {
      Action: action,
      Version: API_VERSION,
      Format: 'JSON',
      AccessKeyId: creds.accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: crypto.randomUUID(),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      RegionId: regionId,
      ...params,
    };
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const signed = signParams(base, creds.accessKeySecret);
        return await httpsPost(resolvedEndpoint, buildBody(signed));
      } catch (error) {
        lastError = error;
        const retryable =
          !error.code ||
          ['Throttling', 'ServiceUnavailable', 'InternalError', 'UnknownError'].includes(error.code) ||
          (error.status && error.status >= 500);
        if (!retryable || attempt === retries) break;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  async function describeInstance(instanceId) {
    const res = await call('DescribeInstances', { InstanceIds: JSON.stringify([instanceId]) });
    const instance = res.Instances?.Instance?.[0];
    if (!instance) throw new Error(`instance not found: ${instanceId}`);
    return instance;
  }

  async function cloudAssistantStatus(instanceId) {
    const res = await call('DescribeCloudAssistantStatus', {
      InstanceId: JSON.stringify([instanceId]),
    });
    const entry = res.InstanceCloudAssistantStatus?.InstanceCloudAssistantStatus?.[0];
    if (!entry) throw new Error('cloud assistant status unavailable for instance');
    return entry;
  }

  async function sendFile({ instanceId, name, contentBase64, targetDir, timeout = 120, overwrite = true }) {
    return call('SendFile', {
      InstanceId: JSON.stringify([instanceId]),
      Name: name,
      Content: contentBase64,
      ContentType: 'Base64',
      TargetDir: targetDir,
      Timeout: String(timeout),
      Overwrite: overwrite ? 'true' : 'false',
    });
  }

  async function describeSendFileResults(instanceId, name, page = 1, pageSize = 50) {
    const params = { InstanceId: instanceId, PageNumber: String(page), PageSize: String(pageSize) };
    if (name) params.Name = name;
    const res = await call('DescribeSendFileResults', params);
    return res.Invocations?.Invocation ?? [];
  }

  async function runCommand({ instanceId, script, timeout = 1800, name = 'nuanban-deploy' }) {
    const contentBase64 = Buffer.from(script, 'utf8').toString('base64');
    return call('RunCommand', {
      InstanceId: JSON.stringify([instanceId]),
      Type: 'RunPowerShellScript',
      ContentEncoding: 'Base64',
      CommandContent: contentBase64,
      Timeout: String(timeout),
      Name: name,
    });
  }

  async function describeInvocationResults(invokeId) {
    const res = await call('DescribeInvocationResults', { InvokeId: invokeId });
    return res.InvocationResults?.InvocationResult ?? [];
  }

  async function describeSecurityGroupAttribute(securityGroupId) {
    return call('DescribeSecurityGroupAttribute', {
      SecurityGroupId: securityGroupId,
      Direction: 'ingress',
    });
  }

  async function authorizeSecurityGroupIngress({ securityGroupId, port, description }) {
    return call('AuthorizeSecurityGroup', {
      SecurityGroupId: securityGroupId,
      IpProtocol: 'tcp',
      PortRange: `${port}/${port}`,
      SourceCidrIp: '0.0.0.0/0',
      Description: description ?? `nuanban http ${port}`,
    });
  }

  return {
    endpoint: resolvedEndpoint,
    regionId,
    call,
    describeInstance,
    cloudAssistantStatus,
    sendFile,
    describeSendFileResults,
    runCommand,
    describeInvocationResults,
    describeSecurityGroupAttribute,
    authorizeSecurityGroupIngress,
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
