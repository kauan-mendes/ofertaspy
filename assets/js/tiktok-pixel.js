/* TikTok Pixel DBSI5UJC77U7CBT61SDG: base comum às páginas e eventos do funil. */
(function (w, d) {
  'use strict';
  if (w.OfferTikTok) return;
  var PIXEL_ID = 'DBSI5UJC77U7CBT61SDG';
  var PRODUCT_ID = 'academic-report';
  var ready = false, queue = [], inMemory = Object.create(null), retryCount = 0;
  function read(storage, key) { try { return storage.getItem(key); } catch (_) { return null; } }
  function write(storage, key, value) { try { storage.setItem(key, value); } catch (_) {} }
  function storage(name) { try { return w[name]; } catch (_) { return null; } }
  var session = storage('sessionStorage'), local = storage('localStorage');
  function randomId() { return w.crypto && w.crypto.randomUUID ? w.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
  var journey = read(session, 'tt_offer_journey');
  if (!journey) { journey = randomId(); write(session, 'tt_offer_journey', journey); }
  var pageId = randomId();
  function properties(extra) {
    return Object.assign({content_type:'product',content_id:PRODUCT_ID,content_ids:[PRODUCT_ID],content_name:'Relatório académico',quantity:1,currency:'EUR',value:9.90}, extra || {});
  }
  function sent(event) {
    return inMemory[event.key] === 'sent' || (event.storage && read(event.storage, event.key) === '1');
  }
  function flush() {
    if (!ready || !w.ttq || typeof w.ttq.track !== 'function') return;
    var events = queue; queue = [];
    events.forEach(function (event) {
      if (sent(event)) return;
      try {
        // event_id está nas opções do pixel, não nos dados financeiros ou pessoais.
        w.ttq.track(event.name, event.props, {event_id:event.id});
        inMemory[event.key] = 'sent';
        if (event.storage) write(event.storage, event.key, '1');
      } catch (_) { queue.push(event); }
    });
  }
  function once(name, id, props, persistence) {
    var event = {name:name,id:'mbway:' + name + ':' + id,key:'tt_offer:' + PIXEL_ID + ':' + name + ':' + id,props:properties(props),storage:persistence};
    if (sent(event) || inMemory[event.key] === 'queued') return false;
    inMemory[event.key] = 'queued'; queue.push(event); flush(); return true;
  }
  var steps = {s1:'Apresentação',s2:'Análise',s3:'Confirmação do perfil',s4:'Preparação do relatório',s6:'Resumo',s7:'Visitantes',s8:'Histórias',s9:'Menções',s10:'Oferta',errorScreen:'Perfil não encontrado'};
  w.OfferTikTok = {
    viewStep:function(id) { if (steps[id]) once('ViewContent',pageId + ':' + id,{description:steps[id]},null); },
    beginCheckout:function() { return once('InitiateCheckout',journey,{},session); },
    lead:function() { return once('Lead',journey,{},session); },
    paymentInfo:function(requestKey) {
      if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(requestKey)) return false;
      return once('AddPaymentInfo',requestKey,{payment_method:'mbway'},session);
    },
    // Chamar apenas com a resposta atual e bem-sucedida da API de estado.
    // Nunca chamar ao renderizar academicOrder guardado no navegador.
    confirmedPurchase:function(order) {
      if (!order || order.status !== 'paid' || order.issue || order.currency !== 'EUR' || order.amount !== 990 || !/^[a-f0-9-]{36}$/i.test(order.id || '')) return false;
      return once('Purchase',order.id,{},local);
    }
  };

  // TikTok Pixel Code Start — mesmo ID e inicialização enviados pelo proprietário.
  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;
    var ttq=w[t]=w[t]||[];
    ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
    ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)));};};
    for(var i=0;i<ttq.methods.length;i++) if(typeof ttq[ttq.methods[i]]!=='function') ttq.setAndDefer(ttq,ttq.methods[i]);
    ttq.instance=function(t){var e=ttq._i[t]||[];for(var n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e;};
    ttq.load=function(e,n){
      var r='https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;
      ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
      var script=d.createElement('script');script.type='text/javascript';script.async=true;script.src=r+'?sdkid='+e+'&lib='+t;
      script.addEventListener('load',function(){ready=true;flush();});
      script.addEventListener('error',function(){
        // Não gravar marcadores de compra enquanto o SDK estiver bloqueado.
        if(retryCount<2)w.setTimeout(function(){retryCount++;ttq.load(PIXEL_ID);},1500* (retryCount+1));
      });
      var first=d.getElementsByTagName('script')[0];
      if(first&&first.parentNode)first.parentNode.insertBefore(script,first);else d.head.appendChild(script);
    };
    ttq.load(PIXEL_ID);ttq.page();
  }(w,d,'ttq');
  // TikTok Pixel Code End
  var checkout = /\/checkout(?:\.html)?\/?$/.test(w.location.pathname);
  if (checkout) { once('ViewContent',pageId + ':checkout',{description:'Checkout MB WAY'},null);w.OfferTikTok.beginCheckout(); }
  else w.OfferTikTok.viewStep('s1');
  w.addEventListener('online',function(){if(ready)flush();});
})(window, document);
