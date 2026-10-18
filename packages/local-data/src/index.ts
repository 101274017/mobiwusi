import type { Repository, LocalSnapshot } from '@nuanban/application';
import { ServiceFailure } from '@nuanban/application';
import { validInstant, validTimezone } from '@nuanban/contracts';
import { validDrawing, type DrawingPort, type DrawingStroke, type DrawingJob, type DrawingJobPort } from '@nuanban/pet-engine';
import { deriveReminderInstanceId, type ReminderOccurrence } from '@nuanban/reminder-engine';
const databaseName = 'nuanban-demo-v1';
const databaseVersion = 4;
const reminderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ownerPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const reminderStates = new Set(['scheduled', 'cancelled', 'submitted', 'delivered', 'opened', 'failed', 'missed', 'unknown']);
const reminderRepeats = new Set(['none', 'daily', 'weekly']);
const reminderChannels = new Set(['local', 'push']);
const reminderReceiptStates = ['submitted', 'delivered', 'opened', 'failed', 'missed', 'unknown'] as const;
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => { if(!request.result.objectStoreNames.contains('accounts'))request.result.createObjectStore('accounts'); if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts'); if(!request.result.objectStoreNames.contains('pet-jobs'))request.result.createObjectStore('pet-jobs'); if(!request.result.objectStoreNames.contains('reminders'))request.result.createObjectStore('reminders'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地资料，请检查浏览器存储权限。'));
  });
}

function reminderPrefix(ownerId: string): string {
  return ownerId + '/reminder/';
}

function validNullableInstant(value: unknown): boolean {
  return value === null || (typeof value === 'string' && validInstant(value));
}

function validDeepLink(value: unknown): boolean {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 || /[\u0000-\u001f\\]/.test(value) || value.startsWith('//')) return false;
  return /^\/review\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    || /^\/todos(?:\/edit\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/i.test(value);
}

async function validateReminder(ownerId: string, occurrence: ReminderOccurrence): Promise<void> {
  if (!occurrence || occurrence.todoId === undefined || occurrence.instanceId === undefined || occurrence.plannedAt === undefined || occurrence.timezone === undefined || occurrence.scheduleRevision === undefined || occurrence.deepLink === undefined || occurrence.repeat === undefined || occurrence.channel === undefined || occurrence.state === undefined || occurrence.receipts === undefined) throw new Error('本机提醒资料缺少必要字段。');
  if (!reminderUuid.test(occurrence.todoId) || !reminderUuid.test(occurrence.instanceId) || !Number.isSafeInteger(occurrence.scheduleRevision) || occurrence.scheduleRevision < 1 || typeof occurrence.plannedAt !== 'string' || !validInstant(occurrence.plannedAt) || !validTimezone(occurrence.timezone) || !validDeepLink(occurrence.deepLink) || !reminderRepeats.has(occurrence.repeat) || !reminderChannels.has(occurrence.channel) || !reminderStates.has(occurrence.state) || !validNullableInstant(occurrence.completedAt) || !validNullableInstant(occurrence.cancelledAt)) throw new Error('本机提醒资料无效，拒绝写入。');
  if (occurrence.instanceId !== await deriveReminderInstanceId(occurrence.todoId, occurrence.scheduleRevision, occurrence.plannedAt)) throw new Error('本机提醒实例与排程内容不一致，拒绝写入。');
  const receiptKeys = Object.keys(occurrence.receipts);
  if (receiptKeys.length !== reminderReceiptStates.length || reminderReceiptStates.some(key => !Object.hasOwn(occurrence.receipts, key)) || receiptKeys.some(key => !reminderReceiptStates.includes(key as typeof reminderReceiptStates[number])) || reminderReceiptStates.some(key => !validNullableInstant(occurrence.receipts[key]))) throw new Error('本机提醒回执资料无效，拒绝写入。');
  if (!ownerPattern.test(ownerId)) throw new Error('本机账号标识无效。');
}

interface StoredReminder {
  ownerId: string;
  occurrence: ReminderOccurrence;
}

export class IndexedDbReminderStore {
  constructor(private readonly ownerId: string) {
    if (!ownerPattern.test(ownerId)) throw new Error('本机账号标识无效。');
  }

