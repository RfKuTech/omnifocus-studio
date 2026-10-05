import { COURSE_VERSION, isCourse, grade, validateChapter, validateOutline, sourceCatalog, validateFinalExam } from './lib/course.js';

const $ = id => document.getElementById(id);
function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function button(text, action, cls = '') { const b = node('button', `course-btn ${cls}`, text); b.type = 'button'; b.onclick = action; return b; }
function list(items) { const ul = node('ul', 'course-goals'); items.forEach(t => ul.append(node('li', '', t))); return ul; }

export class CoursePlayer {
  constructor(hooks) {
    this.hooks = hooks; this.course = null; this.chapterId = null; this.sceneIndex = 0; this.beatIndex = 0;
    this.epoch = 0; this.playing = false; this.voice = true; this.rate = 1; this.view = 0; this.pending = new Map(); this.wordTimer = null;
    this.root = node('section', 'course-shell'); this.root.id = 'coursePlayer'; this.root.hidden = true;
    $('playerContainer').parentElement.prepend(this.root);
    this.onHidden = () => { if (document.hidden && this.playing) this.pause(); };
    document.addEventListener('visibilitychange', this.onHidden);
  }
  stopAudio() {
    this.epoch++; this.playing = false; this.paused = false; this.onResume = null; clearTimeout(this.wordTimer); this.wordTimer = null;
    window.speechSynthesis?.cancel();
  }
  stop() { this.stopAudio(); this.view++; this.root.hidden = true; document.body.classList.remove('course-open'); }
  persist(course = this.course) {
    if (this.hooks.save(course) === false && course === this.course) this.status('O navegador está sem espaço para salvar. Conecte a nuvem e sincronize antes de fechar.', true);
  }
  progress() {
    const p = this.course.progress ||= {};
    return p[this.chapterId] ||= { scene:0, beat:0, checkpoints:{}, practice:'', criteria:[], quizAnswers:[], quizSubmitted:false };
  }
  status(message, error = false) {
    const s = this.root.querySelector('.course-status'); if (s) { s.textContent = message; s.classList.toggle('course-error', error); }
  }
  async request(action, course, extra = {}) {
    const r = await fetch(new URL('course', this.hooks.api()).href, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,title:course.title,content:course.sourceText,youtubeUrls:course.youtubeUrls,outline:course.outline,...extra}),signal:AbortSignal.timeout(118000)});
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.error || `O servidor não concluiu a etapa (${r.status}). Seu curso salvo foi mantido.`);
    if (!d) throw new Error('O servidor devolveu uma resposta ilegível.');
    return d;
  }
  async create(title, content, youtubeUrls) {
    this.stopAudio(); this.view++;
    const candidate = {kind:'course',version:COURSE_VERSION,id:crypto.randomUUID(),title,sourceText:content,youtubeUrls,chapters:{},progress:{}};
    this.course = candidate; this.root.hidden = false; document.body.classList.add('course-open');
    this.root.replaceChildren(node('div','course-top','Organizando os conceitos dos materiais…'));
    const busy = node('div','course-loading'); busy.append(node('span','course-spinner'),node('span','','Criando um plano de curso com capítulos e objetivos.')); this.root.append(busy);
    const view = this.view;
    try {
      const d = await this.request('outline',candidate);
      candidate.outline = validateOutline(d.outline,sourceCatalog(content,youtubeUrls)); candidate.sources = d.sources;
      this.persist(candidate);
      if (view === this.view) this.start(candidate);
      return candidate;
    } catch (error) {
      if (view === this.view) { this.root.replaceChildren(node('p','course-top course-error',error.name === 'TimeoutError' ? 'O planejamento demorou demais. Os materiais continuam no formulário; tente novamente.' : error.message)); }
      throw error;
    }
  }
  start(course) {
    this.stopAudio(); this.view++; this.course = course; this.root.hidden = false; document.body.classList.add('course-open');
    this.chapterId = course.activeChapter || course.outline.chapters[0].id;
    if (!course.outline.chapters.some(c => c.id === this.chapterId)) this.chapterId = course.outline.chapters[0].id;
    this.layout(); this.openChapter(this.chapterId);
  }
  layout() {
    this.root.replaceChildren();
    const top = node('header','course-top');
    top.append(node('div','course-kicker','OMNI / ESTÚDIO DE APRENDIZAGEM'),node('h2','course-title',this.course.outline.title),node('p','course-description',this.course.outline.description));
    const overview = node('details','course-transcript'); overview.append(node('summary','','Objetivos e conhecimentos prévios'),list(this.course.outline.goals));
    if(this.course.outline.prerequisites.length) overview.append(node('p','','Conhecimentos prévios:'),list(this.course.outline.prerequisites));
    top.append(overview);
    const body = node('div','course-layout'); this.sidebar = node('nav','course-sidebar'); this.sidebar.setAttribute('aria-label','Capítulos do curso');
    this.main = node('div','course-body'); body.append(this.sidebar,this.main); this.root.append(top,body); this.renderSidebar();
  }
  renderSidebar() {
    this.sidebar.replaceChildren(node('p','course-kicker','Seu percurso'));
    this.course.outline.chapters.forEach((c,i) => {
      const b = button(`${String(i+1).padStart(2,'0')} · ${c.title}`,()=>this.openChapter(c.id)); b.className='course-chapter'; b.setAttribute('aria-current',String(c.id === this.chapterId));
      const done = this.course.progress?.[c.id]?.quizSubmitted;
      b.append(node('small','',done?'✓ Aula e avaliação concluídas':this.course.chapters[c.id]?'Aula pronta para assistir':'A desenvolver')); this.sidebar.append(b);
    });
    const final = button('Simulado integrador',()=>this.openFinal()); final.className='course-chapter'; this.sidebar.append(final);
  }
  baseMain(title, subtitle) {
    this.main.replaceChildren(node('p','course-kicker',subtitle),node('h3','course-title',title));
    const status = node('p','course-status'); status.setAttribute('role','status'); this.main.append(status);
  }
  openChapter(id) {
    this.stopAudio(); this.view++; this.chapterId = id; this.course.activeChapter = id; this.renderSidebar();
    const planned = this.course.outline.chapters.find(c => c.id === id), chapter = this.course.chapters[id];
    this.baseMain(planned.title,'CAPÍTULO / OBJETIVO'); this.main.append(node('p','course-description',planned.objective));
    this.persist();
    if (!chapter) {
      this.main.append(list(this.course.outline.coverage.filter(t=>planned.topicIds.includes(t.id)).map(t=>t.title)));
      const generate = button('Desenvolver esta videoaula',()=>this.generateChapter(), 'primary');
      const pending = this.pending.has(`${this.course.id}:${id}`); generate.disabled = pending;
      this.main.append(generate); this.status(pending?'Preparando animações, exemplos e exercícios deste capítulo…':'O capítulo será desenvolvido com explicações, exemplos resolvidos e exercícios. A geração pode levar até dois minutos.');
      this.sources(planned.sourceIds); return;
    }
    const p = this.progress();
    this.sceneIndex = Math.min(p.scene || 0,chapter.scenes.length-1); this.beatIndex = Math.min(p.beat || 0,chapter.scenes[this.sceneIndex].beats.length-1);
    this.renderScene();
  }
  async generateChapter() {
    const course = this.course, id = this.chapterId, key = `${course.id}:${id}`;
    if (this.pending.has(key)) return;
    const job = this.request('chapter',course,{chapterId:id}); this.pending.set(key,job); this.openChapter(id);
    try {
      const d = await job;
      course.chapters[id] = validateChapter(d.chapter,course.outline.chapters.find(c=>c.id===id)); this.persist(course);
      if (this.course === course && this.chapterId === id && !this.root.hidden) this.openChapter(id);
    } catch (err) { if (this.course === course && this.chapterId === id) { this.openChapter(id); this.status(err.name==='TimeoutError'?'A geração demorou demais. O plano está salvo; tente novamente.':err.message,true); } }
    finally { this.pending.delete(key); if (this.course === course && this.chapterId === id) { const b=[...this.main.querySelectorAll('button')].find(b=>b.textContent==='Desenvolver esta videoaula'); if(b)b.disabled=false; } }
  }
  sources(ids) {
    const d = node('details','course-source-list'); d.append(node('summary','','Fontes e conceitos deste capítulo'));
    (this.course.sources || []).filter(s=>ids.includes(s.id)).forEach(s=>{const p=node('p','',`${s.id} · ${s.name}`); if(s.url){const a=node('a','','Abrir fonte');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';p.append(document.createTextNode(' — '),a);}d.append(p);});
    this.main.append(d);
  }
  chapter() { return this.course.chapters[this.chapterId]; }
  scene() { return this.chapter().scenes[this.sceneIndex]; }
  renderScene() {
    this.stopAudio(); this.view++;
    const c = this.chapter(), s = this.scene();
    this.baseMain(c.title,`CENA ${this.sceneIndex+1} DE ${c.scenes.length} · CERCA DE ${c.estimatedMinutes} MIN DE NARRAÇÃO NO CAPÍTULO`);
    const timeline=node('div','course-scene-progress');c.scenes.forEach((_,i)=>timeline.append(node('span',i<=this.sceneIndex?'done':'')));this.main.append(timeline);
    this.stage=node('div','course-stage'); this.stage.append(node('h4','course-scene-title',s.title));
    this.visual = this.buildVisual(s.visual); this.caption=node('p','course-caption');this.stage.append(this.visual,this.caption);this.main.append(this.stage);
    const controls=node('div','course-controls');
    this.playButton=button('▶ Reproduzir',()=>this.toggle(),'primary small');
    this.backButton=button('← Fala anterior',()=>this.moveBeat(-1),'small');
    this.forwardButton=button('Próxima fala →',()=>this.moveBeat(1),'small');
    const sound=button(this.voice?'Voz ligada':'Somente legendas',()=>{const was=this.playing;this.stopAudio();this.voice=!this.voice;sound.textContent=this.voice?'Voz ligada':'Somente legendas';if(was)this.play();},'small');
    const speed=node('select');speed.setAttribute('aria-label','Velocidade de reprodução');[0.8,1,1.2,1.5].forEach(v=>{const o=node('option','',`${v}×`);o.value=v;speed.append(o)});speed.value=this.rate;
    speed.onchange=()=>{const was=this.playing;this.stopAudio();this.rate=Number(speed.value);if(was)this.play();};
    controls.append(this.playButton,this.backButton,this.forwardButton,sound,speed);this.main.append(controls);
    this.transcript=node('details','course-transcript');this.transcript.append(node('summary','','Ler a explicação completa desta cena'));s.beats.forEach(b=>this.transcript.append(node('p','',b.narration)));this.main.append(this.transcript);
    this.pauseBox=node('div');this.main.append(this.pauseBox);
    const nav=node('div','course-actions');
    const prev=button('← Cena anterior',()=>{if(this.sceneIndex>0){this.sceneIndex--;this.beatIndex=0;this.renderScene();}});prev.disabled=this.sceneIndex===0;
    this.nextButton=button(this.sceneIndex===c.scenes.length-1?'Estudo de caso e simulado →':'Próxima cena →',()=>this.nextScene(),'primary');
    nav.append(prev,this.nextButton);this.main.append(nav);this.sources(s.sourceIds);
    this.renderBeat();
  }
  buildVisual(v) {
    const box=node('div',`course-visual visual-${v.kind}`);
    const max=Math.max(1,...v.items.map(it=>it.value||0));
    v.items.forEach((it,i)=>{
      if(i && ['process','timeline','equation'].includes(v.kind))box.append(node('div','visual-arrow',v.kind==='equation'?'↓':'→'));
      const item=node('div','visual-item');item.dataset.itemId=it.id;
      item.append(node('div','visual-number',String(i+1).padStart(2,'0')));
      if(v.kind==='bars'){const track=node('div','course-bar-track'),bar=node('div','course-bar');bar.style.setProperty('--bar-height',`${100*it.value/max}%`);track.append(bar);item.append(track,node('strong','',String(it.value)));}
      if(v.kind==='fraction'){const grid=node('div','course-fraction');for(let n=0;n<it.total;n++){const piece=node('i',n<it.value?'filled':'');piece.style.setProperty('--piece',n);grid.append(piece)}item.append(grid,node('strong','',`${it.value}/${it.total}`));}
      item.append(node('h4','',it.label),node('p','',it.detail));box.append(item);
    });return box;
  }
  renderBeat() {
    const s=this.scene(), b=s.beats[this.beatIndex];
    const revealed=new Set(s.beats.slice(0,this.beatIndex+1).flatMap(b=>b.focus));
    this.visual.querySelectorAll('[data-item-id]').forEach(n=>{n.classList.toggle('revealed',revealed.has(n.dataset.itemId));n.classList.toggle('focus',b.focus.includes(n.dataset.itemId));});
    this.visual.querySelectorAll('.visual-arrow').forEach(n=>n.classList.toggle('active',n.nextElementSibling?.classList.contains('focus')));
    this.caption.textContent=b.caption;
    this.backButton.disabled=this.beatIndex===0;this.forwardButton.disabled=false;
    this.forwardButton.textContent=this.beatIndex===s.beats.length-1?'Terminar esta cena →':'Próxima fala →';
    this.nextButton.disabled=!this.sceneComplete();
    this.pauseBox.replaceChildren();
    const p=this.progress();p.scene=this.sceneIndex;p.beat=this.beatIndex;this.persist();
    this.status(`Fala ${this.beatIndex+1} de ${s.beats.length}. A narração acompanha os destaques. Você pode pausar ou ler a explicação completa.`);
  }
  sceneComplete() { const p=this.progress();return this.scene().checkpoint ? p.checkpoints[this.sceneIndex]?.passed===true : p.watched?.[this.sceneIndex]===true; }
  toggle() { if(this.playing)this.pause();else this.play(); }
  pause() {
    if (this.playing) {
      this.playing = false; this.paused = true;
      if (this.wordTimer) { clearTimeout(this.wordTimer); this.wordTimer = null; this.remaining = Math.max(0, this.dueAt - Date.now()); }
      window.speechSynthesis?.pause();
    }
    if(this.playButton)this.playButton.textContent='▶ Continuar';
  }
  play() {
    if (this.paused) {
      this.paused = false; this.playing = true; this.playButton.textContent='❚❚ Pausar';
      if (this.onResume) { const resume = this.onResume; this.onResume = null; resume(); }
      else if (this.voice && window.speechSynthesis) window.speechSynthesis.resume();
      else { this.dueAt = Date.now() + this.remaining; this.wordTimer = setTimeout(this.timedFinish, this.remaining); }
      return;
    }
    this.stopAudio();this.playing=true;this.playButton.textContent='❚❚ Pausar';
    const token=this.epoch,b=this.scene().beats[this.beatIndex];
    this.status('Reproduzindo. A aula vai parar no próximo exercício.');
    const finished=()=>{if(token!==this.epoch)return;if(!this.playing){this.onResume=finished;return;}this.playing=false;this.advancePlayback();};
    if(this.voice && window.speechSynthesis && window.SpeechSynthesisUtterance){
      // Short utterances avoid browsers interrupting long narration. All text is retained.
      const segments=b.narration.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[b.narration];let index=0;
      const speak=()=>{
        if(token!==this.epoch)return;
        if(!this.playing){this.onResume=speak;return;}
        if(index>=segments.length)return finished();
        const u=new SpeechSynthesisUtterance(segments[index++]);u.lang='pt-BR';u.rate=this.rate;
        const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='pt-BR')||voices.find(v=>v.lang.startsWith('pt'))||null;
        u.onend=speak;u.onerror=()=>{if(token!==this.epoch)return;this.pause();this.status('A voz não pôde ser reproduzida. Escolha “Somente legendas” ou leia a explicação completa.',true);};
        this.utterance=u;window.speechSynthesis.speak(u);
      };speak();
    } else {
      this.caption.textContent=b.narration;
      this.remaining=Math.max(6000,b.narration.split(/\s+/).length/2.25/this.rate*1000);this.dueAt=Date.now()+this.remaining;this.timedFinish=finished;this.wordTimer=setTimeout(finished,this.remaining);
    }
  }
  advancePlayback() {
    if(this.beatIndex<this.scene().beats.length-1){this.beatIndex++;this.renderBeat();this.play();}
    else this.finishScene(true);
  }
  moveBeat(delta) {
    this.stopAudio();
    if(delta>0 && this.beatIndex===this.scene().beats.length-1)return this.finishScene(false);
    this.beatIndex=Math.max(0,Math.min(this.scene().beats.length-1,this.beatIndex+delta));this.renderBeat();
  }
  finishScene(autoplay) {
    this.stopAudio(); this.playButton.textContent='▶ Reproduzir'; const p=this.progress();(p.watched ||= {})[this.sceneIndex]=true;this.persist();
    if(this.scene().checkpoint){this.showCheckpoint();return;}
    this.nextButton.disabled=false;
    if(autoplay && this.sceneIndex<this.chapter().scenes.length-1){this.sceneIndex++;this.beatIndex=0;this.renderScene();this.play();}
    else this.status('Cena concluída. Continue quando quiser.');
  }
  showCheckpoint() {
    this.pauseBox.replaceChildren();
    const q=this.scene().checkpoint;const box=node('section','course-checkpoint');box.append(node('p','course-kicker','PAUSA / APLIQUE O QUE APRENDEU'),node('h4','course-question',q.prompt));
    const p=this.progress(), saved=p.checkpoints[this.sceneIndex];
    const options=node('div'),feedback=node('div','course-feedback');feedback.hidden=true;
    q.options.forEach((t,i)=>{const b=button(t,()=>{
      const previous=p.checkpoints[this.sceneIndex]||{attempts:0};const passed=i===q.correct;
      p.checkpoints[this.sceneIndex]={...previous,selected:i,attempts:previous.attempts+1,passed:previous.passed||passed};
      options.querySelectorAll('button').forEach(n=>n.classList.remove('wrong','right'));
      b.classList.add(passed?'right':'wrong');feedback.hidden=false;feedback.textContent=(passed?'Correto. ':'Vamos revisar o raciocínio. ')+q.rationales[i];
      if(passed){options.querySelectorAll('button').forEach(n=>n.disabled=true);this.nextButton.disabled=false;this.status('Exercício resolvido. Continue para a próxima cena.');}
      else this.status('Use a justificativa e a pista para tentar novamente.');this.persist();
    });b.className='course-option';options.append(b);});
    const hint=button('Ver pista',()=>{feedback.hidden=false;feedback.textContent=q.hint;},'small');
    box.append(options,hint,feedback);this.pauseBox.append(box);
    if(saved?.passed){options.querySelectorAll('button').forEach((n,i)=>{n.disabled=true;n.classList.toggle('right',i===q.correct)});feedback.hidden=false;feedback.textContent=q.rationales[q.correct];this.nextButton.disabled=false;}
    this.status('Reprodução pausada para uma pergunta de aplicação.');
  }
  nextScene() {
    if(!this.sceneComplete()){this.status('Conclua a cena e resolva a pausa de compreensão antes de avançar.');return;}
    if(this.sceneIndex===this.chapter().scenes.length-1)return this.openPractice();
    this.sceneIndex++;this.beatIndex=0;this.renderScene();
  }
  openPractice() {
    this.stopAudio();this.view++;const c=this.chapter(),p=this.progress(),task=c.practice;
    this.baseMain('Estudo de caso','PRÁTICA / DO CONCEITO À DECISÃO');
    const box=node('section','course-practice');box.append(node('p','',task.scenario),node('h4','course-question',task.prompt),list(task.criteria));
    const answer=node('textarea');answer.setAttribute('aria-label','Sua resolução do estudo de caso');answer.placeholder='Explique sua solução, os passos e por que tomou cada decisão…';answer.value=p.practice;
    answer.oninput=()=>{p.practice=answer.value;this.persist();};box.append(answer);
    const review=node('div');const reveal=button('Comparar com a resolução comentada',()=>{
      if(answer.value.trim().length<30){this.status('Escreva primeiro seu raciocínio, mesmo que esteja incompleto.');answer.focus();return;}
      review.replaceChildren(node('h4','course-question','Resolução comentada'),node('p','course-feedback',task.modelAnswer),node('p','course-status','Autoavaliação: marque os critérios que sua resposta atende. O sistema não atribui uma nota automática ao texto livre.'));
      task.criteria.forEach((t,i)=>{const label=node('label'),cb=node('input');cb.type='checkbox';cb.checked=Boolean(p.criteria[i]);cb.onchange=()=>{p.criteria[i]=cb.checked;this.persist();};label.append(cb,document.createTextNode(t));review.append(label)});
      p.practiceReviewed=true;this.persist();
      review.append(button('Iniciar simulado do capítulo',()=>this.openQuiz(c.quiz,false),'primary'));
    },'primary');box.append(reveal,review);this.main.append(box);
    this.main.append(button('← Rever a última cena',()=>this.renderScene()));
    if(p.practiceReviewed && p.practice.trim().length>=30)reveal.click();
  }
  openQuiz(questions, final) {
    this.stopAudio();this.view++;
    const p=final?(this.course.finalProgress ||= {answers:[],submitted:false}):this.progress();
    const answers=final?p.answers:p.quizAnswers;
    const submitted=final?p.submitted:p.quizSubmitted;
    this.baseMain(final?'Simulado integrador':'Simulado do capítulo','AVALIAÇÃO / ANALISE, APLIQUE E JUSTIFIQUE');
    this.main.append(node('p','course-description','Responda todas as questões. As justificativas aparecem depois da entrega.'));
    questions.forEach((q,qi)=>{
      const box=node('section','course-review');box.append(node('p','course-kicker',`${qi+1} / ${questions.length} · ${q.skill}`),node('h4','course-question',q.prompt));
      if(q.scenario){const scenario=node('p','course-feedback',q.scenario);box.insertBefore(scenario,box.querySelector('.course-question'));}
      q.options.forEach((t,i)=>{const b=button(t,()=>{answers[qi]=i;box.querySelectorAll('button').forEach((n,j)=>{n.classList.toggle('selected',j===i);n.setAttribute('aria-pressed',String(j===i))});this.persist();});b.className='course-option';b.classList.toggle('selected',answers[qi]===i);b.setAttribute('aria-pressed',String(answers[qi]===i));b.disabled=submitted;
        if(submitted)b.classList.toggle('right',i===q.correct);box.append(b);});
      if(submitted){const feedback=node('div','course-feedback');feedback.append(node('strong','',answers[qi]===q.correct?'Você acertou.':'Reveja este conceito.'));q.rationales.forEach((r,i)=>feedback.append(node('p','',`${String.fromCharCode(65+i)} · ${r}`)));box.append(feedback);}
      this.main.append(box);
    });
    if(submitted){const result=grade(questions,answers);this.main.prepend(node('div','course-score',`${result.percent}%`),node('p','course-status',`${result.score} de ${result.total} respostas corretas. Leia as justificativas para revisar os pontos que faltaram.`));
      this.main.append(button('Refazer o simulado',()=>{if(final){p.submitted=false;p.answers=[];}else{p.quizSubmitted=false;p.quizAnswers=[];}this.persist();this.openQuiz(questions,final);}));
      if(!final){const ix=this.course.outline.chapters.findIndex(c=>c.id===this.chapterId);const next=this.course.outline.chapters[ix+1];this.main.append(button(next?'Próximo capítulo →':'Ir ao simulado integrador →',()=>next?this.openChapter(next.id):this.openFinal(),'primary'));}
    }else this.main.append(button('Entregar e ver correção',()=>{
      if(questions.some((q,i)=>!Number.isInteger(answers[i]))){this.status('Ainda há questões sem resposta. Complete todas antes de entregar.',true);this.main.querySelector('.course-status')?.scrollIntoView({block:'nearest'});return;}
      if(final)p.submitted=true;else p.quizSubmitted=true;this.persist();this.renderSidebar();this.openQuiz(questions,final);
    },'primary'));
  }
  async openFinal() {
    this.stopAudio();this.view++;const view=this.view,course=this.course;
    this.baseMain('Simulado integrador','CURSO / CONEXÕES ENTRE CAPÍTULOS');
    const incomplete=course.outline.chapters.filter(c=>!course.progress?.[c.id]?.quizSubmitted);
    if(incomplete.length){this.main.append(node('p','course-description','Conclua as avaliações destes capítulos para fazer o simulado integrador:'),list(incomplete.map(c=>c.title)),button('Continuar o curso',()=>this.openChapter(incomplete[0].id),'primary'));return;}
    if(course.finalExam)return this.openQuiz(course.finalExam.questions,true);
    const b=button('Gerar simulado integrador',async()=>{
      if(this.pending.has(`${course.id}:final`))return;
      b.disabled=true;this.status('Preparando questões que conectam os capítulos…');
      const job=this.request('final',course);this.pending.set(`${course.id}:final`,job);
      try{const d=await job;course.finalExam=validateFinalExam(d.exam,course.outline);this.persist(course);if(this.view===view&&this.course===course)this.openQuiz(d.exam.questions,true);}
      catch(err){if(this.view===view)this.status(err.message,true);}
      finally{this.pending.delete(`${course.id}:final`);b.disabled=false;}
    },'primary');b.disabled=this.pending.has(`${course.id}:final`);this.main.append(b);
  }
}

let player;
window.OmniCourse = {
  init(hooks){ player = new CoursePlayer(hooks); },
  create(...args){return player.create(...args)},
  start(course){return player.start(course)},
  stop(){player?.stop()},
  isCourse
};
window.OmniCourse.init({save:course=>saveLessonToLibrary(course),api:()=>state.apiServerlessUrl});
