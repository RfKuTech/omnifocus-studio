// Structural output contract sent to Gemini; semantic validation remains in course.js.
const str = {type:'string'};
const arr = (items, minItems, maxItems) => ({type:'array',items,minItems,maxItems});
const obj = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const refs = values => arr({...str,enum:values},1,48);
const question = obj({prompt:str,options:arr(str,4,4),correct:{type:'integer',minimum:0,maximum:3},rationales:arr(str,4,4),hint:str,skill:str});
export function courseSchema(action, sources, outline, chapter) {
  if(action==='outline')return obj({title:str,description:str,goals:arr(str,2,8),prerequisites:arr(str,0,20),coverage:arr(obj({id:str,sourceId:{...str,enum:sources.map(s=>s.id)},title:str}),2,48),chapters:arr(obj({id:str,title:str,objective:str,topicIds:arr(str,1,48),sourceIds:refs(sources.map(s=>s.id))}),2,12)});
  if(action==='final')return obj({questions:arr(obj({...question.properties,chapterId:{...str,enum:outline.chapters.map(c=>c.id)}}),Math.max(8,outline.chapters.length),16)});
  const visualItem=obj({id:str,label:str,detail:str,value:{type:'number'},total:{type:'integer'}});
  visualItem.required=['id','label','detail'];
  return obj({id:{...str,enum:[chapter.id]},title:str,scenes:arr(obj({title:str,role:{...str,enum:['concept','worked-example','application','recap']},topicIds:refs(chapter.topicIds),sourceIds:refs(chapter.sourceIds),visual:obj({kind:{...str,enum:['process','comparison','equation','bars','timeline','concept','fraction']},items:arr(visualItem,2,5)}),beats:arr(obj({narration:{...str,description:'35 a 75 palavras de explicação desenvolvida, não apenas uma frase.'},caption:str,focus:arr(str,1,5)}),3,6),checkpoint:{...question,type:['object','null']}}),5,10),practice:obj({scenario:str,prompt:str,criteria:arr(str,3,6),modelAnswer:str}),quiz:arr(question,4,8)});
}

// Large nested array bounds expand the provider grammar exponentially. Keep the
// shape/types mandatory; exact counts are enforced by prompts and local validation.
export function providerSchema(schema) {
 if(Array.isArray(schema))return schema.map(providerSchema);
 if(!schema || typeof schema!=='object')return schema;
 return Object.fromEntries(Object.entries(schema).filter(([k])=>!['minItems','maxItems'].includes(k)).map(([k,v])=>[k,providerSchema(v)]));
}
