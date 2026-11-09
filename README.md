# PRISMA IA · Sales OS no WhatsApp

Plataforma de automação de vendas por WhatsApp para operações de serviço e comércio: funil por nicho,
qualificação com score, cadências de follow-up, disparo em massa com trava antispam, cashback, logística e
relatórios.

Roda **sem nenhuma credencial** em modo sandbox: as mensagens são registradas no banco e aparecem na inbox, mas
nada sai da máquina. Configure a WhatsApp Cloud API para enviar de verdade.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3100
```

O banco SQLite (`./data/fluxo.db`) é criado e populado com dados de demonstração no primeiro acesso
(9 nichos, ~64 leads, conversas, pedidos e follow-ups).

Produção:

```bash
npm run build
npm start
```

## Binário do app (fora do repositório)

O executável `Kraken Free Buff.exe` tem ~260 MB — acima do limite de 100 MB por arquivo do GitHub — e por isso
não é versionado. O histórico do repositório foi reescrito para removê-lo e o arquivo é distribuído à parte,
como asset de release (ou qualquer URL direta).

Ele vive em `vendor/`, que é ignorado pelo Git (`*.exe` também), e é obtido sob demanda:

```bash
# configure KRAKEN_EXE_URL em .env (o SHA-256 da build atual já está em .env.example)
npm run kraken:download              # baixa se ainda não existir
npm run kraken:download -- --force   # rebaixa
```

O script grava primeiro em `.part` e só promove o arquivo quando o SHA-256 confere, então um download
interrompido nunca deixa um binário quebrado em `vendor/`.

Para publicar uma nova build (uma vez, com o GitHub CLI):

```bash
gh release create v0.1.0 "Kraken Free Buff.exe" --title "Kraken Free Buff v0.1.0" --notes "binário do app"
```

Copie a URL do asset exibida pelo `gh` para `KRAKEN_EXE_URL` e atualize `KRAKEN_EXE_SHA256` se a build mudou.

## WhatsApp oficial (Meta Cloud API)

1. Crie um app Business em `developers.facebook.com` e adicione o produto WhatsApp.
2. Registre o número e gere um token permanente (System User).
3. Copie `.env.example` para `.env.local` e preencha `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.
4. Aponte o webhook para `https://seu-dominio/api/webhooks/whatsapp` e valide com `WHATSAPP_VERIFY_TOKEN`.
5. Opcional: `WHATSAPP_APP_SECRET` ativa a validação da assinatura `X-Hub-Signature-256`.

Sem as duas primeiras variáveis o app permanece em sandbox — o rodapé da sidebar mostra o modo ativo.

> Fora da janela de 24h da conversa a Meta exige **template aprovado**. As cadências usam texto livre, então
> funcionam dentro da janela ou em sandbox; para reengajamento frio, crie templates no WhatsApp Manager e troque
> o adaptador `lib/whatsapp.ts` para enviar `type: "template"`.

## IA de atendimento

A persona vive em `lib/ai-persona.ts`. Ela não é um "chatbot simpático": é um vendedor consultivo com
regras duras de conduta.

- **Tom**: humano, caloroso, confiante, português brasileiro natural, WhatsApp (até 3 parágrafos curtos).
- **Respeito (inegociável)**: mesmo tratamento para todas as pessoas, sem comentário sobre características
  protegidas, sem corrigir o português do cliente, sem repetir ofensa recebida.
- **Honestidade**: só usa dados do contexto (oferta, objeções, respostas de qualificação, cashback). Se faltar
  informação, diz que vai confirmar — nunca inventa preço, prazo ou estoque, nunca promete resultado.
- **Técnica**: diagnostica antes de ofertar, valida a objeção antes de argumentar, uma pergunta por mensagem,
  sempre propõe um próximo passo concreto, sem pressão e sem escassez falsa.
- **LGPD**: não pede CPF nem dado sensível no chat.

Três modos por lead (coluna `ai_mode`): `auto` (responde sozinha), `copilot` (sugere, humano revisa e envia) e
`off`. O botão **Sugerir com IA** na inbox gera o rascunho já com o histórico da conversa.

