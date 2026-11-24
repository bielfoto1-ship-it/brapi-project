# brapi-project

Integração com a API [brapi.dev](https://brapi.dev) (rotas `/api/v2`), para dados
do mercado financeiro brasileiro.

## Configuração

1. Copie `.env.example` para `.env` e preencha com sua chave:

   ```bash
   cp .env.example .env
   ```

2. Exporte a variável de ambiente antes de rodar (ou use um carregador de
   `.env`, como `node --env-file=.env`):

   ```bash
   export BRAPI_TOKEN="sua_chave_aqui"
   ```

   A chave **nunca** é lida do código-fonte nem deve ser commitada — o
   `.gitignore` já ignora `.env`.

## Uso

```bash
node --env-file=.env src/testQuote.js
# ou, se já tiver exportado BRAPI_TOKEN no shell:
npm run test:quote
```

PETR4, MGLU3, VALE3 e ITUB4 respondem mesmo sem token (limite de teste da
própria brapi); qualquer outro ticker exige `BRAPI_TOKEN` configurado.

## Estrutura

- `src/brapiClient.js` — cliente mínimo: monta a URL com `symbols`, envia
  `Authorization: Bearer <BRAPI_TOKEN>`, e trata erros 401 (token ausente ou
  inválido), 404 (recurso não encontrado) e 429 (limite de requisições,
  respeitando o header `Retry-After` para uma nova tentativa automática em
  esperas curtas).
- `src/testQuote.js` — script de teste que busca a cotação de PETR4 e VALE3
  em uma única chamada (parâmetro `symbols=PETR4,VALE3`).

## Referência

- Índice de endpoints: https://brapi.dev/llms.txt
- Contrato OpenAPI: https://brapi.dev/openapi.json
- Dicionário de campos: https://brapi.dev/api/v2/dictionary
