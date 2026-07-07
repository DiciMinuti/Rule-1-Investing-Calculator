import { describe, expect, it } from "vitest";
import { buildDataAuditReport } from "@/lib/data/audit";
import { buildBigFive, deriveDefaultAssumptions } from "@/lib/rule1";
import type { AnnualFinancials, CompanyProfile, PriceHistory } from "@/lib/types";

const profile: CompanyProfile = {
  symbol: "KLAC",
  name: "KLA Corporation",
  cik: "0000319201",
  exchange: "Nasdaq",
  source: {
    label: "SEC company tickers",
    confidence: "high",
  },
};

const financials: AnnualFinancials[] = Array.from({ length: 11 }, (_, index) => {
  const fiscalYear = 2015 + index;
  const multiplier = (30.37 / 2.85) ** (index / 10);
  const sharesDiluted = 135;

  return {
    fiscalYear,
    revenue: 2_814 * multiplier,
    epsDiluted: fiscalYear === 2025 ? 30.37 : 2.85 * multiplier,
    sharesDiluted,
    stockholdersEquity: 1_000 * multiplier * sharesDiluted,
    freeCashFlow: 300 * multiplier * sharesDiluted,
    roic: 0.2,
    sourceFacts: {},
  };
});

const prices: PriceHistory = {
  symbol: "KLAC",
  latest: { date: "2026-07-07", close: 218.76 },
  history: Array.from({ length: 60 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 4, index + 1)).toISOString().slice(0, 10),
    open: 200 + index,
    high: 202 + index,
    low: 198 + index,
    close: 201 + index,
  })),
  splits: [{ date: "2026-06-12", numerator: 10, denominator: 1 }],
  source: {
    label: "Yahoo Finance public chart",
    confidence: "medium",
    period: "2026-07-07",
  },
};

describe("data audit report", () => {
  it("passes a KLAC-style post-split valuation when EPS is split-adjusted", () => {
    const bigFive = buildBigFive(financials, undefined, prices.splits);
    const assumptions = deriveDefaultAssumptions(financials, prices.latest?.close ?? 0, prices.history, prices.splits);
    const audit = buildDataAuditReport({
      profile,
      financials,
      prices,
      bigFive,
      assumptions,
      generatedAt: "2026-07-07T12:00:00.000Z",
    });

    expect(assumptions.eps).toBeCloseTo(3.037, 4);
    expect(audit.status).toBe("pass");
    expect(audit.checks.find((check) => check.id === "splitAdjustedValuation")).toMatchObject({
      status: "pass",
    });
  });

  it("fails when valuation EPS mixes pre-split EPS with post-split price data", () => {
    const bigFive = buildBigFive(financials, undefined, prices.splits);
    const assumptions = {
      ...deriveDefaultAssumptions(financials, prices.latest?.close ?? 0, prices.history, prices.splits),
      eps: 30.37,
    };
    const audit = buildDataAuditReport({
      profile,
      financials,
      prices,
      bigFive,
      assumptions,
      generatedAt: "2026-07-07T12:00:00.000Z",
    });

    expect(audit.status).toBe("fail");
    expect(audit.checks.find((check) => check.id === "splitAdjustedValuation")).toMatchObject({
      status: "fail",
    });
  });
});
