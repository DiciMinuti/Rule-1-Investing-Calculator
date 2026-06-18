import { describe, expect, it } from "vitest";
import {
  buildBigFive,
  calculateCagr,
  calculateFreeCashFlow,
  calculateValuation,
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
