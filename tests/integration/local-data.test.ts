import { describe,it,expect,beforeEach } from 'vitest';
import { IndexedDbRepository,IndexedDbDrawing } from '@nuanban/local-data';
import { createDemoSnapshot } from '../fixtures/business-scenarios';
import { buildReviewTodo,markReviewed,setMastery,mayViewLearning } from '@nuanban/application';
import { configuration } from '@nuanban/config';
import { useApp } from '../../apps/web/src/store';
describe('本机事务和账号隔离',()=>{
  it('笔记与 outbox 在一个 snapshot 事务中保存',async()=>{const repository=new IndexedDbRepository();const owner=crypto.randomUUID();const snapshot=createDemoSnapshot(owner);snapshot.outbox.push({id:'outbox',ownerId:owner,entityId:snapshot.notes[0].id,entityType:'note',version:1,status:'pending',createdAt:new Date().toISOString()});await repository.commit(owner,snapshot);const loaded=await repository.load(owner);expect(loaded?.notes).toHaveLength(2);expect(loaded?.outbox).toHaveLength(1);});
  it('不同 owner 不能读取彼此资料',async()=>{const repository=new IndexedDbRepository();const owner=crypto.randomUUID();await repository.commit(owner,createDemoSnapshot(owner));expect(await repository.load(owner+'-other')).toBeNull();});
  it('删除后不自动恢复初始资料',async()=>{const repository=new IndexedDbRepository();const owner=crypto.randomUUID();await repository.commit(owner,{...createDemoSnapshot(owner),notes:[],todos:[]});expect((await repository.load(owner))?.notes).toEqual([]);});
  it('画稿可以重开并独立清理',async()=>{const drafts=new IndexedDbDrawing(crypto.randomUUID());const strokes=[{color:'#A64B2A',width:9,eraser:false,points:[{x:10,y:10}]}];await drafts.save(strokes);expect(await drafts.load()).toEqual(strokes);await drafts.clear();expect(await drafts.load()).toBeNull();});
});
describe('学习闭环',()=>{
  const snapshot=createDemoSnapshot('owner');
  it('复习不会自动掌握',()=>{const reviewed=markReviewed(snapshot.notes[0]);expect(reviewed.mastery).toBe('unmastered');expect(reviewed.reviewedAt).not.toBeNull();});
  it('明确确认才改变掌握状态和来源',()=>{expect(setMastery(snapshot.notes[0],'mastered').masterySource).toBe('user');});
  it('复习待办关联笔记和时区',()=>{const todo=buildReviewTodo(snapshot.notes[0],'2026-12-01T01:00:00Z','Asia/Shanghai');expect(todo.noteId).toBe(snapshot.notes[0].id);expect(todo.timezone).toBe('Asia/Shanghai');});
  it('关系不等于档案授权',()=>{expect(mayViewLearning({id:'r1',name:'示例家属',relation:'家属',status:'active',scopes:[]})).toBe(false);});
  it('撤权立即拒绝档案投影',()=>{expect(mayViewLearning({id:'r1',name:'示例家属',relation:'家属',status:'revoked',scopes:['notes:read']})).toBe(false);});
});
describe('配置隔离',()=>{
  it('本机业务与平台选择独立',()=>expect(configuration({VITE_API_MODE:'local',VITE_PLATFORM_MODE:'android'},false)).toEqual({apiMode:'local',platformMode:'android'}));
  it('生产环境不得模拟登录与 Mock 服务',()=>expect(()=>configuration({VITE_API_MODE:'mock'},true)).toThrow('Mock'));
  it('未知枚举拒绝启动',()=>expect(()=>configuration({VITE_API_MODE:'anything'},false)).toThrow('未知'));
});
describe('持久化 store',()=>{
  beforeEach(async()=>{const owner=crypto.randomUUID();await useApp.getState().initialize({ownerId:owner,repository:new IndexedDbRepository(),conversation:{async *stream(){yield {request_id:'unused',sequence:0,type:'started'};}}},()=>createDemoSnapshot(owner));});
  it('自动笔记移除秘密且有 outbox',async()=>{await useApp.getState().addNote('验证码是123456','密码是abc123','conversation');const state=useApp.getState().snapshot!;expect(JSON.stringify(state.notes[0])).not.toContain('123456');expect(state.outbox).toHaveLength(1);});
  it('串行写入不会丢掉前一条笔记',async()=>{await Promise.all([useApp.getState().addNote('第一条问题','解释一','conversation'),useApp.getState().addNote('第二条问题','解释二','conversation')]);expect(useApp.getState().snapshot!.notes).toHaveLength(4);});
});
