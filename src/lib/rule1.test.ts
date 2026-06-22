import { describe, expect, it } from "vitest";
import {
  buildBigFive,
  calculateCagr,
  calculateFreeCashFlow,
  calculateValuation,
  deriveDefaultAssumptions,
  deriveEps,
  futurePeFromGrowth,
  selectRuleOneGrowthRate,
} from "@/lib/rule1";

describe("Rule #1 calculations", () => {
  it("calculates CAGR for positive annual values", () => {
    expect(calculateCagr(100, 259.374, 10)).toBeCloseTo(0.1, 4);
  });

  it("returns null CAGR for zero, negative, or missing values", () => {
    expect(calculateCagr(0, 100, 5)).toBeNull();
    expect(calculateCagr(-10, 100, 5)).toBeNull();
    expect(calculateCagr(undefined, 100, 5)).toBeNull();
  });

  it("derives EPS from net income and diluted shares", () => {
    expect(deriveEps(10_000_000, 2_000_000)).toBe(5);
    expect(deriveEps(10_000_000, 0)).toBeUndefined();
  });

  it("handles capex sign conventions for free cash flow", () => {
    expect(calculateFreeCashFlow(100, 30)).toBe(70);
    expect(calculateFreeCashFlow(100, -30)).toBe(70);
  });

  it("uses the lower of historical PE and two-times growth PE", () => {
    expect(futurePeFromGrowth(0.12)).toBe(24);
    expect(futurePeFromGrowth(0.12, 18)).toBe(18);
    expect(futurePeFromGrowth(0.12, 40)).toBe(24);
  });

  it("uses the lower historical or analyst growth rate with a 15% auto cap", () => {
    expect(selectRuleOneGrowthRate(0.12, undefined)).toBe(0.12);
    expect(selectRuleOneGrowthRate(0.12, 0.08)).toBe(0.08);
    expect(selectRuleOneGrowthRate(0.25, undefined)).toBe(0.15);
  });

  it("calculates sticker price, MOS price, and pass verdict", () => {
    const result = calculateValuation(
      {
        eps: 5,
        growthRate: 0.1,
        futurePe: 20,
        requiredReturn: 0.15,
        years: 10,
        marginOfSafety: 0.5,
        currentPrice: 25,
      },
      "strong",
    );

    expect(result.futureEps).toBeCloseTo(12.9687, 4);
    expect(result.stickerPrice).toBeCloseTo(64.11, 2);
    expect(result.mosPrice).toBeCloseTo(32.06, 2);
    expect(result.priceVerdict).toBe("pass");
  });

  it("uses almost between MOS and sticker, then nope above sticker", () => {
    const base = {
      eps: 5,
      growthRate: 0.1,
      futurePe: 20,
      requiredReturn: 0.15,
      years: 10,
      marginOfSafety: 0.5,
    };

    expect(calculateValuation({ ...base, currentPrice: 35 }, "middle").priceVerdict).toBe("almost");
    expect(calculateValuation({ ...base, currentPrice: 65 }, "middle").priceVerdict).toBe("nope");
  });

  it("uses 10-year EPS growth and historical PE for default valuation assumptions", () => {
    const financials = Array.from({ length: 11 }, (_, index) => {
      const fiscalYear = 2015 + index;
      const epsDiluted = 5 * 1.12 ** index;
      return { fiscalYear, epsDiluted, sourceFacts: {} };
    });
    const priceHistory = financials.map((row) => ({
      date: `${row.fiscalYear}-12-31`,
      close: (row.epsDiluted ?? 0) * 18,
    }));
    const assumptions = deriveDefaultAssumptions(
      financials,
      priceHistory.at(-1)?.close ?? 0,
      priceHistory,
    );

    expect(assumptions.historicalGrowthRate).toBeCloseTo(0.12, 4);
    expect(assumptions.growthRate).toBeCloseTo(0.12, 4);
    expect(assumptions.historicalPe).toBeCloseTo(18, 2);
    expect(assumptions.futurePe).toBeCloseTo(18, 2);
  });

  it("uses the lower analyst growth estimate when provided", () => {
    const financials = Array.from({ length: 11 }, (_, index) => {
      const fiscalYear = 2015 + index;
      const epsDiluted = 4 * 1.12 ** index;
      return { fiscalYear, epsDiluted, sourceFacts: {} };
    });
    const priceHistory = financials.map((row) => ({
      date: `${row.fiscalYear}-12-31`,
      close: (row.epsDiluted ?? 0) * 25,
    }));
    const assumptions = deriveDefaultAssumptions(
      financials,
      priceHistory.at(-1)?.close ?? 0,
      priceHistory,
      { analystGrowthRate: 0.08 },
    );

    expect(assumptions.growthRate).toBeCloseTo(0.08, 4);
    expect(assumptions.futurePe).toBeCloseTo(16, 2);
  });

  it("caps automatic growth at 15%", () => {
    const assumptions = deriveDefaultAssumptions(
      Array.from({ length: 11 }, (_, index) => ({
        fiscalYear: 2015 + index,
        epsDiluted: 2 * 1.25 ** index,
        sourceFacts: {},
      })),
      100,
    );

    expect(assumptions.historicalGrowthRate).toBeCloseTo(0.25, 4);
    expect(assumptions.growthRate).toBeCloseTo(0.15, 4);
    expect(assumptions.futurePe).toBeCloseTo(30, 2);
  });

  it("scores Big Five with healthy threshold logic", () => {
    const financials = Array.from({ length: 6 }, (_, index) => {
      const year = 2019 + index;
      const multiplier = 1.12 ** index;
      return {
        fiscalYear: year,
        revenue: 100 * multiplier,
        netIncome: 20 * multiplier,
        epsDiluted: 2 * multiplier,
        sharesDiluted: 10,
        stockholdersEquity: 80 * multiplier,
        operatingCashFlow: 25 * multiplier,
        capex: 5,
        freeCashFlow: 20 * multiplier,
        investedCapital: 100,
        roic: 0.2,
        sourceFacts: {},
      };
    });

    const bigFive = buildBigFive(financials);
    expect(bigFive.healthyCount).toBe(5);
    expect(bigFive.businessContribution).toBe("strong");
  });

  it("uses the ROIC source label from normalized financials", () => {
    const bigFive = buildBigFive([
      {
        fiscalYear: 2025,
        roic: 0.2,
        sourceFacts: {
          roic: {
            label: "Net income / equity (financial business proxy)",
            confidence: "medium",
          },
        },
      },
    ]);

    expect(bigFive.metrics[0].sourceLabel).toBe("Net income / equity (financial business proxy)");
  });
});
