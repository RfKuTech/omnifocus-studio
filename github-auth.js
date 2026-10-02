// Salvar em api/github-auth.js (mesma pasta do generate.js).
// Variáveis na Vercel: GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET (depois, Redeploy).
// O Client Secret NUNCA deve ir para o index.html.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://omnifocus-studio.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  // GET: o front pergunta se o login GitHub está configurado (o Client ID é público)
  if (req.method === 'GET') {
    return res.status(200).json({ clientId: clientId && clientSecret ? clientId : null });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Login GitHub não configurado na Vercel.' });
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Código de autorização ausente.' });
  }

  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    const data = await r.json();

    if (!data.access_token) {
      return res.status(400).json({ error: data.error_description || 'O GitHub não devolveu o token.' });
    }
    return res.status(200).json({ access_token: data.access_token });
  } catch (error) {
    console.error('Erro no login GitHub:', error);
    return res.status(500).json({ error: 'Falha ao falar com o GitHub.' });
  }
}
