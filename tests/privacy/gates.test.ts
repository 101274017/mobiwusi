import { describe,it,expect } from 'vitest';
import { canSendFrame,SendingGate } from '@nuanban/privacy';
import { validateTarget,mapRect } from '@nuanban/guidance-engine';
describe('发送门默认拒绝',()=>{
  const safe={consent:true,detectorHealthy:true,risk:'safe' as const,generation:3};
  it('未授权不能发送',()=>expect(canSendFrame({...safe,consent:false},3)).toBe(false));
  it('检测失败不能发送',()=>expect(canSendFrame({...safe,detectorHealthy:false},3)).toBe(false));
  it.each(['unknown','private','transaction'] as const)('风险 %s 不能发送',risk=>expect(canSendFrame({...safe,risk},3)).toBe(false));
  it('代际不符不能发送',()=>expect(canSendFrame(safe,2)).toBe(false));
  it('有效凭据只允许同代际',()=>expect(canSendFrame(safe,3)).toBe(true));
  it('停止后未发送帧全部失效',()=>{const gate=new SendingGate();expect(gate.permits(0)).toBe(false);gate.authorize(safe);expect(gate.permits(3)).toBe(true);gate.stop();expect(gate.permits(3)).toBe(false);expect(gate.permits(gate.generation)).toBe(false);});
});
describe('帧身份和坐标',()=>{
  const frame={frameId:'f1',generation:1,displayId:'d1',windowId:'w1',transformId:'t1',layoutRevision:1,capturedAt:100,width:1200,height:800,sourceSizePx:{width:1200,height:800},contentRectPx:{x:0,y:0,width:1200,height:800},viewportRectPx:{x:0,y:0,width:1200,height:800},scaleFactor:1,rotation:0 as const};
  const target={frame,rect:{x:.1,y:.2,width:.3,height:.4},expiresAt:500};
  it('正常目标有效',()=>expect(validateTarget(target,frame,200)).toBe(true));
  it('过期立即失效',()=>expect(validateTarget(target,frame,600)).toBe(false));
  it.each(['frameId','displayId','windowId','transformId'] as const)('身份 %s 变化使坐标失效',key=>expect(validateTarget(target,{...frame,[key]:'changed'},200)).toBe(false));
  it('布局代际变化使坐标失效',()=>expect(validateTarget(target,{...frame,layoutRevision:2},200)).toBe(false));
  it('畸形帧上下文保守拒绝且不抛异常',()=>expect(validateTarget(target,{...frame,sourceSizePx:null} as unknown as typeof frame,200)).toBe(false));
  it('越界矩形拒绝绘制',()=>expect(validateTarget({...target,rect:{...target.rect,x:.9}},frame,200)).toBe(false));
  it('非有限数值拒绝绘制',()=>expect(validateTarget({...target,rect:{...target.rect,x:NaN}},frame,200)).toBe(false));
  it('归一化坐标映射到当前内容区域',()=>expect(mapRect(target.rect,{x:100,y:50,width:1000,height:500})).toEqual({x:200,y:150,width:300,height:200}));
});
