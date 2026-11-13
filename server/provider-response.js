// Diagnóstico por lista permitida: nunca guardar payload completo, cliente ou credenciais.
export function summarizeTransaction(tx) {
 if(!tx || typeof tx!=='object' || Array.isArray(tx))return {type:typeof tx};
 const number=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
 return {
  fields:Object.keys(tx).slice(0,60),
  id:typeof tx.id==='string'&&/^[a-zA-Z0-9_-]{1,256}$/.test(tx.id)?tx.id:null,
  status:['pending','processing','completed','rejected','refunded','chargeback','expired','cancelled'].includes(tx.status)?tx.status:'unknown',
  amount:number(tx.amount),
  currency:/^[A-Z]{3}$/.test(tx.currency||'')?tx.currency:null,
  vat:tx.vat&&typeof tx.vat==='object'?{baseAmount:number(tx.vat.baseAmount),totalAmount:number(tx.vat.totalAmount),amount:number(tx.vat.amount),rate:number(tx.vat.rate)}:null
 };
}
export const ISSUE_MESSAGES={
 EAGLE_TOTAL_UNVERIFIED:'A cobrança existe, mas a Eagle não devolveu os dados necessários para validar o total com IVA. Não cries outra cobrança. O pedido está a ser verificado.',
 EAGLE_AMOUNT_MISMATCH:'O valor devolvido pela Eagle não corresponde aos 9,90 € previstos. Não aproves nem repitas o pedido antes de conferir o valor.',
 EAGLE_REFERENCE_MISMATCH:'A resposta da Eagle não corresponde à referência ou moeda deste pedido.',
 EAGLE_REQUEST_FAILED:'Não foi possível consultar o pedido na Eagle. O pedido existente foi preservado; não cries outro.',
 STORAGE_FAILED:'Não foi possível guardar a confirmação. O pedido existente foi preservado; não cries outro.'
};
export function paymentIssue(order,tx,matches) {
 if(!tx || String(tx.id)!==order.transaction_id || (tx.currency&&tx.currency!=='EUR'))return 'EAGLE_REFERENCE_MISMATCH';
 if(matches(order,tx))return null;
 if(!tx.vat && order.verified_total!==990)return 'EAGLE_TOTAL_UNVERIFIED';
 return 'EAGLE_AMOUNT_MISMATCH';
}
