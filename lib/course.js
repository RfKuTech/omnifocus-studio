// Shared contract for generation, playback and persisted courses. No generated HTML or code.
export const COURSE_VERSION = 2;
const text = (v, max = 5000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const strings = (v, min, max) => Array.isArray(v) && v.length >= min && v.length <= max && v.every(x => text(x));
function check(ok, message) { if (!ok) throw new Error(message); }
export function sourceCatalog(content = '', urls = []) {
  const sources = [];
  const pattern = /--- \[(?:PDF|Arquivo): ([^\]\n]+)\] ---/g;
  const matches = [...content.matchAll(pattern)];
  const add = (name, body) => { if (body.trim()) sources.push({ id: `s${sources.length + 1}`, name, text: body.trim() }); };
  if (!matches.length) add('Texto enviado', content);
  else {
    add('Texto complementar', content.slice(0, matches[0].index));
    matches.forEach((m, i) => add(m[1], content.slice(m.index + m[0].length, matches[i + 1]?.index ?? content.length)));
  }
  urls.forEach((url, i) => sources.push({ id: `v${i + 1}`, name: `Vídeo ${i + 1}`, url }));
  return sources;
}
export function validateOutline(o, sources) {
  check(o && text(o.title, 200) && text(o.description) && strings(o.goals, 2, 8) && Array.isArray(o.prerequisites) && o.prerequisites.every(x => text(x)), 'O plano do curso veio incompleto.');
  check(Array.isArray(o.coverage) && o.coverage.length >= 2 && o.coverage.length <= 48, 'O plano precisa mapear os conceitos dos materiais.');
  const ids = new Set(sources.map(s => s.id));
  const topics = new Set();
  o.coverage.forEach(t => {
    check(t && text(t.id, 40) && !topics.has(t.id) && ids.has(t.sourceId) && text(t.title, 200), 'O mapa de fontes contém uma referência inválida.'); topics.add(t.id);
  });
  check(sources.every(s => o.coverage.some(t => t.sourceId === s.id)), 'Uma fonte enviada ficou fora do plano do curso.');
  check(Array.isArray(o.chapters) && o.chapters.length >= 2 && o.chapters.length <= 12, 'O curso precisa de 2 a 12 capítulos.');
  const chapters = new Set(), covered = new Set();
  o.chapters.forEach(c => {
    check(c && text(c.id, 40) && !chapters.has(c.id) && text(c.title, 200) && text(c.objective) && strings(c.topicIds, 1, 48) && strings(c.sourceIds, 1, 30), 'Um capítulo veio incompleto.');
    check(c.sourceIds.every(id => ids.has(id)) && c.topicIds.every(id => topics.has(id)), 'Capítulo com fontes desconhecidas.');
    check(c.topicIds.every(id => c.sourceIds.includes(o.coverage.find(t => t.id === id).sourceId)), 'Os tópicos do capítulo não correspondem às suas fontes.');
    chapters.add(c.id); c.topicIds.forEach(id => covered.add(id));
  });
  check([...topics].every(id => covered.has(id)), 'Existem conceitos sem capítulo no plano.');
  return o;
}
export function validateQuestion(q) {
  check(q && text(q.prompt) && strings(q.options, 4, 4) && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4 && strings(q.rationales, 4, 4) && text(q.hint) && text(q.skill), 'Exercício sem alternativas, justificativas ou objetivo de aprendizagem.');
  return q;
}
export function validateChapter(c, outlineChapter) {
  check(c && c.id === outlineChapter.id && text(c.title) && Array.isArray(c.scenes) && c.scenes.length >= 5 && c.scenes.length <= 10, 'A aula precisa desenvolver de 5 a 10 cenas.');
  check(c.scenes.some(s => s.role === 'worked-example') && c.scenes.some(s => s.role === 'application'), 'A aula precisa de exemplo resolvido e aplicação.');
  let narrationWords = 0, checkpointCount = 0;
  const covered = new Set();
  c.scenes.forEach((s, si) => {
    check(s && text(s.title, 160) && ['concept','worked-example','application','recap'].includes(s.role) && strings(s.sourceIds, 1, 30) && s.sourceIds.every(id => outlineChapter.sourceIds.includes(id)), 'Cena sem fonte válida.');
    check(strings(s.topicIds, 1, 48) && s.topicIds.every(id => outlineChapter.topicIds.includes(id)), 'Cena sem vínculo com os conceitos do capítulo.');
    s.topicIds.forEach(id => covered.add(id));
    const v = s.visual;
    check(v && ['process','comparison','equation','bars','timeline','concept','fraction'].includes(v.kind) && Array.isArray(v.items) && v.items.length >= 2 && v.items.length <= 5, 'Cena sem esquema visual utilizável.');
    const ids = new Set();
    v.items.forEach(it => {
      check(it && text(it.id, 40) && !ids.has(it.id) && text(it.label, 100) && typeof it.detail === 'string' && it.detail.length <= 220, 'Elemento visual inválido.'); ids.add(it.id);
      if (v.kind === 'bars') check(Number.isFinite(it.value) && it.value >= 0, 'Gráfico com valor inválido.');
      if (v.kind === 'fraction') check(Number.isInteger(it.value) && Number.isInteger(it.total) && it.total >= 1 && it.total <= 24 && it.value >= 0 && it.value <= it.total, 'Representação de fração inválida.');
    });
    check(Array.isArray(s.beats) && s.beats.length >= 3 && s.beats.length <= 6, 'Cena sem desenvolvimento em etapas.');
    s.beats.forEach(b => {
      check(b && text(b.narration, 2400) && strings(b.focus, 1, 5) && b.focus.every(id => ids.has(id)) && text(b.caption, 200), 'Trecho sem narração ou destaque visual.');
      const words = b.narration.trim().split(/\s+/).length;
      check(words >= 25, 'A narração está curta demais para ensinar o conceito.'); narrationWords += words;
    });
    check([...ids].every(id => s.beats.some(b => b.focus.includes(id))), 'Há elementos visuais que não são explicados pela narração.');
    if (s.checkpoint != null) { validateQuestion(s.checkpoint); checkpointCount++; }
    if ((si + 1) % 3 === 0 || si === c.scenes.length - 1) check(s.checkpoint != null, 'Falta uma pausa de compreensão entre as cenas.');
  });
  check(outlineChapter.topicIds.every(id => covered.has(id)), 'Um conceito planejado ficou fora desta aula.');
  check(narrationWords >= 650 && checkpointCount >= 2, `A aula contém ${narrationWords} palavras de narração e ${checkpointCount} pausas. Precisa de ao menos 650 palavras e duas pausas. Amplie as explicações, sem remover partes corretas.`);
  const task = c.practice;
  check(task && text(task.scenario) && text(task.prompt) && strings(task.criteria, 3, 6) && text(task.modelAnswer, 5000) && task.modelAnswer.length >= 150, 'Falta um estudo de caso com critérios e resolução comentada.');
  check(Array.isArray(c.quiz) && c.quiz.length >= 4 && c.quiz.length <= 8, 'Falta o simulado do capítulo.');
  c.quiz.forEach(q=>{validateQuestion(q);validateAssessment(q);});
  return { ...c, estimatedMinutes: Math.max(1, Math.round(narrationWords / 135)) };
}
function validateAssessment(q) {
  check(text(q.scenario)&&q.scenario.length>=80&&['apply','analyze','evaluate'].includes(q.cognitiveLevel),'O simulado precisa de situações-problema com scenario de pelo menos 100 caracteres e cognitiveLevel apply, analyze ou evaluate. Não aceite perguntas de mera definição.');
}
export function validateFinalExam(exam, outline) {
  check(exam && Array.isArray(exam.questions) && exam.questions.length >= Math.max(8, outline.chapters.length) && exam.questions.length <= 16, 'O simulado final precisa avaliar todos os capítulos.');
  exam.questions.forEach(q => { validateQuestion(q); validateAssessment(q); check(outline.chapters.some(c => c.id === q.chapterId), 'Questão final sem capítulo de origem.'); });
  check(outline.chapters.every(c => exam.questions.some(q => q.chapterId === c.id)), 'Um capítulo ficou fora do simulado final.');
  return exam;
}
export function grade(questions, answers) {
  const score = questions.reduce((n, q, i) => n + (answers[i] === q.correct ? 1 : 0), 0);
  return { score, total: questions.length, percent: Math.round(100 * score / questions.length) };
}
export function isCourse(v) { return Boolean(v && v.kind === 'course' && v.version === COURSE_VERSION && typeof v.id === 'string' && v.outline && Array.isArray(v.outline.chapters) && v.chapters && typeof v.chapters === 'object'); }
