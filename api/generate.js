// api/generate.js — Vercel Serverless Function (Secured & Hardened)

export default async function handler(req, res) {
  // 1. Política de CORS Restritiva (Prevenção contra API Hijacking)
  const allowedOrigins = [
    'https://omnifocus-studio.vercel.app',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Permite em desenvolvimento, restringe em origens desconhecidas
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { title, content, youtubeUrl } = req.body || {};

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'O título da aula é obrigatório e deve ser texto válido.' });
    }

    // Sanitização básica do tamanho do conteúdo (Prevenção de DoS por Payload Gigante)
    const sanitizedContent = (content || '').substring(0, 50000);

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY não configurada. Executando gerador dinâmico seguro...');
      return res.status(200).json(generateFallbackLesson(title, sanitizedContent));
    }

    const systemPrompt = `Você é um tutor especialista em criação de conteúdo educacional gamificado para o OmniFocus Studio.
Transforme os materiais fornecidos em um módulo interativo estruturado em formato JSON estrito.

Retorne APENAS um objeto JSON válido (sem textos introdutórios ou marcadores de código como \`\`\`json) com a seguinte estrutura exata:

{
  "steps": [
    {
      "summary": "Resumo explicativo e didático do tópico.",
      "question": "Pergunta de múltipla escolha sobre o conceito chave.",
      "options": [
        "Opção 1",
        "Opção 2",
        "Opção 3"
      ],
      "correct": 0,
      "explanation": "Explicação detalhada sobre a alternativa correta.",
      "lifeTask": "Missão prática e real aplicável hoje pelo aluno."
    }
  ]
}

REGRAS:
- Crie de 4 a 6 etapas baseadas no material.
- O campo "correct" deve ser um inteiro (0, 1 ou 2).
- Garanta que a saída seja um JSON puro legível.`;

    const userPrompt = `Título da Aula: ${title}
${youtubeUrl ? `Link do Vídeo: ${youtubeUrl}\n` : ''}
Conteúdo do Material:
${sanitizedContent || 'Gere conceitos fundamentais com base no título da aula.'}`;

    // Endpoint atualizado do Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // Timeout de 12s para a Vercel

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n--- DADOS ---\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 2048
        }
      })
    });

    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      console.error('Erro na API externa. Acionando Fallback...');
      return res.status(200).json(generateFallbackLesson(title, sanitizedContent));
    }

    const data = await apiResponse.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpeza rigorosa de Markdown / JSON inválido
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      const parsedJson = JSON.parse(rawText);
      if (parsedJson && Array.isArray(parsedJson.steps) && parsedJson.steps.length > 0) {
        return res.status(200).json(parsedJson);
      }
    } catch (parseError) {
      console.error('Falha de Parse JSON no retorno da IA.');
    }

    return res.status(200).json(generateFallbackLesson(title, sanitizedContent));

  } catch (error) {
    console.error('Erro no handler Serverless:', error);
    return res.status(200).json(generateFallbackLesson(req.body?.title || 'Aula Interativa', req.body?.content || ''));
  }
}

function generateFallbackLesson(title, content) {
  const snippets = (content || '')
    .split('\n')
    .filter(line => line.trim().length > 20)
    .slice(0, 5);

  const steps = [];
  const total = Math.max(4, snippets.length);

  for (let i = 0; i < total; i++) {
    const snippet = snippets[i] || `Conceito chave sobre ${title}`;
    steps.push({
      summary: `Resumo do Tópico ${i + 1}: ${snippet.substring(0, 140)}...`,
      question: `[Questão ${i + 1}] Com base nos estudos de ${title}, assinale a afirmativa correta:`,
      options: [
        `Aplicação prática recomendada: ${snippet.substring(0, 75)}...`,
        `Conceito incompatível com as regras de segurança aplicadas.`,
        `Procedimento descontinuado segundo as boas práticas do setor.`
      ],
      correct: 0,
      explanation: `Exato! A primeira alternativa reflete a correta aplicação técnica do conceito.`,
      lifeTask: `Missão do Módulo de Vida: Crie um checklist de 1 dia para observar ou aplicar este conceito no seu cotidiano.`
    });
  }

  return { steps };
}
