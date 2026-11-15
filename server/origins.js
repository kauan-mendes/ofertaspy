// PUBLIC_APP_URL continua a ser a base pública da API e do webhook no Render.
// FRONTEND_URL é apenas a origem autorizada do site publicado na Vercel.
export function canonicalOrigin(value, name) {
  if (!value || !String(value).trim()) return null;
  let url;
  try { url = new URL(String(value).trim()); }
  catch { throw new Error(`${name} deve ser uma URL HTTPS válida.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
    throw new Error(`${name} deve conter apenas uma origem HTTPS, sem caminho, parâmetros ou credenciais.`);
  }
  return url.origin;
}
export function originConfig(env = process.env) {
  const apiOrigin = canonicalOrigin(env.PUBLIC_APP_URL, 'PUBLIC_APP_URL');
  const frontendOrigin = canonicalOrigin(env.FRONTEND_URL, 'FRONTEND_URL');
  return { apiOrigin, frontendOrigin, allowedOrigins: new Set([apiOrigin, frontendOrigin].filter(Boolean)) };
}
