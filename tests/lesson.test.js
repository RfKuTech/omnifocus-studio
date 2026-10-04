import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLesson, youtubeId } from '../lib/lesson.js';
import handler from '../api/generate.js';
const question = () => ({ question: 'Qual?', options: ['A','B','C','D'], correct: 2, explanation: 'Porque C.' });
const step = () => ({ ...question(), heading: 'Conceito', bullets: ['Um', 'Dois'], narration: 'Explicação', summary: 'Resumo', lifeTask: 'Aplicar' });
const lesson = () => ({ steps: Array.from({length:4}, step), exam: Array.from({length:5}, question) });
test('valida respostas, narrativa, simulado e origem de trechos', () => {
  assert.equal(validateLesson(lesson()).exam.length, 5);
  const bad = lesson(); bad.steps[0].correct = 4; assert.throws(() => validateLesson(bad));
  const missing = lesson(); delete missing.exam; assert.throws(() => validateLesson(missing));
  const clip = lesson(); clip.steps[0].video = { id:'abcdefghijk', start:10, end:5 }; assert.throws(() => validateLesson(clip,['abcdefghijk']));
  clip.steps[0].video.end = 20; assert.throws(() => validateLesson(clip,[])); assert.ok(validateLesson(clip,['abcdefghijk']));
});
test('aceita YouTube e rejeita hosts falsos', () => {
  assert.equal(youtubeId('https://youtu.be/abcdefghijk'), 'abcdefghijk');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=abcdefghijk'), 'abcdefghijk');
  assert.equal(youtubeId('https://evil.test/youtube.com/watch?v=abcdefghijk'), null);
});
function res() { return { setHeader(){}, status(n){this.code=n;return this;}, json(v){this.data=v;return this;},end(){} }; }
test('não inventa aula sem fontes nem trunca arquivos silenciosamente', async () => {
  let r=res(); await handler({method:'POST',body:{title:'Teste'}},r); assert.equal(r.code,400);
  r=res(); await handler({method:'POST',body:{title:'Teste',content:'a'.repeat(180001)}},r); assert.equal(r.code,413);
});
test('envia texto completo e TODOS os vídeos ao modelo', async () => {
  const original=globalThis.fetch, key=process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY='test';
  let submitted;
  globalThis.fetch=async (url,opts)=>{submitted=JSON.parse(opts.body);return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(lesson())}]}}]})};};
  try {
    const r=res(); await handler({method:'POST',body:{title:'Teste',content:'Fonte A\nFonte B',youtubeUrls:['https://youtu.be/abcdefghijk','https://youtu.be/12345678901']}},r);
    assert.equal(r.code,200); assert.equal(submitted.contents[0].parts.length,3);
    assert.match(submitted.contents[0].parts[0].text,/Fonte A\nFonte B/);
  } finally {globalThis.fetch=original;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
import auth from '../api/github-auth.js';
test('OAuth recusa origem externa e redirect fora da aplicação', async () => {
  let r=res(); await auth({method:'GET',headers:{origin:'https://evil.test'}},r); assert.equal(r.code,403);
  const a=process.env.GITHUB_CLIENT_ID,b=process.env.GITHUB_CLIENT_SECRET;
  process.env.GITHUB_CLIENT_ID='id';process.env.GITHUB_CLIENT_SECRET='secret';
  try {r=res();await auth({method:'POST',headers:{origin:'https://omnifocus-studio.vercel.app'},body:{code:'code',codeVerifier:'a'.repeat(43),redirectUri:'https://evil.test'}},r);assert.equal(r.code,400);}
  finally {if(a===undefined)delete process.env.GITHUB_CLIENT_ID;else process.env.GITHUB_CLIENT_ID=a;if(b===undefined)delete process.env.GITHUB_CLIENT_SECRET;else process.env.GITHUB_CLIENT_SECRET=b;}
});
