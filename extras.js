/* DopaMind extras — carregar DEPOIS do script principal, logo antes de </body>:
   <script src="extras.js"></script>
   Adiciona o que faltava (cronômetro, PDF, voz) e corrige erros do index.html v3.7 */

// ---------- 1) Cores que faltavam no tailwind.config ----------
const dmStyle = document.createElement('style');
dmStyle.textContent =
  '.bg-brand-950\\/90{background-color:rgba(2,44,34,.9)}' +
  '.bg-brand-950\\/40{background-color:rgba(2,44,34,.4)}' +
  '.text-brand-200{color:#a7f3d0}.text-brand-300{color:#6ee7b7}';
document.head.appendChild(dmStyle);

// ---------- 2) Cronômetro do simulado (funções que eram chamadas mas não existiam) ----------
function stopExamTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  const badge = document.getElementById('timerBadge');
  badge.classList.add('hidden');
  badge.classList.remove('flex');
}

function dmRenderTimer() {
  const m = String(Math.floor(state.timeLeft / 60)).padStart(2, '0');
  const s = String(state.timeLeft % 60).padStart(2, '0');
  safeSetText('timerDisplay', `${m}:${s}`);
}

function startExamTimer() {
  stopExamTimer();
  state.timeLeft = 600; // 10 minutos
  const badge = document.getElementById('timerBadge');
  badge.classList.remove('hidden');
  badge.classList.add('flex');
  dmRenderTimer();

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    dmRenderTimer();
    if (state.timeLeft <= 0) {
      stopExamTimer();
      showToast('Tempo esgotado! Simulado entregue.', 'error');
      if (state.currentLesson) {
        state.currentStep = state.currentLesson.steps.length;
        finishExamModule();
      }
    }
  }, 1000);
}

// ---------- 3) Botão "Ouvir DopaMind" ----------
function dmStopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  state.isSpeaking = false;
  safeSetText('ttsIcon', '🔊');
  safeSetText('ttsText', 'Ouvir DopaMind');
}

document.getElementById('btnTTS').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) {
    return showToast('Seu navegador não suporta leitura em voz alta.', 'error');
  }
  if (state.isSpeaking) return dmStopSpeech();

  const text = document.getElementById('summaryText').textContent.trim();
  if (!text) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'pt-BR';
  utter.rate = 1.05;
  utter.onend = utter.onerror = dmStopSpeech;
  state.speechUtterance = utter;
  state.isSpeaking = true;
  safeSetText('ttsIcon', '⏹️');
  safeSetText('ttsText', 'Parar');
  window.speechSynthesis.speak(utter);
});

// Para a leitura ao trocar de etapa
const dmOrigRender = renderCurrentStep;
renderCurrentStep = function () {
  dmStopSpeech();
  return dmOrigRender.apply(this, arguments);
};

// ---------- 4) Botão "PDF" ----------
document.getElementById('btnExportPDF').addEventListener('click', () => {
  const lesson = state.currentLesson;
  if (!lesson) return showToast('Crie ou carregue uma aula antes de exportar.', 'error');
  if (typeof html2pdf === 'undefined') {
    return showToast('A biblioteca de PDF não carregou. Recarregue a página.', 'error');
  }

  const el = document.createElement('div');
  el.style.cssText = 'font-family:Arial,sans-serif;color:#111;background:#fff;padding:24px;width:680px;line-height:1.5;font-size:13px';
  const add = (tag, text, css) => {
    const n = document.createElement(tag);
    n.textContent = text;
    if (css) n.style.cssText = css;
    el.appendChild(n);
  };

  add('h1', `DopaMind — ${lesson.title}`, 'font-size:22px;margin:0 0 16px');
  lesson.steps.forEach((s, i) => {
    add('h2', `Etapa ${i + 1}`, 'font-size:16px;margin:18px 0 6px;color:#047857');
    if (s.summary) add('p', s.summary, 'margin:0 0 6px');
    add('p', s.question, 'font-weight:bold;margin:0 0 4px');
    (s.options || []).forEach((o, j) => {
      const right = j === s.correct;
      add('p', `${right ? '✔' : '○'} ${j + 1}. ${o}`,
        `margin:0 0 2px 12px;${right ? 'font-weight:bold;color:#047857' : ''}`);
    });
    if (s.explanation) add('p', `Explicação: ${s.explanation}`, 'margin:6px 0 0;font-style:italic');
    if (s.lifeTask) add('p', `Missão prática: ${s.lifeTask}`, 'margin:4px 0 0');
  });

  const safeName = lesson.title.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'aula';
  html2pdf()
    .set({
      margin: 10,
      filename: `DopaMind_${safeName}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4' }
    })
    .from(el)
    .save()
    .then(() => showToast('PDF exportado!', 'success'))
    .catch(() => showToast('Não foi possível gerar o PDF.', 'error'));
});

// ---------- 5) Erro real do servidor (sem aula falsa de contingência) ----------
generateLessonViaServerless = async function (title, content, youtubeUrl) {
  try {
    const res = await fetch(state.apiServerlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, youtubeUrl })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status} no servidor.`);
    if (!Array.isArray(data.steps) || !data.steps.length) {
      throw new Error('A IA não devolveu passos válidos. Tente de novo.');
    }
    return data;
  } catch (err) {
    console.error('Erro ao gerar aula:', err);
    showToast(
      err instanceof TypeError ? 'Sem conexão com o servidor (confira a URL da Vercel).' : err.message,
      'error'
    );
    return null;
  }
};

// ---------- 6) Sem XP infinito no modo estudo ----------
const dmAnswered = new WeakMap(); // aula -> etapas já acertadas

const dmOrigSelect = handleOptionSelect;
handleOptionSelect = function (selected, correct, explanation) {
  const lesson = state.currentLesson;
  if (state.mode !== 'exam' && lesson) {
    let done = dmAnswered.get(lesson);
    if (!done) { done = new Set(); dmAnswered.set(lesson, done); }
    if (done.has(state.currentStep)) {
      return showToast('Você já acertou esta etapa. Avance! 🎉', 'success');
    }
    if (selected === correct) done.add(state.currentStep);
  }
  return dmOrigSelect(selected, correct, explanation);
};

// Reiniciar módulo ou recarregar aula da biblioteca libera as etapas de novo
const dmOrigComplete = renderModuleCompletion;
renderModuleCompletion = function () {
  dmAnswered.delete(state.currentLesson);
  return dmOrigComplete();
};

const dmOrigLoad = loadLessonFromLibrary;
loadLessonFromLibrary = function (index) {
  dmAnswered.delete(state.library[index]);
  return dmOrigLoad(index);
};
