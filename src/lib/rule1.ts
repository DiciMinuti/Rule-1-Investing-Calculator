import type {
  AnnualFinancials,
  BigFiveMetric,
  BigFiveResult,
  BusinessGrade,
  GrowthResult,
  GrowthWindow,
  MetricStatus,
  PricePoint,
  ValuationAssumptions,
  ValuationResult,
} from "@/lib/types";

const WINDOWS: GrowthWindow[] = [10, 5, 3, 1];

type SeriesPoint = {
  fiscalYear: number;
  value: number | null | undefined;
};

export const DEFAULT_REQUIRED_RETURN = 0.15;
export const DEFAULT_MARGIN_OF_SAFETY = 0.5;
export const DEFAULT_BIG_FIVE_THRESHOLD = 0.1;
export const DEFAULT_YEARS = 10;
export const DEFAULT_MAX_GROWTH_RATE = 0.15;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateCagr(
  startingValue: number | null | undefined,
  endingValue: number | null | undefined,
  years: number,
) {
  if (!isFiniteNumber(startingValue) || !isFiniteNumber(endingValue) || years <= 0) {
    return null;
  }

  if (startingValue <= 0 || endingValue <= 0) {
    return null;
  }

  return (endingValue / startingValue) ** (1 / years) - 1;
}

export function calculateGrowthWindow(
  points: SeriesPoint[],
  window: GrowthWindow,
): GrowthResult {
  const cleanPoints = points
    .filter((point) => isFiniteNumber(point.value))
    .map((point) => ({ fiscalYear: point.fiscalYear, value: point.value as number }))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (cleanPoints.length < 2) {
    return {
      window,
      value: null,
      actualYears: 0,
      warning: "Not enough annual values found.",
    };
  }

  const end = cleanPoints[cleanPoints.length - 1];
  const targetStartYear = end.fiscalYear - window;
  const exactOrEarlier = cleanPoints
    .filter((point) => point.fiscalYear <= targetStartYear)
    .at(-1);
  const start = exactOrEarlier ?? cleanPoints[0];
  const actualYears = end.fiscalYear - start.fiscalYear;
  const value = calculateCagr(start.value, end.value, actualYears);
  const warning =
    actualYears < window
      ? `Only ${cleanPoints.length} annual periods found for the ${window}y view.`
      : undefined;

  return {
    window,
    value,
    actualYears,
    startYear: start.fiscalYear,
    endYear: end.fiscalYear,
    warning: value === null ? "Growth needs positive start and end values." : warning,
  };
}

