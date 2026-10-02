import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Permite comunicação entre o frontend e a API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { title, content, youtubeUrl } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: 'Envie o título e o conteúdo da matéria.' });
  }

  // A Vercel procura esta chave nas variáveis de ambiente (precisa de redeploy ao alterar)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API do Gemini não configurada na Vercel (GEMINI_API_KEY).' });
  }

  const hasVideo = Boolean(youtubeUrl);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // gemini-1.5-flash foi descontinuado
      generationConfig: {
        responseMimeType: "application/json", // garante JSON puro, sem markdown
        temperature: 0.7
      }
    });

    const prompt = `
Você é o DopaMind, um assistente educacional gamificado para alunos com TDAH.
Crie um módulo interativo sobre: "${title}".
Conteúdo base: "${String(content).substring(0, 15000)}".

O usuário forneceu um link de vídeo? ${hasVideo ? 'SIM' : 'NÃO'}.

INSTRUÇÕES CRÍTICAS:
- Retorne ESTRITAMENTE um JSON estruturado. Nada de texto antes ou depois.
- Gere entre 3 e 5 passos (steps).
- Cada passo tem exatamente 4 opções em "options".
- "correct" é o ÍNDICE da opção correta, começando em 0 (valores possíveis: 0, 1, 2 ou 3).
- Se TIVER vídeo (SIM), "time" é um número em segundos (ex: 60, 120, 180) e "slideText" pode ser vazio.
- Se NÃO TIVER vídeo (NÃO), "time" deve ser null e "slideText" deve ter um texto dinâmico, curto (máx. 200 caracteres) e estimulante, que será lido em voz alta.
- Escreva tudo em português do Brasil.

Formato OBRIGATÓRIO do JSON:
{
  "steps": [
    {
      "time": 60,
      "slideText": "Texto do slide aqui (se não houver vídeo)",
      "question": "Pergunta objetiva, direta e estimulante?",
      "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
      "correct": 0,
      "explanation": "Mandou bem! Explicação rápida e encorajadora.",
      "lifeTask": "Desafio prático de 2 min."
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    // Segurança extra, caso venha com cercas de markdown
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Validação do formato antes de enviar ao frontend
    if (!Array.isArray(data.steps) || data.steps.length === 0) {
      throw new Error('A IA não devolveu o campo "steps".');
    }

    data.steps.forEach((s, i) => {
      const okOptions = Array.isArray(s.options) && s.options.length >= 2;
      const okCorrect = Number.isInteger(s.correct) && s.correct >= 0 && s.correct < (s.options || []).length;
      if (!s.question || !okOptions || !okCorrect) {
        throw new Error(`Passo ${i + 1} veio com formato inválido. Tente gerar de novo.`);
      }
    });

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro na API DopaMind:", error);
    return res.status(500).json({ error: error.message || 'Falha ao processar conteúdo na IA.' });
  }
}
