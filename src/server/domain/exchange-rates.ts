import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { exchangeRates } from "../db/schema";
import { isValidCurrency, currencyExponent } from "@/lib/money";
import { errors } from "@/lib/errors";
import { isIsoDate } from "@/lib/datetime";

export async function upsertRate(
  exec: Executor,
  input: { base: string; quote: string; rate: string; quotedOn: string }
): Promise<void> {
  const base = input.base.toUpperCase();
  const quote = input.quote.toUpperCase();
  if (!isValidCurrency(base) || !isValidCurrency(quote))
    throw errors.validation("Unknown currency code.");
  if (base === quote) throw errors.validation("Base and quote currencies must differ.");
  const rate = Number(input.rate);
  if (!Number.isFinite(rate) || rate <= 0)
    throw errors.validation("Rate must be a positive number.");
  if (!isIsoDate(input.quotedOn)) throw errors.validation("Quoted-on date must be YYYY-MM-DD.");
  await exec
    .insert(exchangeRates)
    .values({
      baseCurrency: base,
      quoteCurrency: quote,
      rate: input.rate,
      quotedOn: input.quotedOn
    })
    .onConflictDoUpdate({
      target: [exchangeRates.baseCurrency, exchangeRates.quoteCurrency, exchangeRates.quotedOn],
      set: { rate: input.rate }
    });
}

export async function getRate(
  exec: Executor,
  base: string,
  quote: string,
  onOrBefore: string
): Promise<string | null> {
  if (base.toUpperCase() === quote.toUpperCase()) return "1";
  const res = await exec.execute<{ rate: string }>(sql`
    SELECT rate::text AS rate FROM (
      SELECT rate, quoted_on FROM exchange_rates
      WHERE base_currency = ${base.toUpperCase()} AND quote_currency = ${quote.toUpperCase()}
        AND quoted_on <= ${onOrBefore}::date
      UNION ALL
      SELECT 1 / rate AS rate, quoted_on FROM exchange_rates
      WHERE base_currency = ${quote.toUpperCase()} AND quote_currency = ${base.toUpperCase()}
        AND quoted_on <= ${onOrBefore}::date
    ) pairs
    ORDER BY quoted_on DESC
    LIMIT 1
  `);
  return (res.rows ?? [])[0]?.rate ?? null;
}

export function convertMinor(
  amountMinor: number,
  rate: string | number,
  fromCurrency?: string,
  toCurrency?: string
): number {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) throw errors.validation("Invalid exchange rate.");

  let scale = 1;
  if (fromCurrency && toCurrency) {
    const fromExp = currencyExponent(fromCurrency);
    const toExp = currencyExponent(toCurrency);
    scale = 10 ** (toExp - fromExp);
  }

  const converted = amountMinor * r * scale;
  if (Math.abs(converted) > Number.MAX_SAFE_INTEGER) {
    throw errors.money("Converted amount exceeds the supported range.");
  }
  return converted >= 0 ? Math.round(converted) : -Math.round(-converted);
}
