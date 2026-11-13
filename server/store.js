// A chave service_role permanece exclusivamente no servidor.
export function createStore(env=process.env, transport=fetch) {
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 async function request(path,{method='GET',body,prefer}={}) {
  if(!/^https:\/\/[^/]+\.supabase\.co$/.test(base)||!key) throw new Error('Configura o projeto Supabase escolhido para o MB WAY.');
  const r=await transport(base+'/rest/v1/'+path,{method,signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw new Error('Não foi possível guardar ou consultar o pedido no Supabase.');
  const text=await r.text();return text?JSON.parse(text):null;
 }
 const one=async query=>(await request('mbway_orders?select=*&'+query+'&limit=1'))?.[0]||null;
 const patch=async(id,body,extra='')=>(await request('mbway_orders?id=eq.'+encodeURIComponent(id)+extra,{method:'PATCH',body,prefer:'return=representation'}))?.[0]||null;
 return {
  get:id=>one('id=eq.'+encodeURIComponent(id)),
  byTx:id=>one('transaction_id=eq.'+encodeURIComponent(id)),
  reserve:(id,key,token)=>request('rpc/mbway_reserve_order',{method:'POST',body:{p_id:id,p_key:key,p_token:token}}),
  attach:(id,tx)=>patch(id,{transaction_id:tx},'&transaction_id=is.null'),
  verify:async id=>{await patch(id,{verified_total:990});await patch(id,{status:'pending'},'&status=eq.creating');},
  review:id=>patch(id,{status:'review'},'&status=eq.creating'),
  status:(id,status)=>request('rpc/mbway_record_status',{method:'POST',body:{p_id:id,p_status:status}})
 };
}
