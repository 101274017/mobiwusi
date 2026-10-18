import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceIndex = process.argv.indexOf('--evidence');
const evidencePath = evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
  ? path.resolve(process.cwd(), process.argv[evidenceIndex + 1])
  : path.join(root, 'docs/implementation/evidence/android-room-results.json');

function read(relativePath) {
  const file = path.join(root, relativePath);
  try {
    return { file, text: fs.readFileSync(file, 'utf8') };
  } catch {
    return { file, text: null };
  }
}

function check(id, title, requirements) {
  const missing = [];
  const files = new Set();
  for (const requirement of requirements) {
    const loaded = read(requirement.file);
    files.add(requirement.file);
    if (loaded.text === null || !loaded.text.includes(requirement.text)) missing.push(`${requirement.file}: ${requirement.text}`);
  }
  return { id, title, status: missing.length === 0 ? 'passed' : 'failed', files: [...files], missing };
}

function runMigrationPreflight() {
  const migrationPath = 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt';
  const loaded = read(migrationPath);
  const expectedReceiptStatements = [
    'ALTER TABLE reminders ADD COLUMN submitted_at TEXT',
    'ALTER TABLE reminders ADD COLUMN delivered_at TEXT',
    'ALTER TABLE reminders ADD COLUMN opened_at TEXT',
    'ALTER TABLE reminders ADD COLUMN failed_at TEXT',
    'ALTER TABLE reminders ADD COLUMN missed_at TEXT',
    'ALTER TABLE reminders ADD COLUMN unknown_at TEXT',
    'ALTER TABLE reminders ADD COLUMN completed_at TEXT',
    'ALTER TABLE reminders ADD COLUMN cancelled_at TEXT',
  ];
  const expectedClickStatement = 'ALTER TABLE reminders ADD COLUMN click_token TEXT';
  const title = 'Room 1→3 migrations preserve legacy rows and add receipt/click-token columns';
  if (loaded.text === null) return { id: 'C07-ROOM-05', title, status: 'failed', files: [migrationPath], missing: [`${migrationPath}: source is missing`] };
  const migration12Start = loaded.text.indexOf('val MIGRATION_1_2');
  const migration23Start = loaded.text.indexOf('val MIGRATION_2_3');
  const createStart = loaded.text.indexOf('fun create(');
  const statementsFor = (start, end) => start >= 0 && end > start
    ? [...loaded.text.slice(start, end).matchAll(/database\.execSQL\("([^"]+)"\)/g)].map(match => match[1])
    : [];
  const receiptStatements = statementsFor(migration12Start, migration23Start);
  const clickStatements = statementsFor(migration23Start, createStart);
  if (JSON.stringify(receiptStatements) !== JSON.stringify(expectedReceiptStatements) || JSON.stringify(clickStatements) !== JSON.stringify([expectedClickStatement])) {
    return { id: 'C07-ROOM-05', title, status: 'failed', files: [migrationPath], missing: ['MIGRATION_1_2 or MIGRATION_2_3 statements do not match the expected additive migrations'] };
  }
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE reminders (
        account_id TEXT NOT NULL,
        reminder_id TEXT NOT NULL,
        todo_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        schedule_version INTEGER NOT NULL,
        due_at TEXT NOT NULL,
        due_at_epoch_ms INTEGER NOT NULL,
        timezone TEXT NOT NULL,
        deep_link TEXT NOT NULL,
        repeat_rule TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(account_id, instance_id)
      );
      CREATE INDEX index_reminders_account_id_todo_id_schedule_version
        ON reminders(account_id, todo_id, schedule_version);
      CREATE INDEX index_reminders_account_id_status_due_at_epoch_ms
        ON reminders(account_id, status, due_at_epoch_ms);
    `);
    database.prepare(`
      INSERT INTO reminders (
        account_id, reminder_id, todo_id, instance_id, schedule_version, due_at,
        due_at_epoch_ms, timezone, deep_link, repeat_rule, channel, status,
        payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'account-a',
      'review-1',
      'todo-1',
      'instance-1',
      1,
      '2026-10-16T00:00:00Z',
      1792108800000,
      'Asia/Shanghai',
      'nuanban://review/review-1',
      'none',
      'local',
      'scheduled',
      '{"title":"legacy"}',
      '2026-10-15T00:00:00Z',
      '2026-10-15T00:00:00Z',
    );
    for (const statement of receiptStatements) database.exec(statement);
    for (const statement of clickStatements) database.exec(statement);
    const columns = database.prepare('PRAGMA table_info(reminders)').all();
    const columnNames = columns.map(column => column.name);
    const migratedColumns = [...expectedReceiptStatements, expectedClickStatement].map(statement => statement.match(/ADD COLUMN ([a-z_]+)/)[1]);
    const indexes = database.prepare('PRAGMA index_list(reminders)').all().map(index => index.name);
    const indexColumnsFor = indexName => database.prepare(`PRAGMA index_info('${indexName}')`).all()
      .sort((left, right) => Number(left.seq) - Number(right.seq))
      .map(index => index.name);
    const primaryKey = columns
      .filter(column => Number(column.pk) > 0)
      .sort((left, right) => Number(left.pk) - Number(right.pk))
      .map(column => column.name);
    const expectedIndexColumns = {
      index_reminders_account_id_todo_id_schedule_version: ['account_id', 'todo_id', 'schedule_version'],
      index_reminders_account_id_status_due_at_epoch_ms: ['account_id', 'status', 'due_at_epoch_ms'],
    };
    const indexColumnMismatches = Object.entries(expectedIndexColumns)
      .filter(([indexName, expectedColumns]) => JSON.stringify(indexColumnsFor(indexName)) !== JSON.stringify(expectedColumns))
      .map(([indexName, expectedColumns]) => `${indexName} columns are ${JSON.stringify(indexColumnsFor(indexName))}, expected ${JSON.stringify(expectedColumns)}`);
    const insertLegacyShape = database.prepare(`
      INSERT INTO reminders (
        account_id, reminder_id, todo_id, instance_id, schedule_version, due_at,
        due_at_epoch_ms, timezone, deep_link, repeat_rule, channel, status,
        payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertLegacyShape.run(
      'account-b',
      'review-2',
      'todo-2',
      'instance-1',
      1,
      '2026-10-16T00:00:00Z',
      1792108800000,
      'Asia/Shanghai',
      'nuanban://review/review-2',
      'none',
      'local',
      'scheduled',
      '{"title":"same instance in another account"}',
      '2026-10-15T00:00:00Z',
      '2026-10-15T00:00:00Z',
    );
    const legacyRow = database.prepare('SELECT * FROM reminders WHERE account_id = ? AND instance_id = ?').get('account-a', 'instance-1');
    const accountIsolationRows = Number(database.prepare('SELECT COUNT(*) AS count FROM reminders WHERE instance_id = ?').get('instance-1').count);
    const defaultNonNullColumns = migratedColumns.filter(column => legacyRow?.[column] !== null);
    const missingColumns = migratedColumns.filter(column => !columnNames.includes(column));
    const missingIndexes = [
      'index_reminders_account_id_todo_id_schedule_version',
      'index_reminders_account_id_status_due_at_epoch_ms',
    ].filter(index => !indexes.includes(index));
    const missing = [
      ...missingColumns.map(column => `missing migrated column ${column}`),
      ...missingIndexes.map(index => `missing preserved index ${index}`),
      ...indexColumnMismatches,
      JSON.stringify(primaryKey) !== JSON.stringify(['account_id', 'instance_id']) ? `primary key is ${JSON.stringify(primaryKey)}, expected account_id + instance_id` : '',
      legacyRow?.payload_json !== '{"title":"legacy"}' ? 'legacy payload was not preserved' : '',
      legacyRow?.schedule_version !== 1 ? 'legacy schedule version was not preserved' : '',
      defaultNonNullColumns.length > 0 ? `new migration columns must default to NULL: ${defaultNonNullColumns.join(', ')}` : '',
      accountIsolationRows !== 2 ? 'the same instance must be allowed in separate account namespaces' : '',
      database.prepare('SELECT COUNT(*) AS count FROM reminders WHERE account_id = ? AND instance_id = ?').get('account-a', 'instance-1').count !== 1 ? 'account-scoped instance lookup is not isolated' : '',
    ].filter(Boolean);
    return {
      id: 'C07-ROOM-05',
      title,
      status: missing.length === 0 ? 'passed' : 'failed',
      files: [migrationPath],
      missing,
      details: {
        migratedColumns,
        preservedIndexes: indexes.filter(index => index.startsWith('index_reminders_')),
        indexColumns: Object.fromEntries(Object.keys(expectedIndexColumns).map(indexName => [indexName, indexColumnsFor(indexName)])),
        primaryKey,
        defaultNonNullColumns,
        accountIsolationRows,
        legacyRowPreserved: missing.length === 0,
      },
    };
  } catch (error) {
    return { id: 'C07-ROOM-05', title, status: 'failed', files: [migrationPath], missing: [error instanceof Error ? error.message : String(error)] };
  } finally {
    database.close();
  }
}

const checks = [
  check('C07-ROOM-01', 'Android app uses Room with generated DAO implementation', [
    { file: 'apps/android/app/build.gradle.kts', text: 'androidx.room:room-runtime:2.8.5' },
    { file: 'apps/android/app/build.gradle.kts', text: 'androidx.room:room-compiler:2.8.5' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt', text: '@Database(entities = [ReminderEntity::class], version = 3' },
  ]),
  check('C07-ROOM-02', 'Reminder schema is account-partitioned and due-time indexed', [
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderEntity.kt', text: 'primaryKeys = ["account_id", "instance_id"]' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderEntity.kt', text: 'Index(value = ["account_id", "status", "due_at_epoch_ms"])' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDao.kt', text: 'WHERE account_id = :accountId' },
  ]),
  check('C07-ROOM-03', 'Schedule writes and status transitions are transactional', [
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'database.runInTransaction' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'STALE_SCHEDULE' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'SCHEDULE_CONFLICT' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'assertReceiptOrder' },
  ]),
  check('C07-ROOM-04', 'Migration and notification refusal paths are explicit', [
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt', text: 'MIGRATION_1_2' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt', text: 'MIGRATION_2_3' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt', text: '.addMigrations(MIGRATION_1_2, MIGRATION_2_3)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt', text: 'POST_NOTIFICATIONS' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt', text: 'setExactAndAllowWhileIdle' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt', text: 'return AndroidReminderScheduleResult("unsupported"' },
  ]),
  check('C07-ROOM-06', 'WebView bridge uses strict reminder methods and background Room executor', [
    { file: 'packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ActiveBridgeProtocol.kt', text: 'REMINDER_SCHEDULE' },
    { file: 'packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ActiveBridgeProtocol.kt', text: 'REMINDER_NOTIFY_DUE' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'WebViewCompat.addWebMessageListener' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'bridgeExecutor.execute' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'RoomReminderStore' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'store.claimDue(accountId, reminderId, observedAt, observedAt, instanceId)' },
  ]),
  check('C07-ROOM-07', '到期提交、闹钟回执和 Activity 销毁保持可补偿与有序关闭', [
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDao.kt', text: 'findLatestByReminderId' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'rollbackDueSubmission' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'data class ReminderDueSubmission' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'return@Callable ReminderDueSubmission(existing, false)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'ReminderDueSubmission(next, true)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: '(instanceId == null || it.instanceId == instanceId)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'current.status != ReminderStatuses.SUBMITTED || current.submittedAt != submitted.canonical' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'assertReceiptOrder(current, observed.epochMillis)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'submission.claimed' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'input.now, input.now, current.instanceId' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'bridgeLifecycleLock' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'destroyed = true' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'reminderStore.rollbackDueSubmission' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'ReminderReceipts.OPENED' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'ReminderReceipts.DELIVERED' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'EXTRA_REMINDER_ID, reminderId' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'pendingResult.finish()' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'store.claimDue(accountId, reminderId, observedAt, observedAt, instanceId)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'store.rollbackDueSubmission(accountId, reminderId, submittedAt, Instant.now().toString())' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'submitted.deepLink != deepLink' },
  ]),
  check('C07-ROOM-08', '通知点击使用一次性令牌并绑定已投递提醒', [
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt', text: 'isSafeReminderScheduleInput' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt', text: 'EXTRA_CLICK_TOKEN' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt', text: 'isSafeReminderAlarmInput(request)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'clickToken = current.clickToken ?: newClickToken()' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'isSafeReminderOpenInput(accountId, reminderId, instanceId, deepLink, clickToken)' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'current.clickToken != clickToken' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'current.deepLink != deepLink' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'current.status != ReminderStatuses.DELIVERED' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'current.openedAt != null' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'webViewReady = true' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: '!webViewReady' },
  ]),
  runMigrationPreflight(),
];

const apkPath = path.join(root, 'apps/android/app/build/outputs/apk/debug/app-debug.apk');
const sourcePaths = [
  'apps/android/app/build.gradle.kts',
  'apps/android/app/src/main/AndroidManifest.xml',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderEntity.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDao.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt',
  'packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ActiveBridgeProtocol.kt',
];
const sourceFresh = fs.existsSync(apkPath) && sourcePaths.every(relativePath => fs.existsSync(path.join(root, relativePath)) && fs.statSync(path.join(root, relativePath)).mtimeMs <= fs.statSync(apkPath).mtimeMs);
const adbOutput = await import('node:child_process').then(({ execFileSync }) => {
  try { return execFileSync('adb', ['devices'], { encoding: 'utf8', windowsHide: true }); } catch { return ''; }
});
const deviceCount = adbOutput.split(/\r?\n/).slice(1).filter(line => /\tdevice$/.test(line)).length;
const staticPassed = checks.every(checkResult => checkResult.status === 'passed');
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'Android C07 Room and notification adapter preflight',
  success: staticPassed && sourceFresh,
  status: 'preparatory_not_accepted',
  roomCompileVerified: sourceFresh,
  roomMigrationPreflightVerified: checks.find(checkResult => checkResult.id === 'C07-ROOM-05')?.status === 'passed',
  deviceVerified: false,
  systemSchedulerVerified: false,
  adbDeviceCount: deviceCount,
  apk: fs.existsSync(apkPath) ? { path: path.relative(root, apkPath), bytes: fs.statSync(apkPath).size, sourceFresh } : null,
  checks,
  limitations: [
    '本检查只审计源码、依赖、已生成 Debug APK 和本机设备枚举；不安装、不请求权限、不触发提醒。',
    'Room 数据库尚未接入真实账号认证、整库加密、同步 outbox 或生产数据迁移演练。',
    '通知适配器尚未完成设备上的通知权限、渠道关闭、精确闹钟、锁屏、睡眠、强停、重启和用户看到回执验证。',
    '没有 ADB 设备时仍保留 deviceVerified=false；代码编译不能替代 NV-02 或 D 关口。',
  ],
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (!report.success) process.exitCode = 1;
