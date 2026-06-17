import { getPriceHistory } from "@/lib/data/prices";
import { getCompanyFilings, getCompanyFinancials, getCompanyProfile } from "@/lib/data/sec";
import { buildBigFive, calculateValuation, deriveBusinessGrade, deriveDefaultAssumptions } from "@/lib/rule1";
import type { AnnualFinancials, FilingLink, PriceHistory, RuleOneEvaluation } from "@/lib/types";

type EvaluateCompanyOptions = {
  includeFilings?: boolean;
};

function manualPriceHistory(symbol: string, reason?: string): PriceHistory {
  return {
    symbol: symbol.toUpperCase(),
    history: [],
    source: {
      label: "Manual price required",
      confidence: "low",
      note: reason,
    },
  };
}

export async function evaluateCompany(
  symbol: string,
  { includeFilings = false }: EvaluateCompanyOptions = {},
): Promise<RuleOneEvaluation> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const profile = await getCompanyProfile(normalizedSymbol);
  const [factsResult, pricesResult, filingsResult] = await Promise.allSettled([
    getCompanyFinancials(normalizedSymbol),
    getPriceHistory(normalizedSymbol),
    includeFilings ? getCompanyFilings(normalizedSymbol) : Promise.resolve([] as FilingLink[]),
  ]);
  const financials =
    factsResult.status === "fulfilled" ? factsResult.value : ([] as AnnualFinancials[]);
  const prices =
    pricesResult.status === "fulfilled"
      ? pricesResult.value
      : manualPriceHistory(
          normalizedSymbol,
          pricesResult.status === "rejected" && pricesResult.reason instanceof Error
            ? pricesResult.reason.message
            : undefined,
        );
  const filings = filingsResult.status === "fulfilled" ? filingsResult.value : [];
  const bigFive = buildBigFive(financials);
  const assumptions = deriveDefaultAssumptions(financials, prices.latest?.close ?? 0);
  const businessGrade = deriveBusinessGrade({ bigFive });
  const valuation = calculateValuation(assumptions, businessGrade);

  return {
    profile,
    financials,
    prices,
    filings,
    bigFive,
    assumptions,
    valuation,
    loadedAt: new Date().toISOString(),
  };
}
