import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Permite comunicação entre o frontend (GitHub) e esta API (Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { title, content, youtubeUrl } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: 'Envie o título e o conteúdo da matéria.' });
  }

  // Precisa de redeploy na Vercel sempre que a chave for alterada
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave GEMINI_API_KEY não configurada na Vercel.' });
  }

  const hasVideo = Boolean(youtubeUrl);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // gemini-1.5-flash foi descontinuado
      generationConfig: {
        responseMimeType: "application/json", // JSON puro, sem markdown
        temperature: 0.7
      }
    });

    const prompt = `
Você é o DopaMind, um assistente educacional gamificado para alunos com TDAH.
Crie um módulo interativo sobre: "${title}".
Conteúdo base: "${String(content).substring(0, 15000)}".
${hasVideo ? 'O aluno também assiste a um vídeo sobre o tema. Baseie tudo no conteúdo base acima.' : ''}

INSTRUÇÕES CRÍTICAS:
- Retorne ESTRITAMENTE um JSON. Nada de texto antes ou depois.
- Gere entre 4 e 5 passos (steps).
- "summary": pílula de estudo curta (máx. 250 caracteres), clara e estimulante, que será lida em voz alta.
- "question": pergunta objetiva e direta sobre a pílula.
- "options": exatamente 4 opções.
- "correct": ÍNDICE da opção correta, começando em 0 (valores possíveis: 0, 1, 2 ou 3).
- "explanation": explicação rápida e encorajadora (máx. 200 caracteres).
- "lifeTask": missão prática de 2 minutos ligada ao conceito.
- Escreva tudo em português do Brasil.

Formato OBRIGATÓRIO do JSON:
{
  "steps": [
    {
      "summary": "Pílula de estudo aqui.",
      "question": "Pergunta objetiva?",
      "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
      "correct": 0,
      "explanation": "Mandou bem! Explicação rápida.",
      "lifeTask": "Missão prática de 2 min."
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    // Segurança extra, caso venha com cercas de markdown
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim());

    if (!Array.isArray(data.steps) || data.steps.length === 0) {
      throw new Error('A IA não devolveu o campo "steps".');
    }

    data.steps.forEach((s, i) => {
      const okOptions = Array.isArray(s.options) && s.options.length >= 2;
      const okCorrect = Number.isInteger(s.correct) && s.correct >= 0 && s.correct < (s.options || []).length;
      if (!s.question || !okOptions || !okCorrect) {
        throw new Error(`Passo ${i + 1} veio com formato inválido. Tente gerar de novo.`);
      }
      s.summary = String(s.summary || '');
      s.explanation = String(s.explanation || '');
      s.lifeTask = String(s.lifeTask || '');
    });

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro na API DopaMind:", error);
    return res.status(500).json({ error: error.message || 'Falha ao processar conteúdo na IA.' });
  }
}
