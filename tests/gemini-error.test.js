import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geminiFailure } from '../lib/gemini-error.js';
import handler from '../api/generate.js';
test('classifica chave, permissão, cota, modelo e indisponibilidade', () => {
  assert.equal(geminiFailure(400,{error:{details:[{reason:'API_KEY_INVALID'}]}}).body.code,'GEMINI_KEY_INVALID');
  assert.equal(geminiFailure(403,{error:{message:'Your API key was reported as leaked'}}).body.code,'GEMINI_KEY_BLOCKED');
  for (const [status,code] of [[401,'GEMINI_PERMISSION'],[403,'GEMINI_PERMISSION'],[429,'GEMINI_QUOTA'],[404,'GEMINI_MODEL_UNAVAILABLE'],[503,'GEMINI_UNAVAILABLE'],[400,'GEMINI_REQUEST_REJECTED']]) assert.equal(geminiFailure(status,{}).body.code,code);
});
test('não devolve texto arbitrário, dados ou credenciais do provedor', () => {
  const result=geminiFailure(400,{error:{message:'api key not valid SECRET_TEST source text',details:[{reason:'SECRET_TEST'}]}});
  assert.ok(!JSON.stringify(result).includes('SECRET_TEST'));
  assert.ok(!JSON.stringify(result).includes('source text'));
});
test('endpoint preserva diagnóstico seguro de falha real do provedor', async () => {
  const previousFetch=globalThis.fetch, previousKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test';
  globalThis.fetch=async()=>({ok:false,status:429,json:async()=>({error:{message:'private project metadata'}})});
  const r={setHeader(){},status(n){this.code=n;return this},json(v){this.data=v;return this}};
  try {await handler({method:'POST',body:{title:'Teste',content:'Texto'}},r);assert.equal(r.code,429);assert.equal(r.data.code,'GEMINI_QUOTA');assert.ok(!JSON.stringify(r.data).includes('private'));}
  finally {globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;}
});
