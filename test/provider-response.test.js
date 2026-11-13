import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTransaction,paymentIssue} from '../server/provider-response.js';
import {matchesPayment} from '../server/payments.js';
test('diagnóstico não persiste dados de cliente, chaves ou corpo completo',()=>{
 const summary=summarizeTransaction({id:'tx-1',amount:805,currency:'EUR',status:'pending',customer:{name:'PRIVATE NAME',document:'PRIVATE NIF'},secret:'PRIVATE SECRET',instructions:{url:'PRIVATE TOKEN'}});
 const encoded=JSON.stringify(summary);assert.equal(encoded.includes('PRIVATE'),false);assert.equal(summary.amount,805);assert.equal(summary.vat,null);
});
test('retorno real sem IVA é conciliado pela base e não pelo estado do navegador',()=>{
 const o={transaction_id:'tx1',verified_total:0};const tx={id:'tx1',amount:805,status:'completed',currency:'EUR'};
 assert.equal(paymentIssue(o,tx,matchesPayment),null);
 assert.equal(paymentIssue(o,{...tx,amount:1},matchesPayment),'EAGLE_AMOUNT_MISMATCH');
 assert.equal(paymentIssue(o,{...tx,amount:null},matchesPayment),'EAGLE_TOTAL_UNVERIFIED');
 assert.equal(paymentIssue({...o,verified_total:990},tx,matchesPayment),null);
});
test('consulta com IVA permite recuperar pedido previamente em revisão',()=>{
 const o={transaction_id:'tx1',verified_total:0};const tx={id:'tx1',amount:805,currency:'EUR',vat:{baseAmount:805,totalAmount:990}};
 assert.equal(paymentIssue(o,tx,matchesPayment),null);
 assert.equal(paymentIssue(o,{...tx,vat:{baseAmount:805,totalAmount:805}},matchesPayment),'EAGLE_AMOUNT_MISMATCH');
});

test('formato real observado na consulta Eagle aceita processing sem vat',()=>{
 const order={transaction_id:'tx-real-format',verified_total:0,status:'review'};
 const tx={id:'tx-real-format',status:'processing',amount:805,currency:'EUR',endToEndId:null};
 assert.equal(paymentIssue(order,tx,matchesPayment),null);
 assert.equal(tx.status,'processing');
 assert.equal(paymentIssue(order,{...tx,currency:'BRL'},matchesPayment),'EAGLE_REFERENCE_MISMATCH');
 assert.equal(paymentIssue(order,{...tx,id:'another-id'},matchesPayment),'EAGLE_REFERENCE_MISMATCH');
});
