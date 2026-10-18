import { describe,it,expect } from 'vitest';
import Ajv from 'ajv/dist/2020';
import { bridgeSchema } from '@nuanban/contracts';
const validate=new Ajv({strict:true}).compile(bridgeSchema);
describe('原生白名单契约',()=>{
  const valid={version:1,request_id:'r1',generation:1,method:'capabilities'};
  it('接受受限能力查询',()=>expect(validate(valid)).toBe(true));
  it('拒绝任意执行',()=>expect(validate({...valid,method:'execute'})).toBe(false));
  it('拒绝任意文件读取参数',()=>expect(validate({...valid,path:'C:/secret'})).toBe(false));
  it('拒绝云端 grant 伪装成系统授权',()=>expect(validate({...valid,method:'grant'})).toBe(false));
  it('拒绝负代际',()=>expect(validate({...valid,generation:-1})).toBe(false));
});
