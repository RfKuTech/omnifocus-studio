export function youtubeId(value) {
  try {
    const u = new URL(value);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(u.hostname)) return null;
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.split('/')[2];
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
export function validateLesson(data, videoIds = []) {
  const question = q => q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.trim()) && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4 && typeof q.explanation === 'string';
  if (!Array.isArray(data.steps) || data.steps.length < 4 || data.steps.length > 12 || !Array.isArray(data.exam) || data.exam.length < 4 || data.exam.length > 12) throw new Error('A IA não devolveu uma aula e um simulado completos.');
  for (const s of data.steps) {
    if (!question(s) || typeof s.summary !== 'string' || !s.summary.trim() || typeof s.narration !== 'string' || !s.narration.trim() || typeof s.heading !== 'string' || !Array.isArray(s.bullets) || !s.bullets.length || !s.bullets.every(b => typeof b === 'string') || typeof s.lifeTask !== 'string') throw new Error('Uma etapa da aula veio incompleta.');
    if (s.video != null && (!videoIds.includes(s.video.id) || !Number.isFinite(s.video.start) || !Number.isFinite(s.video.end) || s.video.start < 0 || s.video.end <= s.video.start)) throw new Error('Trecho de vídeo inválido.');
  }
  if (!data.exam.every(question)) throw new Error('Simulado inválido.');
  return data;
}
