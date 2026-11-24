/**
 * Cliente mínimo para a API brapi.dev (rotas /api/v2).
 *
 * Autenticação: a chave é lida da variável de ambiente BRAPI_TOKEN em tempo de
 * execução e nunca deve ser hardcoded, exposta no frontend ou commitada no
 * repositório. Sem chave, apenas PETR4, MGLU3, VALE3 e ITUB4 respondem
 * (limite documentado pela própria brapi para teste gratuito).
 *
 * Docs usadas como referência: https://brapi.dev/llms.txt e
 * https://brapi.dev/openapi.json (consulte https://brapi.dev/api/v2/dictionary
 * para o significado de cada campo retornado).
 */

const BASE_URL = "https://brapi.dev/api/v2";

export class BrapiError extends Error {
  constructor(message, { status, code, retryAfterSeconds } = {}) {
    super(message);
    this.name = "BrapiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getToken() {
  // Lida sob demanda (não no import) para refletir mudanças no ambiente
  // sem precisar reiniciar o processo, e para nunca persistir a chave em
  // uma constante de módulo.
  return process.env.BRAPI_TOKEN;
}

function parseRetryAfter(headerValue) {
  if (!headerValue) return undefined;
  const asSeconds = Number(headerValue);
  if (!Number.isNaN(asSeconds)) return asSeconds;
  // Retry-After também pode vir como data HTTP (RFC 7231)
  const asDate = new Date(headerValue).getTime();
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.round((asDate - Date.now()) / 1000));
  }
  return undefined;
}

async function brapiRequest(path, searchParams, { retryOn429 = true } = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
    if (retryOn429 && retryAfterSeconds !== undefined && retryAfterSeconds <= 30) {
      // Respeita o Retry-After uma única vez para esperas curtas; para
      // esperas longas, repassa o erro para quem chamou decidir.
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return brapiRequest(path, searchParams, { retryOn429: false });
    }
    let body;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new BrapiError(
      body?.message || "Limite de requisições da brapi atingido (429).",
      { status: 429, code: body?.code || "RATE_LIMITED", retryAfterSeconds },
    );
  }

  if (response.status === 401) {
    const body = await safeJson(response);
    throw new BrapiError(
      body?.message ||
        "Token da brapi ausente ou inválido (401). Defina a variável de ambiente BRAPI_TOKEN.",
      { status: 401, code: body?.code || "UNAUTHORIZED" },
    );
  }

  if (response.status === 404) {
    const body = await safeJson(response);
    throw new BrapiError(
      body?.message || "Recurso não encontrado na brapi (404). Confira o(s) ticker(s) informado(s).",
      { status: 404, code: body?.code || "NOT_FOUND" },
    );
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new BrapiError(
      body?.message || `Erro inesperado da brapi (HTTP ${response.status}).`,
      { status: response.status, code: body?.code },
    );
  }

  return safeJson(response);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Busca cotação atual de um ou mais tickers em uma única chamada.
 * @param {string[]} symbols - ex.: ["PETR4", "VALE3"]
 * @returns {Promise<Array<{symbol: string, requestedSymbol: string, data: object|null}>>}
 *   Um item por ticker pedido. `data` vem `null` quando a brapi não retornou
 *   informação para aquele símbolo (campo ausente/null tratado explicitamente
 *   em vez de deixar o chamador estourar em `undefined.algumCampo`).
 */
export async function getQuote(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error("getQuote precisa de pelo menos um ticker em `symbols`.");
  }

  const json = await brapiRequest("/stocks/quote", {
    symbols: symbols.join(","),
  });

  const results = Array.isArray(json?.results) ? json.results : [];

  // Normaliza: garante um item por símbolo pedido, mesmo que a brapi omita
  // algum, e nunca deixa `data` como `undefined`.
  return symbols.map((requested) => {
    const found = results.find(
      (item) => item?.requestedSymbol === requested || item?.symbol === requested,
    );
    return {
      requestedSymbol: requested,
      symbol: found?.symbol ?? requested,
      data: found?.data ?? null,
    };
  });
}
