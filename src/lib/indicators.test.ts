import { describe, expect, it } from "vitest";
import {
  buildIndicatorSummary,
  buildTechnicalIndicators,
  calculateEma,
  calculateMovingAverage,
  calculateStochastics,
  DEFAULT_INDICATOR_SETTINGS,
} from "@/lib/indicators";
import type { PricePoint } from "@/lib/types";

function datedPoint(index: number, close: number, ohlc = true): PricePoint {
  const date = new Date(Date.UTC(2024, 0, index + 1)).toISOString().slice(0, 10);

  if (!ohlc) {
    return { date, close };
  }

  return {
    date,
    open: close - 0.25,
    high: close + 1,
    low: close - 1,
    close,
  };
}

describe("technical indicators", () => {
  it("uses Phil Town indicator defaults", () => {
    expect(DEFAULT_INDICATOR_SETTINGS).toMatchObject({
      macdFastPeriod: 8,
      macdSlowPeriod: 17,
      macdSignalPeriod: 9,
      stochasticsPeriod: 14,
      stochasticsSignalPeriod: 5,
      movingAveragePeriod: 10,
    });
  });

  it("seeds EMA with the first full-period average", () => {
    expect(calculateEma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("calculates a moving-average signal from closing prices", () => {
    const result = calculateMovingAverage([1, 2, 3, 4, 5].map((close, index) => datedPoint(index, close)), 3);

    expect(result.latest?.average).toBeCloseTo(4, 4);
    expect(result.latest?.close).toBe(5);
    expect(result.signal).toBe("bullish");
    expect(result.detail).toContain("Above");
    expect(result.distancePercent).toBeCloseTo(0.25, 4);
  });

  it("tracks the latest moving-average crossover", () => {
    const result = calculateMovingAverage(
      [5, 4, 3, 2, 1, 2, 4, 6, 8].map((close, index) => datedPoint(index, close)),
      3,
    );

    expect(result.crossover).toMatchObject({
      signal: "bullish",
      date: "2024-01-06",
      sessionsAgo: 3,
    });
  });

  it("calculates MACD from daily closing prices", () => {
    const indicators = buildTechnicalIndicators(
      Array.from({ length: 60 }, (_, index) => datedPoint(index, 100 * 1.01 ** index)),
    );

    expect(indicators.macd.latest?.macd).toBeGreaterThan(0);
    expect(indicators.macd.latest?.signal).toBeGreaterThan(0);
    expect(indicators.macd.signal).toBe("bullish");
    expect(indicators.macd.histogramTrend).toBeDefined();
  });

  it("calculates stochastics from high, low, and close", () => {
    const result = calculateStochastics(
      Array.from({ length: 18 }, (_, index) => datedPoint(index, 30 + index)),
      { stochasticsPeriod: 14, stochasticsSignalPeriod: 3 },
    );

    expect(result.latest?.k).toBeCloseTo(93.33, 2);
    expect(result.latest?.d).toBeCloseTo(93.33, 2);
    expect(result.signal).toBe("neutral");
    expect(result.zone).toBe("overbought");
  });

  it("marks stochastics unavailable without high/low data", () => {
    const result = calculateStochastics(
      Array.from({ length: 18 }, (_, index) => datedPoint(index, 30 + index, false)),
    );

    expect(result.latest).toBeUndefined();
    expect(result.signal).toBe("insufficient");
  });

  it("combines the three indicator signals", () => {
    expect(buildIndicatorSummary(["bullish", "bullish", "bearish"])).toMatchObject({
      signal: "bullish",
      label: "2 of 3 up",
      bullishCount: 2,
      bearishCount: 1,
    });
    expect(buildIndicatorSummary(["bullish", "bearish", "neutral"])).toMatchObject({
      signal: "mixed",
      label: "Mixed",
    });
  });
});
