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
    expect(selectRuleOneGrowthRate(-0.02, 0.08)).toBe(0.08);
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
      [],
      { analystGrowthRate: 0.08 },
    );

    expect(assumptions.growthRate).toBeCloseTo(0.08, 4);
    expect(assumptions.futurePe).toBeCloseTo(16, 2);
  });

  it("uses analyst growth when historical EPS growth is negative", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        { fiscalYear: 2015, epsDiluted: 10, sourceFacts: {} },
        { fiscalYear: 2020, epsDiluted: 12, sourceFacts: {} },
        { fiscalYear: 2025, epsDiluted: 8, sourceFacts: {} },
      ],
      100,
      [],
      [],
      { analystGrowthRate: 0.07 },
    );

    expect(assumptions.historicalGrowthRate).toBeLessThan(0);
    expect(assumptions.growthRate).toBeCloseTo(0.07, 4);
    expect(assumptions.futurePe).toBeCloseTo(14, 2);
  });

  it("falls back to the longest usable positive EPS growth when 10-year CAGR cannot be calculated", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        { fiscalYear: 2015, epsDiluted: -0.84, sourceFacts: {} },
        { fiscalYear: 2020, epsDiluted: 2.06, sourceFacts: {} },
        { fiscalYear: 2025, epsDiluted: 2.65, sourceFacts: {} },
      ],
      100,
    );

    expect(assumptions.historicalGrowthRate).toBeCloseTo((2.65 / 2.06) ** (1 / 5) - 1, 4);
    expect(assumptions.growthRate).toBeGreaterThan(0);
    expect(assumptions.futurePe).toBeGreaterThan(0);
  });

  it("adjusts old EPS for stock splits before calculating 10-year growth", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        { fiscalYear: 2015, epsDiluted: 9.22, sourceFacts: {} },
        { fiscalYear: 2025, epsDiluted: 7.46, sourceFacts: {} },
      ],
      298.84,
      [],
      [{ date: "2020-08-31", numerator: 4, denominator: 1 }],
    );

    expect(assumptions.historicalGrowthRate).toBeCloseTo(0.1246, 4);
    expect(assumptions.growthRate).toBeCloseTo(0.1246, 4);
    expect(assumptions.futurePe).toBeCloseTo(24.92, 2);
  });

  it("uses split-adjusted EPS growth in Big Five results", () => {
    const bigFive = buildBigFive(
      [
        { fiscalYear: 2015, epsDiluted: 9.22, sourceFacts: {} },
        { fiscalYear: 2025, epsDiluted: 7.46, sourceFacts: {} },
      ],
      undefined,
      [{ date: "2020-08-31", numerator: 4, denominator: 1 }],
    );
    const epsGrowth = bigFive.metrics.find((metric) => metric.id === "epsGrowth");

    expect(epsGrowth?.windows[10].value).toBeCloseTo(0.1246, 4);
    expect(epsGrowth?.status).toBe("healthy");
  });

  it("uses split-adjusted EPS when calculating historical PE", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        { fiscalYear: 2015, epsDiluted: 9.22, sourceFacts: {} },
        { fiscalYear: 2025, epsDiluted: 7.46, sourceFacts: {} },
      ],
      186.5,
      [
        { date: "2015-12-31", close: 46.1 },
        { date: "2025-12-31", close: 186.5 },
      ],
      [{ date: "2020-08-31", numerator: 4, denominator: 1 }],
    );

    expect(assumptions.historicalPe).toBeCloseTo(22.5, 1);
    expect(assumptions.futurePe).toBeCloseTo(22.5, 1);
  });

  it("uses split-adjusted EPS for default valuation inputs after a later split", () => {
    const assumptions = deriveDefaultAssumptions(
      [{ fiscalYear: 2025, epsDiluted: 30.37, sourceFacts: {} }],
      218.76,
      [],
      [{ date: "2026-06-12", numerator: 10, denominator: 1 }],
      { growthRate: 0.15, futurePe: 30 },
    );

    expect(assumptions.eps).toBeCloseTo(3.037, 4);
    expect(calculateValuation(assumptions, "strong").stickerPrice).toBeLessThan(300);
  });

  it("does not mix total equity into a book-value-per-share series", () => {
    const bigFive = buildBigFive(
      [
        { fiscalYear: 2024, stockholdersEquity: 1_000, sharesDiluted: 100, sourceFacts: {} },
        { fiscalYear: 2025, stockholdersEquity: 1_200, sharesDiluted: 100, sourceFacts: {} },
        { fiscalYear: 2026, stockholdersEquity: 1_500, sourceFacts: {} },
      ],
      undefined,
      [],
    );
    const equityGrowth = bigFive.metrics.find((metric) => metric.id === "equityGrowth");

    expect(equityGrowth?.values).toEqual([
      { fiscalYear: 2024, value: 10 },
      { fiscalYear: 2025, value: 12 },
      { fiscalYear: 2026, value: null },
    ]);
    expect(equityGrowth?.windows[1].value).toBeCloseTo(0.2, 4);
  });

  it("uses TTM EPS before latest annual EPS for default valuation EPS", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        { fiscalYear: 2025, epsDiluted: 4.9, sourceFacts: {} },
        { fiscalYear: 2026, ttmEpsDiluted: 5.4, netIncome: 120_000_000_000, sourceFacts: {} },
      ],
      200,
    );

    expect(assumptions.eps).toBe(5.4);
  });

  it("falls back to the latest annual row with EPS when TTM EPS is unavailable", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        { fiscalYear: 2025, epsDiluted: 4.9, sourceFacts: {} },
        { fiscalYear: 2026, netIncome: 120_000_000_000, sourceFacts: {} },
      ],
      200,
    );

    expect(assumptions.eps).toBe(4.9);
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
