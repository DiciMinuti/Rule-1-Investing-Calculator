import type { BusinessGrade, MetricStatus, PriceVerdict } from "@/lib/types";

export const businessGradeLabels: Record<BusinessGrade, string> = {
  strong: "Strong",
  middle: "Middle",
  dull: "Dull",
};

export const priceVerdictLabels: Record<PriceVerdict, string> = {
  pass: "Below MOS",
  almost: "Between MOS and sticker",
  nope: "Above sticker",
};

export const statusLabels: Record<MetricStatus, string> = {
  healthy: "Healthy",
  caution: "Mixed",
  weak: "Weak",
  missing: "Missing",
};

export function formatCurrency(value: number | null | undefined, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value as number);
}

export function formatPercent(value: number | null | undefined, maximumFractionDigits = 1) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits,
  }).format(value as number);
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value as number);
}

export function formatCompact(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value as number);
}

export function formatDate(value: string | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function gradeTone(grade: BusinessGrade) {
  if (grade === "strong") {
    return "good";
  }

  if (grade === "middle") {
    return "warn";
  }

  return "bad";
}

export function verdictTone(verdict: PriceVerdict) {
  if (verdict === "pass") {
    return "good";
  }

  if (verdict === "almost") {
    return "warn";
  }

  return "bad";
}
