import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const pixel=readFileSync(new URL('../assets/js/tiktok-pixel.js',import.meta.url),'utf8');
const checkout=readFileSync(new URL('../assets/js/checkout.js',import.meta.url),'utf8');
const order={id:'11111111-2222-4333-8444-555555555555',amount:990,currency:'EUR',status:'paid',token:'PRIVATE_ORDER_TOKEN',issue:null};
function storage(map=new Map()) {return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
function browser({local=storage(),session=storage(),path='/checkout.html',apiOrder=order}={}) {
 const scripts=[],winEvents={},timers=[],elements={};let sequence=0;
 const document={head:{appendChild:s=>scripts.push(s)},getElementsByTagName:()=>[{parentNode:{insertBefore:s=>scripts.push(s)}}],createElement:()=>({events:{},addEventListener(n,f){this.events[n]=f;}}),getElementById:id=>elements[id]||(elements[id]={value:'',textContent:'',hidden:false,disabled:false,checked:true,events:{},reportValidity:()=>true,addEventListener(n,f){this.events[n]=f;}})};
 const window={sessionStorage:session,localStorage:local,location:{pathname:path},crypto:{randomUUID:()=>`test-generated-id-${++sequence}`},addEventListener:(n,f)=>winEvents[n]=f,setTimeout:f=>{timers.push(f);return timers.length;}};
 const context=vm.createContext({window,document,sessionStorage:session,localStorage:local,crypto:window.crypto,setTimeout:window.setTimeout,clearTimeout:()=>{},console,fetch:async url=>({ok:true,json:async()=>url==='/api/config'?{enabled:true,amount:990,currency:'EUR'}:apiOrder})});
 vm.runInContext(pixel,context);
 return {window,context,scripts,session,local,elements,timers,winEvents,load:()=>scripts.at(-1).events.load(),events:()=>window.ttq.filter(x=>x[0]==='track')};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('pixel único, PageView e eventos ficam em fila até o SDK carregar',()=>{
 const b=browser();assert.equal(b.scripts.length,1);assert.match(b.scripts[0].src,/sdkid=DBSI5UJC77U7CBT61SDG/);
 assert.equal(b.window.ttq.filter(e=>e[0]==='page').length,1);assert.equal(b.events().length,0);
 b.load();assert.deepEqual(Array.from(b.events(),e=>e[1]),['ViewContent','InitiateCheckout']);
 vm.runInContext(pixel,b.context);assert.equal(b.scripts.length,1);
});
test('Purchase só para pedido pago, em EUR e com valor certo; nunca para estados pendentes',()=>{
 const b=browser();b.load();
 for(const status of ['creating','pending','review','rejected','refunded','chargeback','cancelled'])assert.equal(b.window.OfferTikTok.confirmedPurchase({...order,status}),false);
 assert.equal(b.window.OfferTikTok.confirmedPurchase({...order,currency:'BRL'}),false);
 assert.equal(b.window.OfferTikTok.confirmedPurchase({...order,amount:805}),false);
 assert.equal(b.window.OfferTikTok.confirmedPurchase({...order,issue:'EAGLE_AMOUNT_MISMATCH'}),false);
 assert.equal(b.events().some(e=>e[1]==='Purchase'),false);
 b.window.OfferTikTok.confirmedPurchase(order);b.window.OfferTikTok.confirmedPurchase(order);
 const purchases=b.events().filter(e=>e[1]==='Purchase');assert.equal(purchases.length,1);assert.equal(purchases[0][2].value,9.9);assert.equal(purchases[0][2].currency,'EUR');assert.match(purchases[0][3].event_id,new RegExp(order.id));assert.equal(JSON.stringify(purchases).includes('PRIVATE_ORDER_TOKEN'),false);
});
test('atualizar a página e repetir polling não reenvia Purchase nesse navegador',()=>{
 const local=storage();const b=browser({local});b.load();b.window.OfferTikTok.confirmedPurchase(order);
 const reloaded=browser({local});reloaded.load();reloaded.window.OfferTikTok.confirmedPurchase(order);assert.equal(reloaded.events().filter(e=>e[1]==='Purchase').length,0);
});
test('SDK bloqueado não marca compra como enviada e recuperação preserva event_id',()=>{
 const b=browser();b.window.OfferTikTok.confirmedPurchase(order);b.scripts[0].events.error();assert.equal(b.events().length,0);assert.equal([...b.local.map.keys()].some(k=>k.includes('Purchase')),false);
 b.load();assert.equal(b.events().filter(e=>e[1]==='Purchase').length,1);
});
test('Lead e AddPaymentInfo uma vez, sem enviar nome, e-mail, telefone ou NIF',()=>{
 const b=browser();b.load();b.window.OfferTikTok.lead();b.window.OfferTikTok.lead();b.window.OfferTikTok.paymentInfo('request-id-123456789012345');b.window.OfferTikTok.paymentInfo('request-id-123456789012345');
 assert.equal(b.events().filter(e=>e[1]==='Lead').length,1);assert.equal(b.events().filter(e=>e[1]==='AddPaymentInfo').length,1);
 for(const e of b.events())for(const field of ['email','phone','nif','document','token'])assert.equal(Object.hasOwn(e[2],field),false);
});
test('restaurar pedido pago do sessionStorage não gera compra se API atual não confirma',async()=>{
 const session=storage();session.setItem('academicOrder',JSON.stringify(order));
 const b=browser({session,apiOrder:{...order,status:'pending'}});b.load();vm.runInContext(checkout,b.context);await tick();await tick();
 assert.equal(b.events().filter(e=>e[1]==='Purchase').length,0);
});
test('confirmação atual da API gera Purchase e polling repetido fica deduplicado',async()=>{
 const session=storage();session.setItem('academicOrder',JSON.stringify({...order,status:'pending'}));
 const b=browser({session});b.load();vm.runInContext(checkout,b.context);await tick();await tick();
 assert.equal(b.events().filter(e=>e[1]==='Purchase').length,1);
 await b.elements.checkButton.events.click();assert.equal(b.events().filter(e=>e[1]==='Purchase').length,1);
});
test('ambas as páginas carregam pixel e CSP do checkout permite endpoints necessários',()=>{
 for(const name of ['index.html','checkout.html']){const html=readFileSync(new URL('../'+name,import.meta.url),'utf8');assert.equal((html.match(/src="\/assets\/js\/tiktok-pixel.js"/g)||[]).length,1);}
 const html=readFileSync(new URL('../checkout.html',import.meta.url),'utf8');assert.ok(html.indexOf('tiktok-pixel.js')<html.indexOf('/assets/js/checkout.js'));
 const server=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');assert.match(server,/script-src 'self' https:\/\/analytics.tiktok.com/);assert.match(server,/connect-src 'self' https:\/\/analytics.tiktok.com/);assert.match(server,/https:\/\/anlytics-ipv6.tiktokw.us/);
});
