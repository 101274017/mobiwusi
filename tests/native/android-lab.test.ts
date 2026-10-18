import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const android = new URL('../../apps/android/', import.meta.url);
const source = 'native-lab/src/main/java/org/nuanban/nativelab/';
const read = (path: string) => readFileSync(new URL(path, android), 'utf8');
const permissions = (manifest: string) => [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map((match) => match[1]).sort();

describe('C01 isolated developer sample boundaries, not device verification', () => {
  it('does not add C01 capture permissions to the normal demonstration application', () => {
    expect(permissions(read('app/src/main/AndroidManifest.xml'))).toEqual([
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SCHEDULE_EXACT_ALARM',
    ]);
    expect(read('app/src/main/AndroidManifest.xml')).not.toMatch(/android\.permission\.(FOREGROUND_SERVICE|FOREGROUND_SERVICE_MEDIA_PROJECTION|SYSTEM_ALERT_WINDOW|CAMERA|RECORD_AUDIO)/);
    expect(read('app/build.gradle.kts')).not.toContain('native-lab');
    expect(read('native-lab/build.gradle.kts')).toContain('applicationId = "org.nuanban.nativelab"');
  });

  it('declares exactly the opt-in native permissions and no network, camera or microphone', () => {
    const manifest = read('native-lab/src/main/AndroidManifest.xml');
    expect(permissions(manifest)).toEqual([
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ]);
    expect(manifest).toMatch(/<service[^>]*android:exported="false"[^>]*android:stopWithTask="true"[^>]*android:foregroundServiceType="mediaProjection"/);
  });

  it('has no raw-pixel, persistence, encoder, WebView or outbound transport entry', () => {
    const native = ['LabSession.kt', 'CaptureLabActivity.kt', 'CaptureLabService.kt'].map((name) => read(source + name)).join('\n');
    expect(native).not.toMatch(/\b(?:WebView|HttpClient|Socket|Bitmap|MediaCodec|FileOutputStream|MediaRecorder)\b/);
    expect(native).not.toMatch(/\.planes\b|\.getPlanes\(|\.getBuffer\(|\.buffer\b|\.compress\(|\.writeBytes\(/);
    expect(read(source + 'CaptureLabService.kt')).toContain('frame.close()');
  });

  it('keeps projection callbacks and explicit stop-before-release ordering', () => {
    const service = read(source + 'CaptureLabService.kt');
    expect(service.indexOf('activeProjection.registerCallback(')).toBeLessThan(service.indexOf('activeProjection.createVirtualDisplay('));
    expect(service.indexOf('LabRuntime.session.stop(owned, reason)')).toBeLessThan(service.indexOf('virtualDisplay?.release()'));
    expect(service).toContain('return START_NOT_STICKY');
    expect(service).toContain('SystemClock.elapsedRealtime() >= expiresAt');
    expect(read(source + 'LabSession.kt')).toContain('const val MAX_DURATION_MS = 30_000L');
  });

  it('keeps Android reminder policy pure and conservative', () => {
    const policy = read(source + 'ReminderPolicy.kt');
    expect(policy).toContain('AndroidReminderCapability.SYSTEM');
    expect(policy).toContain('AndroidReminderCapability.PAGE_ONLY');
    expect(policy).not.toMatch(/NotificationManager|AlarmManager|WorkManager/);
  });
});
