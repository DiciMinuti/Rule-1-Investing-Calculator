import { getPriceHistory } from "@/lib/data/prices";
import { getCompanyFilings, getCompanyFinancials, getCompanyProfile } from "@/lib/data/sec";
import { buildDataAuditReport } from "@/lib/data/audit";
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
  const bigFive = buildBigFive(financials, undefined, prices.splits);
  const assumptions = deriveDefaultAssumptions(
    financials,
    prices.latest?.close ?? 0,
    prices.history,
    prices.splits,
  );
  const businessGrade = deriveBusinessGrade({ bigFive });
  const valuation = calculateValuation(assumptions, businessGrade);
  const loadedAt = new Date().toISOString();
  const audit = buildDataAuditReport({
    profile,
    financials,
    prices,
    bigFive,
    assumptions,
    generatedAt: loadedAt,
  });

  return {
    profile,
    financials,
    prices,
    filings,
    bigFive,
    assumptions,
    valuation,
    audit,
    loadedAt,
  };
}
