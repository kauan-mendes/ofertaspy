# MB WAY — Render + projeto Supabase CAJU

Esta versão serve o site e a API juntos no Render. Os pedidos ficam em `public.mbway_orders` no projeto **CAJU**, escolhido pelo utilizador:

`https://zqmtlhqaaueighidwluy.supabase.co`

Não depende de SQLite, disco persistente ou Vercel. A tabela é específica do MB WAY; o projeto, banco, recursos e credenciais administrativas são compartilhados com as demais tabelas desse projeto. Não há isolamento de um projeto separado.

As cobranças ativadas são reais, com total de 9,90 €. O relatório continua identificado como simulação académica e exige consentimento antes do pagamento.

## 1. Banco já configurado

Foram criadas `public.mbway_orders`, `public.mbway_reserve_order` e `public.mbway_record_status`, sem alterar as tabelas preexistentes.

Verificações realizadas no banco remoto:

- RLS ativado; anon/authenticated sem leitura da tabela nem execução da reserva.
- service_role com acesso de servidor.
- Reserva idempotente testada e proteção contra reversão de pago para pendente.
- Os dados temporários desses testes foram desfeitos por rollback.

Não é necessário executar `database/setup.sql` novamente. `database/verify.sql` permite consultar as permissões. Não crie políticas de leitura pública; a aplicação utiliza apenas o servidor.

## 2. Render

Publique a pasta `ofertaspy` num repositório. No serviço Render que criou:

- Tipo: Web Service, ambiente Node.
- Root Directory: a pasta que contém `package.json`, ou em branco se os ficheiros estiverem na raiz do repositório.
- Build Command: `npm install`.
- Start Command: `npm start`.
- Health Check Path: `/api/health` (confirma o processo; não verifica credenciais externas).
- Node: 22.13 ou superior.

Pode usar o serviço grátis sem disco persistente, pois os pedidos ficam no Supabase. O serviço grátis pode suspender por inatividade, causando atraso no primeiro acesso ou webhook. As limitações e quotas do Render/Supabase continuam a aplicar-se.

Em Environment, configure:

| Variável | Valor |
|---|---|
| `EAGLE_CLIENT_ID` | Client ID da Eagle |
| `EAGLE_PUBLIC_KEY` | Public Key da Eagle |
| `EAGLE_SECRET_KEY` | Secret Key da Eagle para validar os webhooks |
| `SUPABASE_URL` | `https://zqmtlhqaaueighidwluy.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` do projeto CAJU selecionado, apenas no servidor |
| `PUBLIC_APP_URL` | URL HTTPS do serviço Render, sem barra final |
| `PAYMENTS_ENABLED` | Comece com `false`; configure `true` após criar e verificar as tabelas e preencher as chaves |

Não precisa de `DATA_DIR` nem de configurar `PORT`: o servidor utiliza a porta fornecida pelo Render. Guarde e faça deploy para aplicar as variáveis.

## 3. Eagle

A conta deve estar habilitada para EUR e MB WAY. O ID de integração de cartão não é utilizado.

Webhook: `https://SEU-SERVICO.onrender.com/api/eagle/webhook`.

Selecione os eventos de pedido gerado, aprovado, reprovado e reembolsado. O servidor envia essa URL também em postbackUrl na criação. A assinatura é verificada sobre os bytes originais com HMAC-SHA256 e tolerância de 300 segundos. A confirmação exige consulta à API Eagle; um evento ou uma mensagem do navegador não basta.

## 4. Teste real

Abra `/checkout.html`, introduza os dados reais de um pagador voluntário e confirme o consentimento. O pedido envia 805 cêntimos de base; o IVA documentado de 23% arredonda para 185 cêntimos, totalizando 990 cêntimos (9,90 €). Confira o valor e o destinatário na aplicação MB WAY antes de aprovar.

A referência aleatória e o token do pedido ficam no separador do navegador. A mesma referência não gera outra cobrança, mesmo em chamadas concorrentes. Um resultado inconclusivo fica em revisão; confirme no painel Eagle antes de criar outro pedido. A consulta automática ocorre a cada 12 segundos. Não há reembolso automático.

## Verificação e estado da entrega

`npm test` valida preço, NIF, telefone, consentimento, assinatura, replay, correspondência de transação e o acesso à camada Supabase. O teste de integração do desenvolvimento usa respostas simuladas da Eagle e Supabase, incluindo pedidos concorrentes com a mesma chave.

O banco remoto foi configurado e verificado. As credenciais Eagle e service_role ainda precisam ser configuradas no Render; não foram efetuadas cobranças reais. O funcionamento em produção só estará validado após deploy e confirmação de um pagamento real.

O verificador de segurança sinalizou a função preexistente `public.rls_auto_enable()` como SECURITY DEFINER executável por anon/authenticated. Ela não pertence à integração MB WAY e não foi alterada. Revisão: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable . O aviso informativo de RLS sem política em mbway_orders é esperado: apenas service_role deve aceder à tabela.

Documentação: https://docs.eaglepagamentos.com.br/#pais-mbway
