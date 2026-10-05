// Run with CHROMIUM_PATH=/path/to/chromium npm run test:browser (or Playwright's installed Chromium).
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { courseFixture } from './fixtures/course.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{
 const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
 if(!path.startsWith(root)){res.writeHead(403);res.end();return;}
 try{const body=await readFile(path);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const screenshots=process.env.SCREENSHOTS_DIR||'/tmp';await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
const page=await browser.newPage({viewport:{width:1440,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.pdfjsLib={GlobalWorkerOptions:{}};window.tailwind={};});
// External auth and generation are not invoked by a local playback check.
await page.route('https://accounts.google.com/**',route=>route.abort());
await page.goto(base);await page.waitForFunction(()=>window.OmniCourse);
await page.evaluate(()=>{
 window.__speech={utterances:[],pauseCount:0,resumeCount:0};
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel(){},pause(){window.__speech.pauseCount++},resume(){window.__speech.resumeCount++},speak(u){window.__speech.utterances.push(u)}}});
});
await page.evaluate(course=>window.OmniCourse.start(course),courseFixture());
await page.getByRole('button',{name:'▶ Reproduzir',exact:true}).click();
await page.getByRole('button',{name:'❚❚ Pausar',exact:true}).click();
await page.getByRole('button',{name:'▶ Continuar',exact:true}).click();
const resumed=await page.evaluate(()=>({speaks:__speech.utterances.length,pauses:__speech.pauseCount,resumes:__speech.resumeCount}));
if(resumed.speaks!==1||resumed.pauses!==1||resumed.resumes!==1)throw Error('Pause/resume restarted narration');
await page.evaluate(()=>{let index=0;while(index<window.__speech.utterances.length&&index<1000)window.__speech.utterances[index++].onend();});
if(!await page.locator('.course-checkpoint').isVisible())throw Error('Autoplay did not stop for checkpoint');
if(!await page.getByRole('button',{name:'Próxima cena →',exact:true}).isDisabled())throw Error('Autoplay bypassed checkpoint');
await page.evaluate(()=>{window.__stale=window.__speech.utterances.at(-1).onend});
await page.evaluate(course=>window.OmniCourse.start(course),courseFixture());
await page.evaluate(()=>window.__stale());
if(!await page.getByText('Cinco salários, duas histórias',{exact:true}).isVisible())throw Error('Stale audio changed scene');

await page.screenshot({path:`${screenshots}/omni-course-desktop.png`,fullPage:true});
const result=await page.evaluate(()=>({defaultMode:document.getElementById('learningMode').value,visible:!!document.querySelector('#coursePlayer .course-stage'),elements:document.querySelectorAll('.visual-item').length,nextDisabled:[...document.querySelectorAll('.course-actions button')].find(b=>b.textContent.includes('Próxima cena'))?.disabled}));
console.log(result);
// Skip each narration beat using the accessible read controls; checkpoint must stop advancement.
for(let s=0;s<3;s++){
 for(let b=0;b<3;b++)await page.getByRole('button',{name:b===2?'Terminar esta cena →':'Próxima fala →',exact:true}).click();
 if(s<2)await page.getByRole('button',{name:'Próxima cena →',exact:true}).click();
}
await page.getByRole('heading',{name:'Uma empresa divulga salário médio de R$ 4.120, mas quatro de seus cinco funcionários recebem menos de R$ 2.400. Qual conclusão é sustentada?',exact:true}).waitFor();
if(!await page.getByRole('button',{name:'Próxima cena →',exact:true}).isDisabled())throw Error('Checkpoint was bypassed');
await page.getByRole('button',{name:'A média está necessariamente errada.',exact:true}).click();
if(!await page.getByRole('button',{name:'Próxima cena →',exact:true}).isDisabled())throw Error('Incorrect answer unlocked checkpoint');
await page.getByRole('button',{name:'Um salário alto pode elevar a média, sem representar o salário típico.',exact:true}).click();
await page.getByRole('button',{name:'Próxima cena →',exact:true}).click();
for(let s=3;s<5;s++){
 for(let b=0;b<3;b++)await page.getByRole('button',{name:b===2?'Terminar esta cena →':'Próxima fala →',exact:true}).click();
 if(s===4)await page.getByRole('button',{name:'Um salário alto pode elevar a média, sem representar o salário típico.',exact:true}).click();
 await page.getByRole('button',{name:s===4?'Estudo de caso e simulado →':'Próxima cena →',exact:true}).click();
}
await page.getByRole('textbox',{name:'Sua resolução do estudo de caso'}).fill('A média está correta mas não representa a maioria, porque o maior salário aumenta a soma. A mediana representa melhor o centro.');
await page.getByRole('button',{name:'Comparar com a resolução comentada'}).click();
await page.getByRole('button',{name:'Iniciar simulado do capítulo'}).click();
await page.getByRole('button',{name:'Entregar e ver correção'}).click();
if(await page.locator('.course-score').count())throw Error('Blank exam was submitted');
const answer=page.getByRole('button',{name:'Um salário alto pode elevar a média, sem representar o salário típico.',exact:true});for(let i=0;i<4;i++)await answer.nth(i).click();
await page.getByRole('button',{name:'Entregar e ver correção'}).click();
await page.getByText('100%',{exact:true}).waitFor();
await page.getByRole('button',{name:'Simulado integrador',exact:true}).click();
await page.getByText('Conclua as avaliações destes capítulos para fazer o simulado integrador:').waitFor();
await page.reload();await page.waitForFunction(()=>window.OmniCourse);await page.getByRole('button',{name:/Aulas \(/}).click();await page.getByRole('button',{name:'Carregar ➔',exact:true}).click();
if(!await page.locator('.course-stage').isVisible())throw Error('Cloud/library course restore failed');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${screenshots}/omni-course-mobile.png`,fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);console.log({flow:'checkpoint wrong/right, practice, exam and library restore passed',overflow,errors});
if(errors.length||overflow)throw Error('Browser errors or mobile overflow');

} finally {await browser.close();server.close();}