export function calculateGrowthWindows(points: SeriesPoint[]) {
  return WINDOWS.reduce(
    (acc, window) => {
      acc[window] = calculateGrowthWindow(points, window);
      return acc;
    },
    {} as Record<GrowthWindow, GrowthResult>,
  );
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function usableGrowth(value: number | null | undefined) {
  if (!isFiniteNumber(value)) {
    return null;
  }

  return Math.max(0, value);
}

export function deriveEps(netIncome?: number, dilutedShares?: number) {
  if (!isFiniteNumber(netIncome) || !isFiniteNumber(dilutedShares) || dilutedShares <= 0) {
    return undefined;
  }

  return netIncome / dilutedShares;
}

export function calculateFreeCashFlow(operatingCashFlow?: number, capex?: number) {
  if (!isFiniteNumber(operatingCashFlow) || !isFiniteNumber(capex)) {
    return undefined;
  }

  return operatingCashFlow - Math.abs(capex);
}

export function calculateRoic(netIncome?: number, investedCapital?: number) {
  if (!isFiniteNumber(netIncome) || !isFiniteNumber(investedCapital) || investedCapital <= 0) {
    return undefined;
  }

  return netIncome / investedCapital;
}

export function bookValuePerShare(equity?: number, shares?: number) {
  if (!isFiniteNumber(equity) || !isFiniteNumber(shares) || shares <= 0) {
    return undefined;
  }

  return equity / shares;
}

function preferredWindow(metric: BigFiveMetric) {
  return (
    metric.windows[10].value ??
    metric.windows[5].value ??
    metric.windows[3].value ??
    metric.windows[1].value
  );
}

function statusFromValue(value: number | null | undefined, threshold: number): MetricStatus {
  if (!isFiniteNumber(value)) {
    return "missing";
  }

  if (value >= threshold) {
    return "healthy";
  }

  if (value >= 0) {
    return "caution";
  }

  return "weak";
}

function metric(
  id: BigFiveMetric["id"],
  label: string,
  values: { fiscalYear: number; value: number | null }[],
  threshold: number,
  sourceLabel: string,
): BigFiveMetric {
  const windows = calculateGrowthWindows(values);
  const preferred = preferredWindow({ id, label, values, windows, status: "missing", sourceLabel });
  const status = statusFromValue(preferred, threshold);

  return {
    id,
    label,
    values,
    windows,
    status,
    sourceLabel,
    warning: Object.values(windows).find((window) => window.warning)?.warning,
  };
}

function roicMetric(financials: AnnualFinancials[], threshold: number): BigFiveMetric {
  const values = financials
    .map((financial) => ({
      fiscalYear: financial.fiscalYear,
      value: financial.roic ?? null,
      source: financial.sourceFacts.roic,
    }))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
  const latest = values.filter((point) => isFiniteNumber(point.value)).at(-1)?.value ?? null;
  const latestSourceLabel = values.filter((point) => point.source?.label).at(-1)?.source?.label;
  const status = statusFromValue(latest, threshold);

  return {
    id: "roic",
    label: "ROIC",
    values,
    windows: calculateGrowthWindows(values),
    status,
    sourceLabel: latestSourceLabel ?? "Net income / invested capital",
    warning: latest === null ? "ROIC needs net income and invested capital." : undefined,
  };
}

export function buildBigFive(
  financials: AnnualFinancials[],
  threshold = DEFAULT_BIG_FIVE_THRESHOLD,
): BigFiveResult {
  const sorted = financials.toSorted((a, b) => a.fiscalYear - b.fiscalYear);
  const metrics: BigFiveMetric[] = [
    roicMetric(sorted, threshold),
    metric(
      "salesGrowth",
      "Sales growth",
      sorted.map((row) => ({ fiscalYear: row.fiscalYear, value: row.revenue ?? null })),
      threshold,
      "Revenue CAGR",
    ),
    metric(
      "epsGrowth",
      "EPS growth",
      sorted.map((row) => ({
        fiscalYear: row.fiscalYear,
        value: row.epsDiluted ?? deriveEps(row.netIncome, row.sharesDiluted) ?? null,
      })),
      threshold,
      "Diluted EPS CAGR",
    ),
    metric(
      "equityGrowth",
      "Equity growth",
      sorted.map((row) => ({
        fiscalYear: row.fiscalYear,
        value: bookValuePerShare(row.stockholdersEquity, row.sharesDiluted) ?? row.stockholdersEquity ?? null,
      })),
      threshold,
      "Book value per share CAGR",
    ),
    metric(
      "cashFlowGrowth",
      "Cash flow growth",
      sorted.map((row) => {
        const cashFlow = row.freeCashFlow ?? calculateFreeCashFlow(row.operatingCashFlow, row.capex);
        const perShare =
          isFiniteNumber(cashFlow) && isFiniteNumber(row.sharesDiluted) && row.sharesDiluted > 0
            ? cashFlow / row.sharesDiluted
            : cashFlow;
        return { fiscalYear: row.fiscalYear, value: perShare ?? null };
      }),
      threshold,
      "Free cash flow per share CAGR",
    ),
  ];
  const healthyCount = metrics.filter((item) => item.status === "healthy").length;
  const businessContribution = businessGradeFromBigFive(healthyCount);
  const warnings = metrics.flatMap((item) => (item.warning ? [item.warning] : []));

  return {
    metrics,
    healthyCount,
    totalCount: metrics.length,
    threshold,
    businessContribution,
    warnings,
  };
}

export function businessGradeFromBigFive(healthyCount: number): BusinessGrade {
  if (healthyCount >= 4) {
    return "strong";
  }

  if (healthyCount >= 2) {
    return "middle";
  }

  return "dull";
}

function gradeScore(grade: BusinessGrade) {
  if (grade === "strong") {
    return 2;
  }

  if (grade === "middle") {
    return 1;
  }

  return 0;
}

export function deriveBusinessGrade({
  bigFive,
  moat = "middle",
  management = "middle",
}: {
  bigFive: BigFiveResult;
  moat?: BusinessGrade;
  management?: BusinessGrade;
}): BusinessGrade {
  const average =
    (gradeScore(bigFive.businessContribution) + gradeScore(moat) + gradeScore(management)) / 3;

  if (average >= 1.65) {
    return "strong";
  }

  if (average >= 0.8) {
    return "middle";
  }

  return "dull";
}

export function futurePeFromGrowth(growthRate: number, historicalPe?: number) {
  if (!isFiniteNumber(growthRate) || growthRate <= 0) {
    return 0;
  }

  const doubleGrowthPe = growthRate * 200;
  return isFiniteNumber(historicalPe) && historicalPe > 0
    ? Math.min(historicalPe, doubleGrowthPe)
    : doubleGrowthPe;
}

export function selectRuleOneGrowthRate(
  historicalGrowthRate?: number,
  analystGrowthRate?: number,
  cap = DEFAULT_MAX_GROWTH_RATE,
) {
  const candidates = [historicalGrowthRate, analystGrowthRate]
    .filter(isFiniteNumber)
    .map((growthRate) => Math.max(0, Math.min(cap, growthRate)));

  return candidates.length ? Math.min(...candidates) : 0;
}

export function deriveHistoricalEpsGrowthRate(financials: AnnualFinancials[]) {
  const sorted = financials.toSorted((a, b) => a.fiscalYear - b.fiscalYear);
  return (
    usableGrowth(
      calculateGrowthWindow(
        sorted.map((row) => ({
          fiscalYear: row.fiscalYear,
          value: row.epsDiluted ?? deriveEps(row.netIncome, row.sharesDiluted) ?? null,
        })),
        DEFAULT_YEARS,
      ).value,
    ) ?? undefined
  );
}

function yearEndCloseByFiscalYear(priceHistory: PricePoint[]) {
  return priceHistory
    .filter((point) => isFiniteNumber(point.close))
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .reduce((pricesByYear, point) => {
      const fiscalYear = Number(point.date.slice(0, 4));
      if (Number.isInteger(fiscalYear)) {
        pricesByYear.set(fiscalYear, point.close);
      }

      return pricesByYear;
    }, new Map<number, number>());
}

export function deriveHistoricalPe(financials: AnnualFinancials[], priceHistory: PricePoint[] = []) {
  const pricesByYear = yearEndCloseByFiscalYear(priceHistory);
  const ratios = financials
    .toSorted((a, b) => a.fiscalYear - b.fiscalYear)
    .map((row) => {
      const eps = row.epsDiluted ?? deriveEps(row.netIncome, row.sharesDiluted);
      const price = pricesByYear.get(row.fiscalYear);

      if (!isFiniteNumber(eps) || eps <= 0 || !isFiniteNumber(price) || price <= 0) {
        return null;
      }

      return price / eps;
    })
    .filter(isFiniteNumber)
    .slice(-DEFAULT_YEARS);

  return average(ratios) ?? undefined;
}

export function calculateValuation(
  assumptions: ValuationAssumptions,
  businessGrade: BusinessGrade,
): ValuationResult {
  const warnings: string[] = [];
  const {
    eps,
    growthRate,
    futurePe,
    requiredReturn,
    years,
    marginOfSafety,
    currentPrice,
  } = assumptions;

  if (!isFiniteNumber(currentPrice) || currentPrice <= 0) {
    warnings.push("Price source unavailable. Enter current price manually.");
  }

  if (!isFiniteNumber(eps) || eps <= 0) {
    warnings.push("EPS unavailable. Enter EPS to calculate sticker price.");
  }

  if (!isFiniteNumber(growthRate) || growthRate < 0) {
    warnings.push("Growth rate needs a non-negative value.");
  }

  if (!isFiniteNumber(years) || years <= 0) {
    warnings.push("Time horizon needs a positive year count.");
  }

  if (!isFiniteNumber(requiredReturn) || requiredReturn <= -1) {
    warnings.push("Required return needs a valid value.");
  }

  if (!isFiniteNumber(marginOfSafety) || marginOfSafety < 0 || marginOfSafety >= 1) {
    warnings.push("Margin of safety needs to be between 0% and 99%.");
  }

  if (!isFiniteNumber(futurePe) || futurePe <= 0) {
    warnings.push("Future PE needs a positive value.");
  }

  if (
    warnings.some((warning) => warning.includes("EPS")) ||
    warnings.some((warning) => warning.includes("Future PE")) ||
    warnings.some((warning) => warning.includes("Growth")) ||
    warnings.some((warning) => warning.includes("Time horizon")) ||
    warnings.some((warning) => warning.includes("Required return")) ||
    warnings.some((warning) => warning.includes("Margin of safety"))
  ) {
    return {
      futureEps: 0,
      futurePrice: 0,
      stickerPrice: 0,
      mosPrice: 0,
      currentPrice: currentPrice || 0,
      gapToMos: -1,
      priceVerdict: "nope",
      businessGrade,
      warnings,
    };
  }

  const futureEps = eps * (1 + growthRate) ** years;
  const futurePrice = futureEps * futurePe;
  const stickerPrice = futurePrice / (1 + requiredReturn) ** years;
  const mosPrice = stickerPrice * (1 - marginOfSafety);
  const safeCurrentPrice = currentPrice || 0;
  const gapToMos = mosPrice > 0 ? (mosPrice - safeCurrentPrice) / mosPrice : -1;
  const priceVerdict =
    !isFiniteNumber(currentPrice) || currentPrice <= 0
      ? "nope"
      : safeCurrentPrice <= mosPrice
        ? "pass"
        : safeCurrentPrice <= stickerPrice
          ? "almost"
          : "nope";

  return {
    futureEps,
    futurePrice,
    stickerPrice,
    mosPrice,
    currentPrice: safeCurrentPrice,
    gapToMos,
    priceVerdict,
    businessGrade,
    warnings,
  };
}

export function latestAnnualFinancial(financials: AnnualFinancials[]) {
  return financials.toSorted((a, b) => b.fiscalYear - a.fiscalYear)[0];
}

export function deriveDefaultAssumptions(
  financials: AnnualFinancials[],
  currentPrice: number,
  priceHistory: PricePoint[] = [],
  overrides?: Partial<ValuationAssumptions>,
): ValuationAssumptions {
  const latest = latestAnnualFinancial(financials);
  const eps = latest?.epsDiluted ?? deriveEps(latest?.netIncome, latest?.sharesDiluted) ?? 0;
  const historicalGrowthRate = deriveHistoricalEpsGrowthRate(financials);
  const historicalPe = deriveHistoricalPe(financials, priceHistory);
  const baseAssumptions = {
    eps,
    historicalGrowthRate,
    analystGrowthRate: undefined,
    historicalPe,
    requiredReturn: DEFAULT_REQUIRED_RETURN,
    years: DEFAULT_YEARS,
    marginOfSafety: DEFAULT_MARGIN_OF_SAFETY,
    currentPrice,
    ...overrides,
  };
  const growthRate =
    overrides?.growthRate ??
    selectRuleOneGrowthRate(baseAssumptions.historicalGrowthRate, baseAssumptions.analystGrowthRate);
  const futurePe = overrides?.futurePe ?? futurePeFromGrowth(growthRate, baseAssumptions.historicalPe);

  return {
    ...baseAssumptions,
    growthRate,
    futurePe,
  };
}
