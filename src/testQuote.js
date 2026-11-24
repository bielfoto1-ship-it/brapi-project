import { getQuote, BrapiError } from "./brapiClient.js";

const symbols = ["PETR4", "VALE3"];

try {
  const quotes = await getQuote(symbols);

  for (const quote of quotes) {
    if (!quote.data) {
      console.log(`${quote.requestedSymbol}: sem dados retornados pela brapi.`);
      continue;
    }

    const {
      longName,
      regularMarketPrice,
      regularMarketChangePercent,
      regularMarketTime,
      currency,
    } = quote.data;

    console.log(
      `${quote.symbol} (${longName ?? "nome indisponível"}): ` +
        `${regularMarketPrice ?? "N/A"} ${currency ?? ""} ` +
        `(${regularMarketChangePercent ?? "N/A"}%) em ${regularMarketTime ?? "data indisponível"}`,
    );
  }
} catch (err) {
  if (err instanceof BrapiError) {
    console.error(`Erro da brapi [${err.status}${err.code ? ` ${err.code}` : ""}]: ${err.message}`);
    if (err.retryAfterSeconds !== undefined) {
      console.error(`Retry-After: ${err.retryAfterSeconds}s`);
    }
    process.exitCode = 1;
  } else {
    throw err;
  }
}
