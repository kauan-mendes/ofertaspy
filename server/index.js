import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes } from 'node:crypto';
import { createStore } from './store.js';
import { verifySignature, validateCustomer, mbwayPayload, matchesPayment, TOTAL_CENTS } from './payments.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const origin = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
const enabled = process.env.PAYMENTS_ENABLED === 'true';
const port = Number(process.env.PORT || 3000);
if (enabled && (!/^https:\/\/[^/?#]+$/.test(origin) || ['EAGLE_CLIENT_ID','EAGLE_PUBLIC_KEY','EAGLE_SECRET_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].some(k => !process.env[k]))) throw new Error('Configura PUBLIC_APP_URL (HTTPS) e as credenciais Eagle e Supabase antes de ativar pagamentos.');
const db = createStore();
const get = id => db.get(id);
const byTx = tx => db.byTx(tx);
const safeOrder = o => ({ id: o.id, token: o.token, method: o.method, status: o.status, amount: TOTAL_CENTS, currency: 'EUR' });
function send(res, code, obj) {
 res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(obj));
}
async function rawBody(req) {
 let len=0; const chunks=[];
 for await (const c of req) { len+=c.length; if(len>16384) throw Object.assign(new Error('Pedido demasiado grande.'),{status:413}); chunks.push(c); }
 return Buffer.concat(chunks);
}
async function eagle(path, { method='GET', body, key='public' }={}) {
 const response=await fetch('https://api.eaglepagamentos.com.br'+path, {method, redirect:'error', signal:AbortSignal.timeout(25000), headers:{'Content-Type':'application/json','X-Client-Id':process.env.EAGLE_CLIENT_ID,[key==='secret'?'X-Secret-Key':'X-Public-Key']:process.env[key==='secret'?'EAGLE_SECRET_KEY':'EAGLE_PUBLIC_KEY']}, ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok) throw new Error('A Eagle não concluiu o pedido. Confirma as credenciais, a moeda EUR e os métodos habilitados no painel.');
 return response.json();
}
async function reconcile(o) {
 if(!o.transaction_id) return o;
 const tx=await eagle('/api/v1/public/payment/transaction/'+encodeURIComponent(o.transaction_id));
 if(!matchesPayment(o,tx)) throw new Error('A referência ou o valor do pagamento não corresponde ao pedido.');
 const status=tx.status==='completed'?'paid':({rejected:'rejected',refunded:'refunded',chargeback:'chargeback',expired:'expired',cancelled:'cancelled'}[tx.status]||'pending');
 // A leitura remota é a autoridade; mensagens do navegador nunca confirmam pagamento.
 return db.status(o.id,status);
}
const app = http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/health' && req.method==='GET') return send(res,200,{ok:true,storage:'supabase'});
  if(url.pathname==='/api/config' && req.method==='GET') return send(res,200,{enabled,amount:990,currency:'EUR',mbwayBase:805,mbwayVat:185});
  if(url.pathname==='/api/eagle/webhook' && req.method==='POST') {
   if(!enabled) return send(res,503,{error:'Pagamentos desativados.'});
   const raw=await rawBody(req);
   if(!verifySignature(raw,req.headers['x-eagle-timestamp'],req.headers['x-eagle-signature'],process.env.EAGLE_SECRET_KEY)) return send(res,401,{error:'Assinatura inválida.'});
   const event=JSON.parse(raw);
   if(typeof event.transactionId!=='string'||!event.transactionId||event.transactionId.length>256) return send(res,400,{error:'Referência inválida.'});
   let o=await byTx(event.transactionId);
   if(!o && typeof event.externalId==='string') {
    o=await get(event.externalId);
    if(o && !o.transaction_id) { await db.attach(o.id,event.transactionId); o=await get(o.id); }
   }
   if(!o || o.transaction_id!==event.transactionId) return send(res,200,{received:true});
   await reconcile(o); // Falha: 503 para permitir nova tentativa do remetente.
   return send(res,200,{received:true});
  }
  if(url.pathname==='/api/orders' && req.method==='POST') {
   if(!enabled) return send(res,503,{error:'Pagamentos ainda não ativados no servidor.'});
   if(req.headers.origin!==origin || !String(req.headers['content-type']||'').startsWith('application/json')) return send(res,403,{error:'Origem do pedido inválida.'});
   const body=JSON.parse(await rawBody(req));
   let customer; try { customer=validateCustomer(body); } catch(e) {return send(res,400,{error:e.message});}
   const key=String(req.headers['idempotency-key']||'');
   if(!/^[a-zA-Z0-9-]{20,80}$/.test(key)) return send(res,400,{error:'Referência do pedido inválida.'});
   const reservation=await db.reserve(randomUUID(),key,randomBytes(32).toString('hex'));
   if(reservation.limited) return send(res,429,{error:'Limite de validações atingido. Tenta novamente mais tarde.'});
   if(!reservation.created) return send(res,200,safeOrder(reservation.order));
   const id=reservation.order.id;
   try {
     const tx=await eagle('/api/v1/public/payment/transaction',{method:'POST',body:mbwayPayload(customer,id,origin)});
     if(typeof tx.id!=='string'||!tx.id) throw new Error('Resposta da Eagle sem referência da transação.');
     await db.attach(id,tx.id);
     if(!matchesPayment(await get(id),tx)) throw new Error('A Eagle devolveu um total diferente de 9,90 €. Não aproves o pedido; consulta o painel.');
     await db.verify(id);

    return send(res,201,safeOrder(await get(id)));
   } catch(e) {
    // Não repetir POST com resultado desconhecido: pode já existir uma cobrança no prestador.
    await db.review(id);
    return send(res,502,{...safeOrder(await get(id)),error:e.message+' Não cries outro pedido antes de confirmar o estado no painel Eagle.'});
   }
  }
  const match=url.pathname.match(/^\/api\/orders\/([0-9a-f-]{36})$/);
  if(match && req.method==='GET') {
   let o=await get(match[1]);
   if(!o || req.headers.authorization!=='Bearer '+o.token) return send(res,404,{error:'Pedido não encontrado.'});
   if(o.transaction_id && Date.now()-o.last_check>10000 && enabled) o=await reconcile(o);
   return send(res,200,safeOrder(o));
  }
  if(url.pathname.startsWith('/api/')) return send(res,404,{error:'Rota não encontrada.'});
  if(!['GET','HEAD'].includes(req.method)) return send(res,405,{error:'Método não permitido.'});
  const path=decodeURIComponent(url.pathname);
  if(!['/','/index.html','/checkout.html'].includes(path) && !/^\/assets\/[a-zA-Z0-9_./-]+$/.test(path)) return send(res,404,{error:'Ficheiro não encontrado.'});
  if(path.split('/').some(x=>x.startsWith('.'))) return send(res,404,{error:'Ficheiro não encontrado.'});
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root)) return send(res,404,{error:'Ficheiro não encontrado.'});
  const bytes=await readFile(file);
  const type={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'}[extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...(path==='/checkout.html'?{'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}: {})});
  res.end(req.method==='HEAD'?undefined:bytes);
 } catch(e) {
  if(e.code==='ENOENT') return send(res,404,{error:'Ficheiro não encontrado.'});
  if(e instanceof SyntaxError) return send(res,400,{error:'Pedido JSON inválido.'});
  send(res,e.status||503,{error:'Não foi possível confirmar o pedido. Aguarda e verifica o painel antes de tentar novamente.'});
 }
});
app.listen(port,'0.0.0.0',()=>console.log('Aplicação disponível na porta '+port+'; pagamentos '+(enabled?'REAIS ativados':'desativados')));