  async load(): Promise<ReminderOccurrence[]> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('reminders', 'readonly');
      const request = transaction.objectStore('reminders').getAll(IDBKeyRange.bound(reminderPrefix(this.ownerId), reminderPrefix(this.ownerId) + '\uffff'));
      let records: unknown[] = [];
      let validationError: Error | null = null;
      request.onsuccess = () => {
        records = request.result;
      };
      transaction.oncomplete = () => {
        void Promise.all(records.map(async record => {
          const stored = record as Partial<StoredReminder>;
          if (stored.ownerId !== this.ownerId || !stored.occurrence) throw new Error('本机提醒资料账号边界无效，拒绝加载。');
          await validateReminder(this.ownerId, stored.occurrence);
          return structuredClone(stored.occurrence);
        })).then(occurrences => {
          database.close();
          resolve(occurrences);
        }, error => {
          validationError = error instanceof Error ? error : new Error('本机提醒资料无效，拒绝加载。');
          database.close();
          reject(validationError);
        });
      };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(validationError ?? new Error('本机提醒读取失败。')); };
    });
  }

  async replace(occurrences: readonly ReminderOccurrence[]): Promise<void> {
    const uniqueKeys = new Set<string>();
    for (const occurrence of occurrences) {
      await validateReminder(this.ownerId, occurrence);
      const key = occurrence.todoId + '/' + occurrence.instanceId;
      if (uniqueKeys.has(key)) throw new Error('同一提醒实例不能重复写入。');
      uniqueKeys.add(key);
    }
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('reminders', 'readwrite');
      const store = transaction.objectStore('reminders');
      const prefix = reminderPrefix(this.ownerId);
      store.delete(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      for (const occurrence of occurrences) store.put({ ownerId: this.ownerId, occurrence: structuredClone(occurrence) } satisfies StoredReminder, prefix + occurrence.todoId + '/' + occurrence.instanceId);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('本机提醒保存失败，原有记录仍应保持。')); };
    });
  }

  async clear(): Promise<void> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('reminders', 'readwrite');
      const prefix = reminderPrefix(this.ownerId);
      transaction.objectStore('reminders').delete(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('本机提醒清理失败。')); };
    });
  }
}
export class IndexedDbDrawingJobs implements DrawingJobPort {
  constructor(private ownerId: string) {}
  async load(id: string): Promise<DrawingJob | null> {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return null;
    const result = await this.read(this.ownerId + '/job/' + id);
    if (result === undefined) return null;
    const job = result as DrawingJob;
    this.validate(job);
    return job;
  }
  async latest(): Promise<DrawingJob | null> {
    const id = await this.read(this.ownerId + '/latest');
    return typeof id === 'string' ? this.load(id) : null;
  }
  async save(job: DrawingJob): Promise<void> {
    this.validate(job);
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('pet-jobs', 'readwrite');
      const store = transaction.objectStore('pet-jobs');
      store.put(structuredClone(job), this.ownerId + '/job/' + job.id);
      store.put(job.id, this.ownerId + '/latest');
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('演示任务保存失败，原画稿仍保留。')); };
    });
  }
  async clear(): Promise<void> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('pet-jobs', 'readwrite');
      transaction.objectStore('pet-jobs').delete(IDBKeyRange.bound(this.ownerId + '/', this.ownerId + '/\uffff'));
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('演示任务清理失败，请重试。')); };
    });
  }
  private validate(job: DrawingJob): void {
    if (!job || job.ownerId !== this.ownerId || typeof job.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(job.id) || !validDrawing(job.strokes) || job.source !== 'simulation' || job.generated !== false || !Number.isSafeInteger(job.generation) || job.generation < 0 || !['queued', 'processing', 'preview', 'failed', 'cancelled', 'confirmed'].includes(job.state) || !Number.isFinite(Date.parse(job.createdAt)) || !Number.isFinite(Date.parse(job.updatedAt))) throw new Error('演示任务资料无效，不能加载为生成资产。');
  }
  private async read(key: string): Promise<unknown> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('pet-jobs', 'readonly');
      const request = transaction.objectStore('pet-jobs').get(key);
      let result: unknown;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('演示任务读取失败，请重试。')); };
    });
  }
}
export class IndexedDbRepository implements Repository {
  async commitIfUnchanged(ownerId: string, expected: LocalSnapshot, next: LocalSnapshot): Promise<void> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('accounts', 'readwrite');
      const store = transaction.objectStore('accounts');
      const request = store.get(ownerId);
      let changed = false;
      request.onsuccess = () => {
        if (JSON.stringify(request.result) !== JSON.stringify(expected)) { changed = true; transaction.abort(); return; }
        store.put(structuredClone(next), ownerId);
      };
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(changed ? new ServiceFailure('VERSION_CONFLICT', '本机资料已在另一页面变化，请重新读取；未覆盖较新资料。') : new Error('保存失败，冲突草稿仍保留。')); };
    });
  }
  async load(ownerId: string): Promise<LocalSnapshot | null> {
    const database = await openDatabase();
    return new Promise((resolve,reject) => {
      const transaction = database.transaction('accounts','readonly');
      const request = transaction.objectStore('accounts').get(ownerId);
      let result: LocalSnapshot | null = null;
      request.onsuccess = () => { result = request.result ?? null; };
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onerror = () => { database.close(); reject(new Error('本地资料读取失败。')); };
    });
  }
  async commit(ownerId: string, snapshot: LocalSnapshot): Promise<void> {
    const database = await openDatabase();
    return new Promise((resolve,reject) => {
      const transaction = database.transaction('accounts','readwrite');
      transaction.objectStore('accounts').put(structuredClone(snapshot),ownerId);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('保存失败，资料尚未写入，请重试。')); };
    });
  }
  async clear(ownerId: string): Promise<void> {
    const database = await openDatabase();
    return new Promise((resolve,reject) => {
      const transaction = database.transaction('accounts','readwrite');
      transaction.objectStore('accounts').delete(ownerId);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(new Error('删除失败，请重试。')); };
    });
  }
}
export class IndexedDbDrawing implements DrawingPort {
  constructor(private ownerId:string) {}
  async load():Promise<DrawingStroke[]|null> {
    const database=await openDatabase();
    return new Promise((resolve,reject)=>{ const transaction=database.transaction('drafts','readonly'); const request=transaction.objectStore('drafts').get(this.ownerId); let result:DrawingStroke[]|null=null; request.onsuccess=()=>{result=request.result??null;};transaction.oncomplete=()=>{database.close();resolve(result);};transaction.onerror=()=>{database.close();reject(new Error('画稿读取失败'));}; });
  }
  async save(strokes:DrawingStroke[]):Promise<void> {await this.write(strokes);}
  async clear():Promise<void> {await this.write(null);}
  private async write(strokes:DrawingStroke[]|null):Promise<void> {
    const database=await openDatabase();
    return new Promise((resolve,reject)=>{ const transaction=database.transaction('drafts','readwrite'); const store=transaction.objectStore('drafts');if(strokes===null)store.delete(this.ownerId);else store.put(structuredClone(strokes),this.ownerId);transaction.oncomplete=()=>{database.close();resolve();};transaction.onerror=transaction.onabort=()=>{database.close();reject(new Error('画稿保存失败'));}; });
  }
}
