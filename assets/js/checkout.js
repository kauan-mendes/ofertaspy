(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 let config, order, timer, busy = false;
 let requestKey = sessionStorage.getItem('academicRequestKey');
 const terminal = new Set(['paid','rejected','refunded','chargeback','expired','cancelled']);
 const statuses = {
  paid:['✓','Pagamento confirmado','A Eagle confirmou o pagamento real de 9,90 €. A validação académica está concluída. Os dados do relatório continuam a ser uma simulação.'],
  pending:['…','Confirma na aplicação MB WAY','Abre a aplicação MB WAY e verifica o pedido de 9,90 €. O estado será atualizado após confirmação pela Eagle.'],
  creating:['…','Pedido em processamento','Aguarda pela confirmação do servidor. Não cries outro pedido.'],
  review:['!','Verificação necessária','A resposta de criação foi inconclusiva. Confirma o pedido no painel Eagle e na aplicação MB WAY antes de qualquer nova tentativa.'],
  rejected:['×','Pagamento recusado','O pagamento foi recusado pela Eagle. Consulta o painel antes de repetir o teste.'],
  refunded:['↩','Pagamento reembolsado','A Eagle confirmou que o pagamento foi reembolsado.'],
  chargeback:['!','Pagamento contestado','A Eagle comunicou uma contestação deste pagamento.'],
  expired:['×','Pedido expirado','O pedido expirou. Confirma o estado no painel Eagle.'],
  cancelled:['×','Pedido cancelado','O pedido foi cancelado.']
 };
 function save() { sessionStorage.setItem('academicOrder',JSON.stringify(order)); }
 function render() {
  $('paymentForm').hidden=true; $('receipt').hidden=false;
  const [icon,title,desc]=statuses[order.status]||statuses.pending;
  $('statusIcon').textContent=icon;$('statusTitle').textContent=title;$('statusDescription').textContent=desc;$('orderId').textContent=order.id;
  $('checkButton').hidden=terminal.has(order.status);
  if(terminal.has(order.status)) clearTimeout(timer);
 }
 async function check() {
  if(!order || busy) return;
  busy=true;$('checkButton').disabled=true;
  try {
   const res=await fetch('/api/orders/'+encodeURIComponent(order.id),{headers:{Authorization:'Bearer '+order.token},cache:'no-store'});
   const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível confirmar o estado.');
   order=data;save();render();$('message').textContent='';
  } catch(e) { $('message').textContent=e.message+' Não aproves nem cries outro pedido sem confirmar o estado.'; }
  finally {busy=false;$('checkButton').disabled=false;}
  clearTimeout(timer);
  if(!terminal.has(order.status))timer=setTimeout(check,12000);
 }
 $('checkButton').addEventListener('click',check);
 $('paymentForm').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!config?.enabled)return;
  if(!$('paymentForm').reportValidity())return;
  busy=true;$('payButton').disabled=true;$('payButton').textContent='A criar pedido MB WAY…';$('message').textContent='';
  if(!requestKey){requestKey=crypto.randomUUID();sessionStorage.setItem('academicRequestKey',requestKey);}
  try {
   const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},body:JSON.stringify({method:'mbway',name:$('name').value,email:$('email').value,phone:$('phone').value,nif:$('nif').value,consent:$('consent').checked})});
   const data=await res.json();
   if(data.id&&data.token){order=data;save();render();}
   if(!res.ok)throw new Error(data.error||'Não foi possível criar o pedido.');
   busy=false;await check();
  } catch(e) { $('message').textContent=e.message+' Mantém esta página aberta e evita criar pedidos repetidos.'; }
  finally {busy=false;$('payButton').disabled=false;$('payButton').textContent='Pagar 9,90 € com MB WAY';if(order&&!terminal.has(order.status)){clearTimeout(timer);timer=setTimeout(check,12000);}}
 });
 (async()=>{
  try {
   const customer=JSON.parse(sessionStorage.getItem('academicCustomer')||'{}');$('name').value=customer.name||'';$('email').value=customer.email||'';
   const saved=JSON.parse(sessionStorage.getItem('academicOrder')||'null');if(saved?.id&&saved?.token){order=saved;render();}
   const res=await fetch('/api/config',{cache:'no-store'});if(!res.ok)throw new Error('O servidor de pagamentos não está disponível.');config=await res.json();
   if(config.amount!==990||config.currency!=='EUR')throw new Error('A configuração do preço não corresponde a 9,90 €.');
   if(!config.enabled){$('message').textContent='Os pagamentos ainda estão desativados. É necessário configurar e ativar a Eagle no servidor.';return;}
   $('payButton').disabled=false;if(order)await check();
  } catch(e) {$('message').textContent=e.message;}
 })();
})();
