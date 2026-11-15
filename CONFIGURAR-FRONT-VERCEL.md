# Backend Render para frontend Vercel — versão 1.0.4

Este pacote atualiza o backend existente. Substitua os ficheiros preservando as pastas; não apague os demais módulos de server/ nem o repositório atual. Não requer nova tabela, mudança de banco ou alteração das chaves Eagle/Supabase.

1. Faça commit desta atualização no repositório conectado ao Render e aguarde o deploy.
2. Publique o pacote do frontend num repositório separado conectado à Vercel.
3. No Render → Environment, adicione:

```text
FRONTEND_URL=https://DOMINIO-DE-PRODUCAO-DO-FRONT.vercel.app
```

Utilize a URL de produção estável, sem `/checkout.html`, parâmetros ou curingas. Salve com deploy para aplicar a variável. Se usar um domínio próprio, coloque-o em FRONTEND_URL.

**Mantenha esta variável com o endereço do Render:**

```text
PUBLIC_APP_URL=https://ofertaspy-td1y.onrender.com
```

Ela continua a definir a base da API/webhook, por compatibilidade com a versão já instalada. FRONTEND_URL é só a origem adicional autorizada para criar pedidos. Se FRONTEND_URL ainda estiver vazio, o servidor continua a funcionar no domínio Render.

As três chaves da Eagle e as duas variáveis Supabase continuam exclusivamente no Render. PAYMENTS_ENABLED mantém o valor que você já configurou; a adaptação não o altera.

O webhook da Eagle permanece:

```text
https://ofertaspy-td1y.onrender.com/api/eagle/webhook
```

`/api/health` passa a indicar versão `1.0.4`. O site antigo no Render permanece como alternativa durante a mudança. O pagamento, idempotência, consultas, assinatura do webhook e eventos do pixel não foram alterados.

Testes locais passaram para origens permitidas/recusadas e para a comunicação front-proxy-backend com criação e confirmação simuladas. Depois do deploy precisamos conferir a URL real da Vercel, pois ainda não foi fornecida. Não foram feitos pagamentos reais.
