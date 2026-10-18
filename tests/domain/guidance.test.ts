import { describe,it,expect } from 'vitest';
import { guideReducer,initialGuide,detectTextRisk,redactSecrets,recurrenceNext } from '@nuanban/domain';
const started=()=>guideReducer(initialGuide,{type:'START'});
const analyzing=()=>guideReducer(started(),{type:'CONSENT'});
const waiting=()=>{const state=analyzing();return guideReducer(state,{type:'TARGET',generation:state.generation});};
describe('教学状态机',()=>{
  it('必须经过明确同意才进入分析',()=>{expect(started().state).toBe('await_consent');expect(guideReducer(initialGuide,{type:'CONSENT'})).toEqual(initialGuide);});
  it('用户点好了只能进入核验',()=>{expect(guideReducer(waiting(),{type:'USER_DONE'}).state).toBe('verifying');});
  it('禁止未核验直接完成',()=>{const state=waiting();expect(guideReducer(state,{type:'VERIFY',matched:true,final:true,generation:state.generation})).toEqual(state);});
  it('旧代际目标不能复活',()=>{const state=analyzing();expect(guideReducer(state,{type:'TARGET',generation:state.generation-1})).toEqual(state);});
  it('停止使旧响应失效',()=>{const state=waiting();const stopped=guideReducer(state,{type:'STOP'});expect(stopped.state).toBe('ended');expect(stopped.generation).toBeGreaterThan(state.generation);expect(guideReducer(stopped,{type:'TARGET',generation:state.generation})).toEqual(stopped);});
  it.each(['private','transaction','unknown'] as const)('风险 %s 暂停并清代际',risk=>{const state=waiting();const paused=guideReducer(state,{type:'RISK',risk});expect(paused.state).toBe('risk_paused');expect(paused.generation).toBeGreaterThan(state.generation);expect(guideReducer(paused,{type:'TARGET',generation:paused.generation}).state).toBe('risk_paused');expect(guideReducer(paused,{type:'RESUME'}).state).toBe('await_consent');});
  it('三次核验失败建议亲情兜底',()=>{let state=waiting();for(let index=0;index<3;index++){state=guideReducer(state,{type:'USER_DONE'});state=guideReducer(state,{type:'VERIFY',matched:false,generation:state.generation});if(index<2)state=guideReducer(state,{type:'TARGET',generation:state.generation});}expect(state.state).toBe('need_help');});
  it('匹配结果才推进一步',()=>{let state=waiting();state=guideReducer(state,{type:'USER_DONE'});state=guideReducer(state,{type:'VERIFY',matched:true,generation:state.generation});expect(state.step).toBe(1);expect(state.state).toBe('analyzing');});
});
describe('演示文本安全规则，不等于画面检测',()=>{
  it.each([['我要转账','transaction'],['帮我输入密码','private'],['该吃什么药','medical'],['买什么股票','investment'],['手机字体太小','safe']])('分类 %s', (text,risk)=>expect(detectTextRisk(text)).toBe(risk));
  it('秘密不能进入自动笔记',()=>{const text=redactSecrets('验证码：123456 密码 abc456 6222021234567890123');expect(text).not.toContain('123456');expect(text).not.toContain('abc456');expect(text).not.toContain('6222021234567890123');});
});
describe('时区重复规则',()=>{
  const todo={id:'test',ownerId:'owner',title:'复习',dueAt:'2026-03-07T14:00:00.000Z',timezone:'America/New_York',noteId:null,completedAt:null,repeat:'daily' as const,source:'self' as const,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',version:1,deletedAt:null};
  it('夏令时切换仍保持当地上午九点',()=>expect(recurrenceNext(todo,new Date('2026-03-07T15:00:00Z'))).toBe('2026-03-08T13:00:00.000Z'));
  it('单次提醒不生成下一次',()=>expect(recurrenceNext({...todo,repeat:'none'})).toBeNull());
  it('每周重复保持当地时间',()=>expect(recurrenceNext({...todo,repeat:'weekly'},new Date('2026-03-07T15:00:00Z'))).toBe('2026-03-14T13:00:00.000Z'));
});
