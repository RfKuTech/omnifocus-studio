/* Aula visual narrada: as perguntas são liberadas ao fim de cada cena. */
const lessonPlayer = (() => {
  let generation = 0, ready = false, phase = 'idle', player = null, poll = null, current = null, sceneKey = '';
  const el = id => document.getElementById(id);
  function stop() {
    generation++; clearInterval(poll); poll = null;
    window.speechSynthesis?.cancel();
    player?.destroy?.(); player = null;
    phase = 'idle'; sceneKey = '';
  }
  function unlock() {
    phase = 'quiz';
    el('questionContainer').classList.remove('hidden');
    el('btnNextStep').disabled = false;
    el('sceneStatus').textContent = 'Pausa para o questionário. Responda para avançar.';
  }
  function youtubeAPI() {
    if (window.YT?.Player) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api';
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
      script.onerror = () => reject(new Error('Player indisponível.'));
      document.head.append(script);
      setTimeout(() => { if (!window.YT?.Player) reject(new Error('Player demorou para carregar.')); }, 15000);
    });
  }
  async function clip(token) {
    if (!current.video) return unlock();
    phase = 'clip';
    el('sceneStatus').textContent = 'Assista ao trecho complementar; o vídeo pausará para a pergunta.';
    try {
      await youtubeAPI(); if (token !== generation) return;
      el('ytPlayerWrapper').classList.remove('hidden');
      const wrapper = el('ytPlayerWrapper'); wrapper.replaceChildren();
      const node = document.createElement('div'); node.id = 'lessonYoutube'; wrapper.append(node);
      player = new YT.Player(node, { width: '100%', height: '100%', videoId: current.video.id,
        playerVars: { origin: location.origin, start: Math.floor(current.video.start), end: Math.ceil(current.video.end), autoplay: 1 },
        events: {
          onReady: e => { if (token === generation) e.target.playVideo(); },
          onStateChange: e => { if (token === generation && e.data === YT.PlayerState.ENDED) { clearInterval(poll); unlock(); } },
          onError: () => { if (token === generation) { el('sceneStatus').textContent = 'Trecho indisponível. Continue pela explicação da aula.'; unlock(); } }
        }
      });
      poll = setInterval(() => {
        if (token !== generation) return;
        if (player?.getCurrentTime?.() >= current.video.end) { player.pauseVideo(); clearInterval(poll); unlock(); }
      }, 250);
    } catch { if (token === generation) unlock(); }
  }
  function play() {
    if (phase === 'paused') {
      if (player) player.playVideo(); else window.speechSynthesis?.resume();
      phase = player ? 'clip' : 'narrating'; return;
    }
    if (phase === 'narrating' || phase === 'clip') {
      player?.pauseVideo?.(); window.speechSynthesis?.pause(); phase = 'paused'; return;
    }
    const token = generation;
    phase = 'narrating';
    el('sceneStatus').textContent = 'Explicação em andamento. Clique novamente para pausar.';
    if (!window.speechSynthesis) { el('sceneStatus').textContent = 'Voz indisponível. Leia os slides e clique em “Terminei de ler”.'; return; }
    const speech = new SpeechSynthesisUtterance(current.narration || current.summary);
    speech.lang = 'pt-BR'; speech.rate = 1;
    speech.onend = () => { if (token === generation) clip(token); };
    speech.onerror = () => { if (token === generation) el('sceneStatus').textContent = 'Não foi possível reproduzir a voz. Leia e clique em “Terminei de ler”.'; };
    window.speechSynthesis.speak(speech);
  }
  function render(step) {
    const key = `${state.currentLesson.title}:${state.mode}:${state.currentStep}`;
    if (sceneKey === key) return;
    stop(); sceneKey = key; current = step;
    let card = el('narratedScene');
    if (!card) {
      card = document.createElement('div'); card.id = 'narratedScene'; card.className = 'space-y-4 bg-slate-900 rounded-xl p-5 mb-4';
      card.innerHTML = '<h3 id="sceneHeading" class="text-xl font-bold text-brand-400"></h3><ul id="sceneBullets" class="list-disc pl-5 space-y-2 text-sm"></ul><p id="sceneNarration" class="text-xs text-slate-300 whitespace-pre-line"></p><div class="flex gap-3"><button id="scenePlay" class="rounded-lg bg-emerald-600 p-2 text-xs">▶ Reproduzir / Pausar</button><button id="sceneRead" class="rounded-lg bg-slate-700 p-2 text-xs">Terminei de ler</button></div><p id="sceneStatus" class="text-xs text-slate-400"></p><button id="sceneExam" class="hidden rounded-lg bg-amber-500 p-2 text-xs text-black">Fazer simulado final</button>';
      el('playerContainer').prepend(card);
      el('scenePlay').onclick = play;
      el('sceneRead').onclick = () => { generation++; clearInterval(poll); player?.destroy?.(); player = null; window.speechSynthesis?.cancel(); clip(generation); };
      el('sceneExam').onclick = () => { const lesson = state.currentLesson.originalLesson || state.currentLesson; el('learningMode').value = 'exam'; startLesson(lesson); };
    }
    el('scenePlay').disabled = false; el('sceneRead').disabled = false;
    const video = state.mode === 'video';
    card.classList.toggle('hidden', !video);
    el('ytPlayerWrapper').classList.add('hidden');
    el('questionContainer').classList.toggle('hidden', video && !state.answeredSteps.has(state.currentStep));
    el('summaryCard').classList.toggle('hidden', video || state.mode === 'exam');
    el('btnNextStep').disabled = video && !state.answeredSteps.has(state.currentStep);
    el('sceneExam').classList.toggle('hidden', !state.currentLesson.exam?.length);
    el('sceneHeading').textContent = step.heading || 'Aula narrada';
    el('sceneNarration').textContent = step.narration || step.summary || '';
    el('sceneBullets').replaceChildren(...(step.bullets || [step.summary]).filter(Boolean).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    el('sceneStatus').textContent = 'Clique em reproduzir para começar. A aula pausa para uma pergunta ao fim de cada etapa.';
    if (!video || state.answeredSteps.has(state.currentStep)) phase = 'quiz';
    else phase = 'idle';
  }
  return { render, stop, canAnswer: () => phase === 'quiz' };
})();
