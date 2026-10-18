import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../apps/server/src/auth.ts';
import { createSqliteRepositories } from '../../apps/server/src/sqlite.ts';
import type { SqliteRepositories } from '../../apps/server/src/sqlite.ts';

const temporaryDirectories: string[] = [];
const openRepositories: SqliteRepositories[] = [];

function temporaryDatabase(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), `nuanban-${name}-`));
  temporaryDirectories.push(directory);
  return join(directory, 'server.sqlite');
}

afterEach(() => {
  for (const repositories of openRepositories.splice(0)) repositories.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('SQLite server repositories', () => {
  it('applies migrations, persists auth records, and reopens the same environment', () => {
    const path = temporaryDatabase('persistence');
    const first = createSqliteRepositories({ path, environment: 'test' });
    openRepositories.push(first);
    expect(first.schemaVersion).toBe(1);
    const auth = new AuthService(first, { now: () => Date.parse('2026-10-17T00:00:00.000Z') });
    const account = auth.createAccount({ account_id: 'sqlite-account' });
    const device = auth.bindDevice({ account_id: account.account_id, device_id: 'sqlite-device', device_secret: 'runtime-only-secret' });
    first.close();
    openRepositories.splice(openRepositories.indexOf(first), 1);

    const second = createSqliteRepositories({ path, environment: 'test' });
    openRepositories.push(second);
    expect(second.accounts.get(account.account_id)).toEqual(account);
    expect(second.devices.get(device.device_id)).toEqual(device);
  });

  it('isolates environments and supports rollback and re-migration fixtures', () => {
    const developmentPath = temporaryDatabase('development');
    const testPath = temporaryDatabase('test');
    const development = createSqliteRepositories({ path: developmentPath, environment: 'development' });
    const test = createSqliteRepositories({ path: testPath, environment: 'test' });
    openRepositories.push(development, test);
    new AuthService(development).createAccount({ account_id: 'development-only' });
    expect(test.accounts.get('development-only')).toBeUndefined();
    expect(() => createSqliteRepositories({ path: developmentPath, environment: 'test' })).toThrow('environment mismatch');
    development.rollback();
    expect(development.schemaVersion).toBe(0);
    development.close();
    openRepositories.splice(openRepositories.indexOf(development), 1);
    const remigrated = createSqliteRepositories({ path: developmentPath, environment: 'development' });
    openRepositories.push(remigrated);
    expect(remigrated.schemaVersion).toBe(1);
    expect(remigrated.accounts.get('development-only')).toBeUndefined();
  });
});
