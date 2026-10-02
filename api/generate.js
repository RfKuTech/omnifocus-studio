import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Permite comunicação entre o frontend e a API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { title, content, youtubeUrl } = req.body;
  
  // A Vercel vai procurar esta chave nas variáveis de ambiente
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chave da API do Gemini não configurada na Vercel.' });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt engenhoso para formatar a resposta para o TDAH
    const prompt = `
    Você é o DopaMind, um assistente educacional gamificado para alunos com TDAH.
    Crie um módulo interativo sobre: "${title}".
    Conteúdo base: "${content.substring(0, 15000)}".
    
    O usuário forneceu um link de vídeo? ${youtubeUrl ? 'SIM' : 'NÃO'}.
    
    INSTRUÇÕES CRÍTICAS:
    - Retorne ESTRITAMENTE um arquivo JSON estruturado. Nada de texto antes ou depois.
    - Gere entre 3 a 5 passos (steps).
    - Se TIVER vídeo (SIM), defina o campo "time" com o momento em segundos (ex: 60, 120, 180) em que o vídeo deve ser pausado para a pergunta. O campo "slideText" pode ser vazio.
    - Se NÃO TIVER vídeo (NÃO), o campo "time" deve ser null, mas preencha o campo "slideText" com um texto dinâmico, curto (máx 200 caracteres) e estimulante que será lido em voz alta pelo sistema.
    
    Formato OBRIGATÓRIO do JSON:
    {
      "steps": [
        {
          "time": 60,
          "slideText": "Texto do slide aqui (se não houver vídeo)",
          "question": "Pergunta objetiva, direta e estimulante?",
          "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
          "correct": 1,
          "explanation": "Mandou bem! Explicação rápida e encorajadora.",
          "lifeTask": "Desafio prático de 2 min."
        }
      ]
    }
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Limpa a formatação markdown para garantir que o JSON é lido corretamente
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(responseText);
    res.status(200).json(data);

  } catch (error) {
    console.error("Erro na API DopaMind:", error);
    res.status(500).json({ error: 'Falha ao processar conteúdo na IA.' });
  }
}
