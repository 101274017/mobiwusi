import Ajv from 'ajv/dist/2020.js';
import { readdir,readFile } from 'node:fs/promises';
import { contractFormats } from '../packages/contracts/src/formats.ts';
const ajv = new Ajv({ strict: true, formats: contractFormats });
ajv.addKeyword({ keyword: 'example', valid: true });
const directory = new URL('../packages/contracts/schemas/', import.meta.url);
for (const name of await readdir(directory)) {
  if (!name.endsWith('.json')) continue;
  const schema = JSON.parse(await readFile(new URL(name, directory), 'utf8'));
  ajv.compile(schema);
  if (name === 'services.schema.json') {
    for (const definition of Object.keys(schema.$defs)) ajv.getSchema(schema.$id + '#/$defs/' + definition);
    console.log(`${Object.keys(schema.$defs).length} 个服务定义逐项编译通过`);
  }
  console.log(name + ': JSON Schema 2020-12 校验通过');
}
