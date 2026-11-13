import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/store.js';
test('chaves de serviço só em cabeçalhos e reserva através da RPC atómica',async()=>{
 const calls=[];const db=createStore({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-key'},async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify({created:true,order:{id:'o'}}));});
 await db.reserve('o','request-key','access-token');const {url,opts}=calls[0];
 assert.equal(url,'https://test.supabase.co/rest/v1/rpc/mbway_reserve_order');assert.equal(opts.headers.apikey,'test-server-key');assert.equal(url.includes('test-server-key'),false);assert.deepEqual(JSON.parse(opts.body),{p_id:'o',p_key:'request-key',p_token:'access-token'});
});
test('falha de persistência não é tratada como reserva bem sucedida',async()=>{
 const db=createStore({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key'},async()=>new Response('{}',{status:503}));await assert.rejects(db.reserve('o','k','t'));
});
