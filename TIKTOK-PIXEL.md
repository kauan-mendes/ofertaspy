# TikTok Pixel — DBSI5UJC77U7CBT61SDG

A base comum fica em `assets/js/tiktok-pixel.js`, carregada uma vez em `index.html` e `checkout.html`. O checkout carrega a base antes do código que consulta o pagamento. A Content Security Policy autoriza os endpoints TikTok utilizados, incluindo o endpoint IPv6 documentado.

| Evento | Momento |
|---|---|
| PageView (`ttq.page`) | Cada carregamento de página |
| ViewContent | Apresentação, passos do funil e checkout |
| InitiateCheckout | Abertura do formulário final ou acesso direto ao checkout; uma vez por jornada no separador |
| Lead | Envio válido de nome/e-mail no formulário de entrada do checkout, sem enviar esses dados como parâmetros |
| AddPaymentInfo | Formulário MB WAY válido submetido; uma vez por referência de pedido |
| Purchase | Resposta atual e bem-sucedida da API de estado indicando `paid`, sem erro, com 990 cêntimos e moeda EUR |

Purchase envia `value: 9.90`, `currency: EUR`, o identificador fixo do produto e um `event_id` estável por pedido. Não envia o token do pedido, nome, e-mail, telefone, NIF, nome de utilizador Instagram nem conteúdo do relatório. Não foi configurado `identify` nem correspondência avançada manual.

Não existem carrinho, inscrição ou subscrição neste fluxo: não são gerados eventos de ações que não ocorreram. Criar o pedido MB WAY não equivale a comprar; estados pending, review, rejected, refunded ou chargeback não disparam Purchase.

A compra não é disparada apenas por dados restaurados de sessionStorage: é necessária nova confirmação da API. A deduplicação utiliza memória/localStorage e event_id para evitar repetições em atualizações ou no polling. Se o armazenamento estiver indisponível, o mesmo event_id permite deduplicação pelo TikTok dentro da janela suportada pelo fornecedor.

Os eventos aguardam o carregamento do SDK. Se o SDK falhar, a base tenta carregá-lo mais duas vezes. Nenhum marcador de compra é gravado antes de o SDK carregar. Isso não equivale a confirmação de receção pelo TikTok: o pixel não fornece um recibo de entrega ao código da aplicação.

## Validar depois do deploy

1. Confirme a versão `1.0.3` em `/api/health`.
2. No TikTok Events Manager, abra a fonte de dados desse pixel e a opção Test Events/Pixel Helper.
3. Visite a apresentação e o checkout; confira PageView, ViewContent, InitiateCheckout e, ao enviar o formulário válido, AddPaymentInfo.
4. Purchase só deve aparecer após um pagamento real confirmado pelo servidor. Não force estado pago nem gere uma compra fictícia para popular o painel.
5. Recarregue a página: o pedido já pago não deve gerar uma nova compra nesse navegador.

## Limite e complemento para confirmação sem a página aberta

Pixel é JavaScript do navegador: bloqueadores, falta de rede, preferências de privacidade ou fechar a página antes do webhook podem impedir a compra de chegar ao TikTok. Não é possível garantir 100% de entrega só com o ID do pixel.

Para também enviar a compra pelo servidor, inclusive após fechar a página, é necessário configurar a TikTok Events API com um Access Token mantido no servidor. Essa parte não está ativa, pois não foi fornecido token. Ela deverá usar o mesmo event_id e o evento Purchase, com retentativas persistentes e deduplicação.

## Verificação realizada

Passaram 19 testes locais: regras de pagamento e assinatura, fila com SDK atrasado, deduplicação, estados que não podem gerar compra, dados guardados sem nova confirmação, compra confirmada pela API, cobertura das páginas e CSP. Os testes do pixel usam um SDK simulado e não enviam eventos fictícios ao TikTok. A receção no Events Manager e uma compra real precisam ser validadas após a publicação.

Referências oficiais:
- https://ads.tiktok.com/help/article/how-to-adopt-tiktoks-updated-standard-events?lang=pt
- https://ads.tiktok.com/help/article/standard-events-parameters?lang=pt
- https://ads.tiktok.com/help/article/event-deduplication?lang=en
- https://ads-useast2a.tiktok.com/resources/help/article/about-ipv6-support-for-tiktok-pixel?lang=en
