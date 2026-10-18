import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

describe('Android C07/C08 reminder receiver source boundaries', () => {
  it('claims by the scheduled instance and rolls back only its own failed claim', () => {
    const receiver = read('apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt');
    expect(receiver).toContain('store.claimDue(accountId, reminderId, observedAt, observedAt, instanceId)');
    expect(receiver).toContain('if (submission.claimed)');
    expect(receiver).toContain('store.rollbackDueSubmission(accountId, reminderId, submittedAt, Instant.now().toString())');
    expect(receiver).not.toContain('store.submitDue(accountId!!, reminderId!!');
    expect(receiver).not.toContain('ReminderReceipts.FAILED');
  });

  it('binds account, reminder, instance, deep link and non-legacy click tokens before showing', () => {
    const receiver = read('apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt');
    expect(receiver).toContain('submitted.accountId != accountId');
    expect(receiver).toContain('submitted.reminderId != reminderId');
    expect(receiver).toContain('submitted.instanceId != instanceId');
    expect(receiver).toContain('submitted.deepLink != deepLink');
    expect(receiver).toContain('(clickToken != null && submitted.clickToken != clickToken)');
    expect(receiver).toContain('todoId = submitted.todoId');
  });

  it('keeps notification and alarm PendingIntent identity bound to the full instance id', () => {
    const receiver = read('apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt');
    const scheduler = read('apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt');
    expect(receiver).toContain('data = Uri.parse("nuanban://reminder/open/$instanceId")');
    expect(receiver).toContain('manager.notify(instanceId, instanceId.hashCode(), notification)');
    expect(scheduler).toContain('data = Uri.parse("nuanban://reminder/${request.instanceId}")');
  });
});
