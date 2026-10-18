import { ServiceFailure, type ConversationPort, type LocalSnapshot, type Repository } from '@nuanban/application';
import type { ConversationEvent } from '@nuanban/contracts';
import type { ConflictChoice } from '@nuanban/domain';
import { preserveMockConflicts, resolveMockConflict } from './conflicts';
import { accountDemoEligibility, type AccountDemoInput } from '@nuanban/domain';
import type { AccountDemoPort } from '@nuanban/application';
import type { MockScenario } from '@nuanban/config';
import { detectTextRisk } from '@nuanban/domain';
function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve,reject) => {
    if (signal.aborted) { reject(new DOMException('已停止','AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('已停止','AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort',abort); resolve(); },milliseconds);
    signal.addEventListener('abort',abort,{once:true});
  });
}
export class DemoConversation implements ConversationPort {
  private sequence = 0;
  constructor(private scenario: MockScenario = 'success') {}
  async *stream(text: string, signal: AbortSignal): AsyncIterable<ConversationEvent> {
    if (!text.trim() || text.length > 1500) throw new ServiceFailure('INVALID_REQUEST', '请填写 1～1500 字的问题。');
    if (signal.aborted) throw new DOMException('已停止', 'AbortError');
    const requestId = 'demo-conversation-' + ++this.sequence;
    yield { request_id: requestId, sequence: 0, type: 'started' };
    if (this.scenario === 'loading') await delay(60000, signal);
    if (this.scenario === 'timeout') {
      await delay(500, signal);
      throw new ServiceFailure('TIMEOUT', '讲解等待超时了。问题已保留，可以重试或先做本机练习。', true);
    }
    if (this.scenario === 'offline') throw new ServiceFailure('NETWORK_OFFLINE', '网络暂时连不上。问题已保留，本机笔记和练习仍可使用。', true);
    if (this.scenario === 'permission-denied') throw new ServiceFailure('PERMISSION_DENIED', '当前请求未获许可。可以改用本机练习；这不代表系统权限状态。');
    if (this.scenario === 'provider-quota') throw new ServiceFailure('RATE_LIMITED', '讲解服务的演示配额不足，请稍后重试，或先做本机练习。', true);
    const risk = detectTextRisk(text);
    const answers = risk === 'transaction' ? ['这涉及支付、转账或验证码，我们先停下来。','暖伴不会指导这类操作，也不会索取任何密码或验证码。','请通过自己熟悉的电话号码，与家人确认。']
      : risk === 'private' ? ['这里可能涉及密码或私人信息，请先不要发送。','演示不会查看你的真实屏幕。请离开敏感页面后重新提问。']
      : risk === 'medical' || risk === 'investment' ? ['我可以解释如何使用设备，但不能替你作医疗或投资决定。','用药问题请联系专业医护，财务决定请审慎核实。']
      : /字体|字太小/.test(text) ? ['字太小确实看着费劲，咱们一步一步来。','在下面的练习里，先打开「设置」，再找到「显示与字体」。','选择「大字体」并保存。每一步都由你自己点，我只帮你指路。']
      : /照片|拍照|相机/.test(text) ? ['我们先在安全的练习环境里熟悉操作。','通常可以在手机主屏幕找到相机图标，点开后对准想拍的东西。','按下拍摄按钮后，到相册查看。不同手机位置可能不同。']
      : /天气/.test(text) ? ['当前演示没有连接实时天气服务，不能给出真实天气。','你可以打开常用的天气应用，查看自己所在城市。']
      : /题|作业/.test(text) ? ['我们一起理解思路，不急着找答案。','图片识别和真实 AI 尚未接入，演示不能识别上传的题目。','你可以把题目文字告诉家长或老师，先找出已知条件。']
      : ['没关系，慢一点也很好。','这是前端演示，目前只能展示字体调整、拍照教学和学习复习的示例。','如果不知道怎么开始，可以点「手把手教我」，在练习手机里试一试。'];
    let eventSequence = 1;
    for (const sentence of answers) {
      await delay(220, signal);
      yield { request_id: requestId, sequence: eventSequence++, type: 'delta', text: sentence };
      if (this.scenario === 'stream-interrupted') throw new ServiceFailure('STREAM_INTERRUPTED', '讲解中途断开了，已收到的内容不作为完整学习记录。问题已保留。', true);
      if (this.scenario === 'partial-failure') throw new ServiceFailure('PARTIAL_FAILURE', '只完成了部分讲解，后续服务暂不可用。没有生成学习笔记。', true);
    }
    yield { request_id: requestId, sequence: eventSequence, type: 'completed' };
  }
}
export class DemoAccountFlow implements AccountDemoPort {
  async attempt(input: AccountDemoInput, signal: AbortSignal): Promise<{ source: 'mock'; authenticated: false }> {
    const error = accountDemoEligibility(input);
    if (error) throw new ServiceFailure('INVALID_REQUEST', error);
    await delay(450, signal);
    if (input.outcome === 'failure') throw new ServiceFailure('AUTH_FAILED', '模拟校验未通过。可以重新尝试或选择另一条协助路径，不要求输入验证码。');
    if (input.outcome === 'expired') throw new ServiceFailure('INVITE_EXPIRED', '演示挑战或认领已过期，请重新发起，不会自动激活。');
    return { source: 'mock', authenticated: false };
  }
}
export function createDemoSnapshot(ownerId: string, now = new Date()): LocalSnapshot {
  const base = { ownerId,createdAt:now.toISOString(),updatedAt:now.toISOString(),version:1,deletedAt:null };
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(9,0,0,0);
  return {
    initialized:true,
    preferences:{mode:'elder',fontScale:1,captionSize:32,muted:false,speechRate:0.75,reducedMotion:false,pet:'cat',petColor:'#D98347'},
    notes:[{...base,id:'demo-note-font',topic:'把手机字体调大',question:'手机上的字太小，怎么调大？',summary:'打开设置 → 显示与字体 → 选择大字体 → 保存。实际手机菜单可能不同。',mastery:'unmastered',masterySource:null,reviewedAt:null,source:'demo'},{...base,id:'demo-note-photo',topic:'学会用手机拍照',question:'怎么给家人拍一张照片？',summary:'打开相机，对准画面，按拍摄按钮，再到相册查看。',mastery:'mastered',masterySource:'user',reviewedAt:null,source:'demo'}],
    todos:[{...base,id:'demo-todo-review',title:'复习：把手机字体调大',dueAt:tomorrow.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,noteId:'demo-note-font',completedAt:null,repeat:'none',source:'review'}],
    family:[],outbox:[]
  };
}

export const demoClock = '2026-10-15T01:00:00.000Z';
export function createScenarioSnapshot(ownerId: string, scenario: MockScenario): LocalSnapshot {
  const snapshot = createDemoSnapshot(ownerId, new Date(demoClock));
  snapshot.todos.forEach(todo => { todo.dueAt = '2026-10-16T01:00:00.000Z'; todo.timezone = 'Asia/Shanghai'; });
  if (scenario === 'empty') {
    snapshot.notes = [];
    snapshot.todos = [];
  }
  if (scenario === 'invite-expired') snapshot.family = [{ id: 'demo-family', name: '演示家属', relation: '合成关系', status: 'active', scopes: [] }];
  return snapshot;
}

export class ScenarioRepository implements Repository {
  private initialized = false;
  constructor(private repository: Repository, private scenario: MockScenario) {}
  async load(ownerId: string): Promise<LocalSnapshot | null> {
    const snapshot = await this.repository.load(ownerId);
    this.initialized = snapshot !== null;
    return snapshot;
  }
  async commit(ownerId: string, snapshot: LocalSnapshot): Promise<void> {
    const erasing = !snapshot.notes.length && !snapshot.todos.length && !snapshot.family.length && !snapshot.outbox.length && Array.isArray(snapshot.conflicts) && !snapshot.conflicts.length;
    if (this.initialized && this.scenario === 'version-conflict' && !erasing) await preserveMockConflicts(this.repository, ownerId, snapshot);
    await this.repository.commit(ownerId, snapshot);
    this.initialized = true;
  }
  async clear(ownerId: string): Promise<void> {
    await this.repository.clear(ownerId);
    this.initialized = false;
  }
  async resolveConflict(ownerId: string, conflictId: string, choice: ConflictChoice): Promise<LocalSnapshot> {
    if (this.scenario !== 'version-conflict') throw new ServiceFailure('INVALID_REQUEST', '当前场景没有可选择的模拟冲突。');
    return resolveMockConflict(this.repository, ownerId, conflictId, choice);
  }
}