Escalonamento: se o cliente pedir uma pessoa, reclamar, falar de processo ou ameaçar cancelar, a IA acolhe,
avisa que vai chamar alguém do time e **se desliga sozinha** naquele lead (`ai_mode = copilot`).

### Provedor

Qualquer API compatível com OpenAI funciona, porque a chamada é um `fetch` direto em `/chat/completions`
(`lib/ai.ts`) — sem SDK, sem dependência nova.

```bash
AI_API_KEY=sua_chave
AI_API_BASE=https://api.z.ai/api/paas/v4   # ou https://freebuff.com/api/v1/paid
AI_MODEL=glm-4-flash
```

Sem chave configurada, entra o **simulador local**: respostas determinísticas a partir do playbook do nicho,
marcadas como "simulação" na interface. Serve para demonstrar o fluxo sem custo e sem rede.

## Pagamentos

Cobrança com link público (`/pagar/<código>`), PIX Copia e Cola e liberação automática da venda.

1. A cobrança é criada em `/pagamentos` e o link sai no WhatsApp do cliente.
2. No checkout, o cliente copia o BR Code (gerador EMV/CRC16 próprio em `lib/pix.ts`) ou paga pelo link do
   provedor.
3. A confirmação chega por webhook (`/api/webhooks/payments`), o pedido nasce em **separação** e o cashback do
   nicho é calculado.
4. O cliente recebe a confirmação no WhatsApp; a etapa do lead avança quando o nicho tem etapa de pago.

```bash
MERCADOPAGO_ACCESS_TOKEN=seu_token
PIX_KEY=sua_chave_pix
```

Sem token, roda em **sandbox**: o BR Code é gerado localmente (chave fictícia, não movimenta dinheiro) e o
checkout tem o botão "Simular pagamento aprovado" para exercitar a automação inteira.

Para trocar de provedor (Asaas, Pagar.me, Stripe), reescreva `createCharge` em `lib/payments.ts` e o parse do
webhook — o resto do sistema consome apenas `confirmPayment`.

## Entradas de lead

| Endpoint | Uso |
| --- | --- |
| `POST /api/leads` | Cria lead + dispara abertura e agenda a cadência. `x-api-key` opcional (`INTAKE_API_KEY`). |
| `GET|POST /api/webhooks/whatsapp` | Handshake e recebimento da Cloud API. `?vertical=` define o nicho do número. |
| `GET|POST /api/cron/cadences` | Roda os follow-ups vencidos. Proteja com `CRON_SECRET` (`Authorization: Bearer`). |
| `POST /api/webhooks/payments` | Confirmação do Mercado Pago. Só libera pedido com status `approved`. |
| `/captar/<nicho>` | Formulário público por nicho, com origem e opt-in registrados. |

```bash
curl -X POST http://localhost:3100/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Bruna Almeida","phone":"+5511987654321","vertical":"moda-atacado","source":"Instagram","value":2400,"answers":{"volume":"Acima de 100 peças"}}'
```

## Nichos com playbook completo

Imobiliárias · Moda atacado · Moda varejo · Estética · Odontologia · Automotivo · Restaurantes · Advocacia ·
Contabilidade.

Cada nicho define, em `lib/verticals.ts`: etapas do funil com probabilidade, perguntas de qualificação
ponderadas, cadência de 5 toques com objetivo por mensagem, regra de cashback, KPIs de referência, canais e
tratamento das 3 objeções mais comuns.

Dois nichos **não** usam cashback de propósito: advocacia (Provimento 205/2021 da OAB veda captação com vantagem
financeira) e contabilidade (CFC veda compartilhamento de honorários). Nesses casos a alavanca é desconto na
primeira mensalidade ou conteúdo.

## Radar · inteligência de anúncios

Módulo de pesquisa de anúncios de concorrentes, no mesmo workspace. Funciona **sem credencial** numa base de
demonstração sintética (≈230 anúncios, 30 anunciantes, 10 nichos) e passa a puxar dados reais quando uma fonte
está configurada.

