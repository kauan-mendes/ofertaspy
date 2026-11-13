import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature, validateCustomer, mbwayPayload, matchesPayment } from '../server/payments.js';
const customer = { method:'mbway', name:'Pessoa de Teste',email:'teste@example.pt', phone:'+351 912 345 678', nif:'123456789',consent:true };
test('MB WAY mantém total de 9,90 € incluindo IVA e ignora preço do cliente',()=>{
 const c=validateCustomer({...customer,amount:1});const p=mbwayPayload(c,'order-1','https://app.example');
 assert.equal(p.amount,805);assert.equal(p.amount+Math.round(p.amount*23/100),990);assert.equal(p.currency,'EUR');assert.equal(p.customer.phone,'+351912345678');assert.equal(p.items[0].unitPrice,805);
});
test('exige consentimento, método MB WAY, NIF e telefone portugueses',()=>{
 for(const override of [{consent:false},{method:'card'},{phone:'123'},{nif:'123456788'}])assert.throws(()=>validateCustomer({...customer,...override}));
 assert.equal(validateCustomer({...customer,phone:'00351912345678'}).phone,'+351912345678');
});
test('assinatura valida corpo original e recusa adulteração, ausência e replay',()=>{
 const raw=Buffer.from('{ "transactionId": "t1" }');const ts=String(Math.floor(Date.now()/1000));const secret='only-for-unit-tests';
 const sig='sha256='+createHmac('sha256',secret).update(ts+'.').update(raw).digest('hex');
 assert.equal(verifySignature(raw,ts,sig,secret),true);assert.equal(verifySignature(Buffer.from('{}'),ts,sig,secret),false);assert.equal(verifySignature(raw,ts,sig,secret,Date.now()+301000),false);assert.equal(verifySignature(raw,'',sig,secret),false);assert.equal(verifySignature(raw,ts,'',secret),false);
});
test('confirma a referência, moeda e total com IVA antes de aceitar pagamento',()=>{
 const o={method:'mbway',transaction_id:'t1'};const tx={id:'t1',amount:990,currency:'EUR',vat:{baseAmount:805,totalAmount:990}};
 assert.equal(matchesPayment(o,tx),true);assert.equal(matchesPayment(o,{...tx,id:'t2'}),false);assert.equal(matchesPayment(o,{...tx,currency:'BRL'}),false);assert.equal(matchesPayment(o,{...tx,vat:{baseAmount:805,totalAmount:1000}}),false);
});

test('consulta sem IVA só é aceite se o total da criação estiver verificado',()=>{
 const tx={id:'t1',amount:805,currency:'EUR'};
 assert.equal(matchesPayment({transaction_id:'t1',verified_total:0},tx),false);
 assert.equal(matchesPayment({transaction_id:'t1',verified_total:990},tx),true);
 assert.equal(matchesPayment({transaction_id:'t1',verified_total:990},{...tx,amount:1}),false);
});
