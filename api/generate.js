// api/generate.js — Vercel Serverless Function para OmniFocus Studio

export default async function handler(req, res) {
  // 1. Configuração de Cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Responde imediatamente a requisições preflight do navegador
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas o método POST é permitido.' });
  }

  try {
    const { title, content, youtubeUrl } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: 'O título da aula é obrigatório.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Se não houver chave configurada, utiliza o gerador de fallback interno
    if (!apiKey) {
      console.warn('GEMINI_API_KEY não configurada nas variáveis de ambiente. Usando gerador estruturado de contingência...');
      return res.status(200).json(generateFallbackLesson(title, content));
    }

    // 2. Construção do Prompt para o Modelo Gemini
    const systemPrompt = `Você é um tutor especialista em criação de conteúdo educacional gamificado para o OmniFocus Studio.
Sua missão é transformar materiais de estudo (textos, extratos de PDFs e links de vídeos) em um módulo interativo estruturado em formato JSON estrito.

Retorne APENAS um objeto JSON válido (sem texto explicativo antes ou depois, sem marcas de markdown do tipo \`\`\`json) com a seguinte estrutura:

{
  "steps": [
    {
      "summary": "Um resumo claro, dinâmico e didático do tópico atual (ideal para slides/narração por voz).",
      "question": "Pergunta de múltipla escolha focada no conceito chave do tópico.",
      "options": [
        "Opção 1 (Correta ou incorreta)",
        "Opção 2",
        "Opção 3"
      ],
      "correct": 0,
      "explanation": "Explicação detalhada e motivadora sobre por que a opção correta é a certa.",
      "lifeTask": "Missão prática do Módulo de Vida: Uma tarefa do mundo real aplicável hoje pelo estudante para praticar este conceito."
    }
  ]
}

REGRAS:
- Crie entre 4 a 6 etapas/tópicos concisos baseados no material.
- O campo "correct" deve ser o índice numérico (0, 1 ou 2) da alternativa correta.
- O "lifeTask" deve ser prático, realista e acionável.`;

    const userPrompt = `Título da Aula: ${title}
${youtubeUrl ? `Link do Vídeo do YouTube: ${youtubeUrl}\n` : ''}
Conteúdo do Material/PDFs:
${content || 'Gere conceitos fundamentais com base no título da aula.'}`;

    // 3. Chamada à API REST do Google Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n--- DADOS DA AULA ---\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 2048
        }
      })
    });

    if (!apiResponse.ok) {
      console.error('Erro na resposta da API Gemini:', await apiResponse.text());
      return res.status(200).json(generateFallbackLesson(title, content));
    }

    const data = await apiResponse.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpeza de marcações markdown
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsedJson = JSON.parse(rawText);

    if (parsedJson && Array.isArray(parsedJson.steps)) {
      return res.status(200).json(parsedJson);
    } else {
      return res.status(200).json(generateFallbackLesson(title, content));
    }

  } catch (error) {
    console.error('Erro ao processar requisição em generate.js:', error);
    return res.status(200).json(generateFallbackLesson(req.body?.title || 'Aula Interativa', req.body?.content || ''));
  }
}

// Gerador de contingência quando a API falha ou está sem chave
function generateFallbackLesson(title, content) {
  const snippets = (content || '')
    .split('\n')
    .filter(line => line.trim().length > 30)
    .slice(0, 5);

  const steps = [];
  const total = Math.max(4, snippets.length);

  for (let i = 0; i < total; i++) {
    const snippet = snippets[i] || `Conceito fundamental número ${i + 1} sobre ${title}`;
    steps.push({
      summary: `Resumo do Tópico ${i + 1}: ${snippet.substring(0, 140)}...`,
      question: `[Questão ${i + 1} - ${title}] Com base no material analisado, assinale a opção correta:`,
      options: [
        `Aplicação prática recomendada: ${snippet.substring(0, 75)}...`,
        `Conceito obsoleto sem relevância prática para os sistemas atuais.`,
        `Ação que desrespeita as diretrizes e regras de segurança estudadas.`
      ],
      correct: 0,
      explanation: `Exato! O conceito estudado reforça a importância de aplicar este conhecimento de forma correta.`,
      lifeTask: `Missão do Módulo de Vida: Crie um plano de ação simples de 1 dia para testar ou observar o conceito de "${title}" no seu dia a dia.`
    });
  }

  return { steps };
}
