import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCatalog, validateOutline, validateChapter, validateFinalExam, grade, isCourse } from '../lib/course.js';
import { courseSchema, providerSchema } from '../lib/course-schema.js';
import handler, { coursePrompt } from '../api/course.js';
import { content, outline, sources, chapter, question, courseFixture } from './fixtures/course.js';

test('mapeia todos os arquivos e vídeos, preservando texto integral',()=>{
 const catalog=sourceCatalog(content,['https://youtu.be/abcdefghijk']);
 assert.deepEqual(catalog.map(s=>s.id),['s1','s2','v1']); assert.match(catalog[1].text,/produção/);
 const o=structuredClone(outline); assert.throws(()=>validateOutline(o,catalog),/fonte/);
 assert.equal(validateOutline(o,sources).chapters.length,2);
 o.chapters[0].topicIds=['t1'];o.chapters[1].topicIds=['t1'];assert.throws(()=>validateOutline(o,sources),/conceitos sem capítulo/);
});
test('rejeita resumos superficiais, cenas sem exemplo e exercícios sem justificativa',()=>{
 assert.ok(validateChapter(structuredClone(chapter),outline.chapters[0]).estimatedMinutes>=5);
 const shallow=structuredClone(chapter);shallow.scenes[0].beats[0].narration='Resumo breve';assert.throws(()=>validateChapter(shallow,outline.chapters[0]),/curta/);
 const noExample=structuredClone(chapter);noExample.scenes.forEach(s=>s.role='concept');assert.throws(()=>validateChapter(noExample,outline.chapters[0]),/exemplo/);
 const noPause=structuredClone(chapter);noPause.scenes[2].checkpoint=null;assert.throws(()=>validateChapter(noPause,outline.chapters[0]),/pausa/);
 const badDiagram=structuredClone(chapter);badDiagram.scenes[0].beats[0].focus=['inventado'];assert.throws(()=>validateChapter(badDiagram,outline.chapters[0]),/destaque/);
 const badQuestion=structuredClone(chapter);badQuestion.quiz[0].rationales=[];assert.throws(()=>validateChapter(badQuestion,outline.chapters[0]),/justificativas/);
});
test('simulado integrador cobre todos os capítulos; nota não conta respostas em branco',()=>{
 const exam={questions:Array.from({length:8},(_,i)=>({...question,chapterId:i%2?'c1':'c2'}))};
 assert.equal(validateFinalExam(exam,outline).questions.length,8);
 assert.deepEqual(grade(exam.questions,[1,0,1]),{score:2,total:8,percent:25});
 exam.questions.forEach(q=>q.chapterId='c1');assert.throws(()=>validateFinalExam(exam,outline),/fora do simulado/);
 assert.ok(isCourse(JSON.parse(JSON.stringify(courseFixture()))));
});
test('contrato usa capítulos progressivos, fonte integral e etapa separada, sem gerar curso fictício',async()=>{
 const old=globalThis.fetch,key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test';let payload;
 globalThis.fetch=async(u,opts)=>{payload=JSON.parse(opts.body);return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(outline)}]}}]})}};
 const r={setHeader(){},status(n){this.code=n;return this},json(d){this.data=d;return this}};
 try{
  await handler({method:'POST',body:{action:'outline',title:'Estatística',content}},r);assert.equal(r.code,200);assert.equal(r.data.sources.length,2);
  assert.ok(payload.generationConfig.responseFormat.text.schema.required.includes('chapters'));
  const all=JSON.stringify(payload);assert.match(all,/aplicacoes.txt/);assert.match(all,/estatistica.txt/);
  assert.match(coursePrompt('chapter','Teste',outline,outline.chapters[0]),/worked-example/);
  await handler({method:'POST',body:{action:'chapter',title:'Teste',content,outline,chapterId:'desconhecido'}},r);assert.equal(r.code,400);
 }finally{globalThis.fetch=old;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});

test('envia esquema obrigatório de exercícios completos ao provedor',()=>{
 const schema=courseSchema('chapter',sources,outline,outline.chapters[0]);
 const q=schema.properties.quiz.items;
 assert.deepEqual(q.properties.options,{type:'array',items:{type:'string'},minItems:4,maxItems:4});
 assert.equal(providerSchema(schema).properties.scenes.maxItems,undefined);
 assert.ok(q.required.includes('rationales'));assert.ok(q.required.includes('hint'));assert.ok(q.required.includes('skill'));
 assert.deepEqual(schema.properties.scenes.items.properties.checkpoint.type,['object','null']);
 assert.equal(courseSchema('final',sources,outline).properties.questions.minItems,8);
});
