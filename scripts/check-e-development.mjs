import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDevelopmentEligible, isFormalD07Go } from './project-gate.mjs';
import { runD07DecisionCheck } from './check-d07-decision.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function exists(relativePath) {
  return existsSync(path.resolve(root, relativePath));
}

function readJson(relativePath) {
  try { return JSON.parse(readFileSync(path.resolve(root, relativePath), 'utf8')); } catch { return null; }
}

const evidence = readJson('docs/implementation/evidence/d-gate-readiness-results.json');
const d07FormalGo = isFormalD07Go(readJson('docs/implementation/evidence/d07-decision.json'));
const currentDecisionCheck = runD07DecisionCheck();
const taskEvidence = {
  E01: [['apps/server/src/auth.ts'], ['tests/server/auth.test.ts']],
  E02: [['apps/server/src/family.ts'], ['tests/server/family.test.ts']],
  E03: [['packages/sync-engine/src/services.ts'], ['tests/sync/sync-engine.test.ts']],
  E04: [['packages/sync-engine/src/services.ts'], ['tests/sync/sync-engine.test.ts']],
  E05: [['packages/sync-engine/src/services.ts'], ['tests/sync/sync-engine.test.ts']],
  E06: [['packages/asset-service/src/index.ts'], ['tests/assets/asset-service.test.ts']],
  E07: [['apps/server/src/http.ts'], ['tests/server/http.test.ts']],
  E08: [['packages/provider-sandbox/src/index.ts'], ['tests/provider/e08-e12.test.ts']],
  E09: [['packages/asset-service/src/index.ts'], ['tests/assets/asset-service.test.ts']],
  E10: [['packages/media-session/src/index.ts'], ['tests/media-session/media-session.test.ts']],
  E11: [['packages/provider-sandbox/src/index.ts'], ['tests/provider/e08-e12.test.ts']],
  E12: [['packages/provider-sandbox/src/index.ts'], ['tests/provider/e08-e12.test.ts']],
  E13: [['packages/api-client/src/remote.ts'], ['tests/contract/remote-api-client.test.ts']],
  E14: [['packages/api-client/src/index.ts'], ['tests/contract/remote-api-client.test.ts']],
  E15: [['packages/api-client/src/index.ts'], ['tests/contract/remote-api-client.test.ts']],
  E16: [['packages/contracts/src/validation.ts'], ['tests/contract/schema.test.ts']],
  E17: [['apps/android/app/src/main/AndroidManifest.xml'], ['tests/native/android-lab.test.ts']],
  E18: [['apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt'], ['tests/native/android-lab.test.ts']],
  E19: [['apps/desktop/native-runtime.cjs'], ['tests/platform/desktop-native-runtime.test.ts']],
  E20: [['apps/desktop/native-runtime.cjs'], ['tests/platform/desktop-native-runtime.test.ts']],
  E21: [['packages/accessibility-assets/src/index.ts'], ['tests/accessibility/e21.test.ts']],
  E22: [['packages/quality-gates/src/index.ts'], ['tests/quality/e22-e23.test.ts']],
  E23: [['packages/quality-gates/src/index.ts'], ['tests/quality/e22-e23.test.ts']],
  E24: [['packages/flow-library/src/index.ts'], ['tests/flows/e24-e26.test.ts']],
  E25: [['scripts/check-release-readiness.mjs'], ['tests/acceptance/release-readiness.test.ts']],
  E26: [['packages/flow-library/src/index.ts'], ['tests/flows/e24-e26.test.ts']],
};

const tasks = Object.entries(taskEvidence).map(([id, [code, tests]]) => {
  const codePresent = code.some(exists);
  const testsPresent = tests.some(exists);
  return { id, code, tests, codePresent, testsPresent, status: codePresent && testsPresent ? 'implemented' : codePresent || testsPresent ? 'blocked' : 'not_started' };
});
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'E01-E26 development-only implementation evidence',
  mode: 'development_only',
  d07FormalGo,
  developmentGateEligible: isDevelopmentEligible(evidence) && currentDecisionCheck.development.eligible,
  developmentBlockers: currentDecisionCheck.developmentBlockers,
  d07GateStillBlocked: evidence?.status === 'blocked' && evidence?.goNoGoEligible === false,
  realNetworkEnabled: false,
  productionDataEnabled: false,
  fStarted: false,
  tasks,
  allCodeAndTestsPresent: tasks.every(task => task.status === 'implemented'),
  limitations: ['不代表 D07 正式 Go。', '不代表真实设备、供应、人工验收、联调或发布通过。', '只统计代码和测试入口，不把合成证据升级为生产证据。'],
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.developmentGateEligible && report.allCodeAndTestsPresent ? 0 : 1;
