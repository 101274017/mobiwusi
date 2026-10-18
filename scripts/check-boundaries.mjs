import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root=resolve(import.meta.dirname,'..');const failures=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const file=resolve(directory,entry.name);if(entry.isDirectory())await walk(file);else if(/\.tsx?$/.test(entry.name)){const source=await readFile(file,'utf8');const name=relative(root,file).replaceAll('\\','/');if(name.startsWith('packages/domain/')&&/from\s+['"](?:react|zustand|@nuanban\/[^d]|electron)/.test(source))failures.push(name+': domain 依赖越界');if(name.startsWith('apps/web/src/')&&!name.endsWith('composition.ts')&&/from\s+['"](?:@nuanban\/(?:mocks|local-data)|.*fixtures)/.test(source))failures.push(name+': UI 直接依赖适配器');}}}
await walk(resolve(root,'packages'));await walk(resolve(root,'apps/web/src'));if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('领域及 UI 依赖边界检查通过');
