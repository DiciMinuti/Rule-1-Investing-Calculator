import { describe, expect, it } from "vitest";
import {
  buildBigFive,
  calculateCagr,
  calculateFreeCashFlow,
  calculateValuation,
  deriveDefaultAssumptions,
  deriveEps,
  futurePeFromGrowth,
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

  it("turns decimal growth into a two-times-growth PE correctly", () => {
    expect(futurePeFromGrowth(0.12)).toBe(24);
    expect(futurePeFromGrowth(0.4)).toBe(50);
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
        almostBand: 0.15,
      },
      "strong",
    );

    expect(result.futureEps).toBeCloseTo(12.9687, 4);
    expect(result.stickerPrice).toBeCloseTo(64.11, 2);
    expect(result.mosPrice).toBeCloseTo(32.06, 2);
    expect(result.priceVerdict).toBe("pass");
  });

  it("uses almost and nope around the MOS threshold", () => {
    const base = {
      eps: 5,
      growthRate: 0.1,
      futurePe: 20,
      requiredReturn: 0.15,
      years: 10,
      marginOfSafety: 0.5,
      almostBand: 0.15,
    };

    expect(calculateValuation({ ...base, currentPrice: 35 }, "middle").priceVerdict).toBe("almost");
    expect(calculateValuation({ ...base, currentPrice: 45 }, "middle").priceVerdict).toBe("nope");
  });

  it("prefers longer-term EPS growth for default valuation assumptions", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        { fiscalYear: 2013, epsDiluted: 4.88, sourceFacts: {} },
        { fiscalYear: 2020, epsDiluted: 3.77, sourceFacts: {} },
        { fiscalYear: 2021, epsDiluted: 10.02, sourceFacts: {} },
        { fiscalYear: 2022, epsDiluted: 9.85, sourceFacts: {} },
        { fiscalYear: 2023, epsDiluted: 11.21, sourceFacts: {} },
        { fiscalYear: 2024, epsDiluted: 14.01, sourceFacts: {} },
        { fiscalYear: 2025, epsDiluted: 15.38, sourceFacts: {} },
      ],
      340.54,
    );

    expect(assumptions.growthRate).toBeCloseTo(0.1004, 4);
    expect(assumptions.futurePe).toBeCloseTo(20.08, 2);
  });

  it("tempers EPS rebound growth when broader business metrics grow slower", () => {
    const assumptions = deriveDefaultAssumptions(
      [
        {
          fiscalYear: 2020,
          revenue: 100,
          epsDiluted: 3.77,
          sharesDiluted: 1,
          stockholdersEquity: 100,
          freeCashFlow: 10,
          sourceFacts: {},
        },
        {
          fiscalYear: 2025,
          revenue: 150,
          epsDiluted: 15.38,
          sharesDiluted: 1,
          stockholdersEquity: 140,
          freeCashFlow: 14,
          sourceFacts: {},
        },
      ],
      340.54,
    );

    expect(assumptions.growthRate).toBeGreaterThan(0.09);
    expect(assumptions.growthRate).toBeLessThan(0.1);
    expect(assumptions.futurePe).toBeLessThan(20);
  });

  it("keeps a high default growth rate when supporting metrics confirm it", () => {
    const growth = 1.25 ** 5;
    const assumptions = deriveDefaultAssumptions(
      [
        {
          fiscalYear: 2020,
          revenue: 100,
          epsDiluted: 2,
          sharesDiluted: 1,
          stockholdersEquity: 100,
          freeCashFlow: 10,
          sourceFacts: {},
        },
        {
          fiscalYear: 2025,
          revenue: 100 * growth,
          epsDiluted: 2 * growth,
          sharesDiluted: 1,
          stockholdersEquity: 100 * growth,
          freeCashFlow: 10 * growth,
          sourceFacts: {},
        },
      ],
      100,
    );

    expect(assumptions.growthRate).toBeCloseTo(0.25, 4);
    expect(assumptions.futurePe).toBe(50);
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
