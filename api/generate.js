export default async function handler(req, res) {
  // Permite requisições do seu aplicativo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { title, content } = req.body;
    // Pega a chave secreta guardada nas variáveis de ambiente
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Chave do Gemini não configurada no servidor." });
    }

    const cleanContent = (content || '').replace(/[\r\n]+/g, " ").substring(0, 12000);

    const prompt = `Você é o tutor da plataforma OmniFocus Studio. Analise este material (${title}) e crie um módulo de estudos gamificado.
    Retorne APENAS um JSON estrito no formato abaixo, sem formatação markdown:
    {
      "steps": [
        {
          "summary": "Resumo explicativo curto do conceito para o aluno ler antes de responder.",
          "question": "Pergunta prática sobre o conceito?",
          "options": ["Opção correta", "Opção incorreta 1", "Opção incorreta 2"],
          "correct": 0,
          "explanation": "Explicação pedagógica e encorajadora do motivo do acerto."
        }
      ]
    }
    Conteúdo: ${cleanContent}`;

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await apiResponse.json();
    
    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
      return res.status(500).json({ error: "Resposta inválida da IA." });
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = JSON.parse(rawText.replace(/```json|```/g, "").trim());

    return res.status(200).json(cleanJson);
  } catch (error) {
    return res.status(500).json({ error: "Falha ao processar material com IA." });
  }
}