| Rota | Uso |
| --- | --- |
| `/radar` | Busca com filtros (texto, rede, país, gênero, idade, duração, engajamento, CTA, stack, domínio, oferta de afiliado) |
| `/radar/anuncio/<id>` | Criativo, curva de curtidas, clones do mesmo criativo e brief de exploração |
| `/radar/tendencias` | Ganchos, landers, CTAs e formatos com melhor score médio |
| `/radar/marcas` | Anunciantes monitorados com histórico de novos anúncios |
| `/radar/alertas` | Anúncio novo, criativo clonado e novo vencedor |
| `/radar/colecoes` | Pranchas de referência (swipe file) |
| `/radar/fontes` | Status de cada fonte, histórico de sincronização e execução manual |
| `GET /api/radar/ads?q=...` | Mesma busca em JSON (paginada) para integrar com outro sistema |
| `GET|POST /api/radar/sync?fonte=meta` | Ingestão agendável (`Authorization: Bearer $CRON_SECRET`) |

**Fontes:**

```bash
META_AD_LIBRARY_TOKEN=token_da_ad_library   # cobertura comercial: UE + Reino Unido
META_AD_LIBRARY_COUNTRIES=PT,IE,ES,DE,FR
TIKTOK_CLIENT_KEY=...                       # TikTok Commercial Content API (UE)
TIKTOK_CLIENT_SECRET=...
```

A importação por JSON (`fonte=import`) aceita qualquer exportação de anúncios, então dá para alimentar o índice
com um coletor próprio. Sem token, cada fonte aparece como `sandbox` na tela de Fontes — nada é inventado como se
fosse dado real.

**Winning Score** (`lib/radar/score.ts`) é o diferencial em relação a ordenar por curtida crua: longevidade no ar,
velocidade de engajamento por dia, aceleração da última semana, número de variantes, qualidade do destino
(lander + stack + CTA) e penalidade de saturação (quantas contas copiaram o mesmo criativo). Anúncio novo com
curtida comprada não sobe; anúncio velho que voltou a acelerar, sim.

O índice de busca é **SQLite FTS5** (`unicode61 remove_diacritics`) sobre texto, título, lander, anunciante e
comentários: buscar "coleção" encontra "colecao" e a consulta roda em ~1–2 ms em 230 anúncios.

## Arquitetura

- **Next.js 15 (App Router) + React 19 + Tailwind v4**, tudo server-rendered com Server Actions.
- **SQLite via `node:sqlite`** — zero dependência nativa. Camada de acesso isolada em `lib/queries.ts` e
  `lib/ingest.ts`, o que permite trocar por Postgres/D1 sem tocar na UI.
- **`lib/whatsapp.ts`** é o único ponto que fala com a Meta. Trocar por Twilio/360dialog é reescrever esse arquivo.
- **Motor de cadência** idempotente: cada follow-up tem `status`, `due_at` e template; rodar duas vezes não
  duplica envio.

## Guardrails aplicados

- Só leads com `opted_in = 1` entram em disparo em massa.
- Máximo de 200 contatos por campanha e 1 mensagem por lead a cada 24h.
- Etapa terminal (ganho/perdido) encerra follow-ups pendentes.
- Webhook valida assinatura HMAC quando `WHATSAPP_APP_SECRET` está definido.
- Nenhum token é gravado no banco ou no repositório; tudo vem de variável de ambiente.

## Limites conhecidos

- Autenticação/usuários ainda não implementados: é um único workspace. Para multiusuário, adicione login e
  escopo por `user_id` em `leads`, `orders` e `followups`.
- Sem upload de mídia (imagem/PDF) nas mensagens.
- O cron não está agendado: use o endpoint em um agendador externo.
- Sem chave de IA a resposta é simulada (determinística), não gerada por modelo.
- Boleto é apenas registrado no pedido; a emissão real depende do provedor escolhido.
- Integração com Instagram/Facebook é por URL de captação e webhook de Lead Ads; não há OAuth de conta.
