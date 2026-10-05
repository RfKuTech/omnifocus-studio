// Only expose fixed messages and allowlisted codes, never provider text, keys or source material.
export function geminiFailure(httpStatus, payload) {
  const error = payload?.error || {};
  const reasons = Array.isArray(error.details) ? error.details.map(d => d?.reason) : [];
  const message = typeof error.message === 'string' ? error.message : '';
  let code = 'GEMINI_UNAVAILABLE', status = 502;
  let text = 'O serviço de IA está indisponível. Tente novamente em alguns instantes.';
  if (reasons.includes('API_KEY_INVALID') || /api key not valid|invalid api key|api key expired/i.test(message)) {
    code = 'GEMINI_KEY_INVALID'; status = 503;
    text = 'A chave da IA foi recusada pelo Google. Atualize GEMINI_API_KEY na Vercel com uma chave válida do Google AI Studio e faça Redeploy.';
  } else if (/reported as leaked|leaked api key/i.test(message)) {
    code = 'GEMINI_KEY_BLOCKED'; status = 503;
    text = 'O Google bloqueou a chave da IA por exposição. Gere outra no Google AI Studio, atualize GEMINI_API_KEY na Vercel e faça Redeploy.';
  } else if (httpStatus === 429) {
    code = 'GEMINI_QUOTA'; status = 429;
    text = 'O Google informou que a cota ou o limite de uso da IA foi atingido. Confira os limites do projeto no Google AI Studio; aguarde a renovação do limite antes de tentar novamente.';
  } else if (httpStatus === 401 || httpStatus === 403) {
    code = 'GEMINI_PERMISSION'; status = 503;
    text = 'O Google recusou o acesso da chave à IA. Confira as permissões da API e o projeto da chave GEMINI_API_KEY no Google AI Studio.';
  } else if (httpStatus === 404) {
    code = 'GEMINI_MODEL_UNAVAILABLE'; status = 503;
    text = 'O modelo configurado não foi encontrado pelo Google. Confira GEMINI_MODEL na Vercel e use um modelo disponível para esta chave.';
  } else if (httpStatus === 400 && /billing|free tier|location.*not supported/i.test(message)) {
    code = 'GEMINI_PROJECT_SETUP'; status = 503;
    text = 'O Google exige revisar a disponibilidade ou o faturamento deste projeto no Google AI Studio antes de usar a IA.';
  } else if (httpStatus === 400 && /schema|response.?format|response.?json|nesting|complexity|constraint/i.test(message)) {
    code = /complex|nest|state|constraint/i.test(message) ? 'GEMINI_SCHEMA_COMPLEX' : 'GEMINI_SCHEMA_REJECTED'; status = 502;
    text = 'O Google recusou o formato estruturado da aula. A configuração de geração precisa ser ajustada; seus materiais foram preservados.';
  } else if (httpStatus === 400) {
    code = 'GEMINI_REQUEST_REJECTED'; status = 502;
    text = 'O Google recusou o formato ou algum material da solicitação. Tente um texto curto sem vídeos para verificar a geração.';
  }
  return { status, body: { error: text, code, providerStatus: httpStatus } };
}
