export default async function handler(req, res) {
  const origins = (process.env.APP_ORIGINS || 'https://omnifocus-studio.vercel.app,https://rfkutech.github.io').split(',').map(x => x.trim());
  const origin = req.headers.origin;
  if (origin && !origins.includes(origin)) return res.status(403).json({ error: 'Origem não autorizada.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const clientId = process.env.GITHUB_CLIENT_ID, clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (req.method === 'GET') return res.status(200).json({ clientId: clientId && clientSecret ? clientId : null });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!clientId || !clientSecret) return res.status(503).json({ error: 'Login GitHub não configurado no servidor.' });
  const { code, codeVerifier, redirectUri } = req.body || {};
  let redirect;
  try { redirect = new URL(redirectUri); } catch {}
  if (typeof code !== 'string' || !code || !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier || '') || !redirect || !origins.includes(redirect.origin)) {
    return res.status(400).json({ error: 'Autorização inválida.' });
  }
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) return res.status(400).json({ error: 'GitHub recusou a autorização. Entre novamente.' });
    if (!(data.scope || '').split(/[ ,]+/).includes('gist')) return res.status(403).json({ error: 'Autorize a permissão de Gist para salvar suas aulas.' });
    return res.status(200).json({ access_token: data.access_token });
  } catch { return res.status(502).json({ error: 'Falha ao conectar ao GitHub.' }); }
}
