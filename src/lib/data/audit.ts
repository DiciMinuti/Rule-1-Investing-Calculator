import { deriveEps, isFiniteNumber } from "@/lib/rule1";
import type {
  AnnualFinancials,
  BigFiveResult,
  CompanyProfile,
  DataAuditCheck,
  DataAuditReport,
  DataAuditStatus,
  PriceHistory,
  StockSplit,
  ValuationAssumptions,
} from "@/lib/types";

type AuditInputs = {
  profile: CompanyProfile;
  financials: AnnualFinancials[];
  prices: PriceHistory;
  bigFive: BigFiveResult;
  assumptions: ValuationAssumptions;
  generatedAt?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TECHNICAL_PRICE_ROWS = 35;
const EPSILON = 0.000001;

function maxStatus(statuses: DataAuditStatus[]): DataAuditStatus {
  if (statuses.includes("fail")) {
    return "fail";
  }

  if (statuses.includes("warn")) {
    return "warn";
  }

  return "pass";
}

function parseDate(date: string | undefined) {
  if (!date) {
    return undefined;
  }

  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function splitAdjustmentFactor(fiscalYear: number, splits: StockSplit[]) {
  const fiscalYearEnd = `${fiscalYear}-12-31`;
  return splits
    .filter(
      (split) =>
        split.date > fiscalYearEnd &&
        isFiniteNumber(split.numerator) &&
        split.numerator > 0 &&
        isFiniteNumber(split.denominator) &&
        split.denominator > 0,
    )
    .reduce((factor, split) => factor * (split.denominator / split.numerator), 1);
}

function latestFinancialWithEps(financials: AnnualFinancials[]) {
  return financials
    .toSorted((a, b) => b.fiscalYear - a.fiscalYear)
    .find((row) => isFiniteNumber(row.epsDiluted) || deriveEps(row.netIncome, row.sharesDiluted) !== undefined);
}

function identityCheck(profile: CompanyProfile): DataAuditCheck {
  const missing = [
    profile.symbol ? undefined : "symbol",
    profile.name ? undefined : "company name",
    profile.cik ? undefined : "CIK",
    profile.exchange ? undefined : "exchange",
  ].filter((item): item is string => Boolean(item));

  return {
    id: "identity",
    label: "Company identity",
    status: missing.length ? "warn" : "pass",
    detail: missing.length
      ? `Missing ${missing.join(", ")}; confirm identity before relying on the result.`
      : `${profile.name} (${profile.symbol}) has ticker, CIK, and exchange metadata.`,
    source: profile.source,
  };
}

function priceCheck(prices: PriceHistory, generatedAt: string): DataAuditCheck {
  const latestDate = parseDate(prices.latest?.date);
  const generatedDate = Date.parse(generatedAt);

  if (!prices.latest || !latestDate || !Number.isFinite(generatedDate)) {
    return {
      id: "price",
      label: "Price data",
      status: "fail",
      detail: "No usable latest price row was returned.",
      source: prices.source,
    };
  }

  const ageDays = Math.max(0, Math.floor((generatedDate - latestDate) / DAY_MS));
  const status: DataAuditStatus = ageDays > 7 ? "warn" : "pass";

  return {
    id: "price",
    label: "Price data",
    status,
    detail:
      status === "pass"
        ? `Latest price is dated ${prices.latest.date}.`
        : `Latest price is ${ageDays} days old (${prices.latest.date}); refresh or enter a manual price.`,
    source: prices.source,
  };
}

function fundamentalsCheck(financials: AnnualFinancials[]): DataAuditCheck {
  const annualRows = financials.length;
  const latest = financials.toSorted((a, b) => b.fiscalYear - a.fiscalYear)[0];

  if (annualRows < 2) {
    return {
      id: "fundamentals",
      label: "Annual fundamentals",
      status: "fail",
      detail: `Only ${annualRows} annual row${annualRows === 1 ? "" : "s"} found; CAGR checks need at least two years.`,
    };
  }

  return {
    id: "fundamentals",
    label: "Annual fundamentals",
    status: annualRows >= 5 ? "pass" : "warn",
    detail:
      annualRows >= 5
        ? `${annualRows} annual rows found through fiscal ${latest?.fiscalYear}.`
        : `${annualRows} annual rows found; long-window Rule #1 growth checks may be incomplete.`,
  };
}

function bigFiveCheck(bigFive: BigFiveResult): DataAuditCheck {
  const missingMetrics = bigFive.metrics.filter((metric) => metric.status === "missing");

  return {
    id: "bigFive",
    label: "Big Five calculations",
    status: missingMetrics.length ? "warn" : "pass",
    detail: missingMetrics.length
      ? `Missing usable values for ${missingMetrics.map((metric) => metric.label).join(", ")}.`
      : `${bigFive.healthyCount} of ${bigFive.totalCount} Big Five metrics meet the threshold.`,
  };
}

function splitAdjustedValuationCheck(
  financials: AnnualFinancials[],
  splits: StockSplit[] | undefined,
  assumptions: ValuationAssumptions,
): DataAuditCheck {
  const latest = latestFinancialWithEps(financials);

  if (!latest) {
    return {
      id: "splitAdjustedValuation",
      label: "Split-adjusted valuation EPS",
      status: "fail",
      detail: "No annual EPS or net-income/share pair was available for valuation.",
    };
  }

  const rawEps = latest.epsDiluted ?? deriveEps(latest.netIncome, latest.sharesDiluted);
  const factor = splitAdjustmentFactor(latest.fiscalYear, splits ?? []);
  const expectedEps = isFiniteNumber(rawEps) ? rawEps * factor : undefined;

  if (!isFiniteNumber(expectedEps)) {
    return {
      id: "splitAdjustedValuation",
      label: "Split-adjusted valuation EPS",
      status: "fail",
      detail: "Latest annual EPS could not be derived.",
    };
  }

  const matches = Math.abs(assumptions.eps - expectedEps) <= EPSILON;
  const hasLaterSplit = factor !== 1;

  return {
    id: "splitAdjustedValuation",
    label: "Split-adjusted valuation EPS",
    status: matches ? "pass" : "fail",
    detail: matches
      ? hasLaterSplit
        ? `Valuation EPS uses split-adjusted fiscal ${latest.fiscalYear} EPS (${expectedEps.toFixed(4)}).`
        : `Valuation EPS matches fiscal ${latest.fiscalYear} EPS (${expectedEps.toFixed(4)}).`
      : `Valuation EPS ${assumptions.eps.toFixed(4)} does not match expected split-adjusted EPS ${expectedEps.toFixed(
          4,
        )}.`,
  };
}

function technicalIndicatorsCheck(prices: PriceHistory): DataAuditCheck {
  const rows = prices.history.length;

  return {
    id: "technicalIndicators",
    label: "Technical indicator inputs",
    status: rows >= MIN_TECHNICAL_PRICE_ROWS ? "pass" : "warn",
    detail:
      rows >= MIN_TECHNICAL_PRICE_ROWS
        ? `${rows} daily price rows are available for MACD, stochastics, and moving average.`
        : `${rows} daily price rows are available; indicators may be incomplete.`,
    source: prices.source,
  };
}

export function buildDataAuditReport({
  profile,
  financials,
  prices,
  bigFive,
  assumptions,
  generatedAt = new Date().toISOString(),
}: AuditInputs): DataAuditReport {
  const checks = [
    identityCheck(profile),
    priceCheck(prices, generatedAt),
    fundamentalsCheck(financials),
    bigFiveCheck(bigFive),
    splitAdjustedValuationCheck(financials, prices.splits, assumptions),
    technicalIndicatorsCheck(prices),
  ];

  return {
    status: maxStatus(checks.map((check) => check.status)),
    generatedAt,
    checks,
  };
}
