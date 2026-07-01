export const CHART_RANGE_OPTIONS = [
  { label: "10Y", sessions: 2600 },
  { label: "5Y", sessions: 1300 },
  { label: "3Y", sessions: 780 },
  { label: "1Y", sessions: 260 },
  { label: "5M", sessions: 108 },
  { label: "3M", sessions: 65 },
  { label: "1M", sessions: 22 },
  { label: "1W", sessions: 5 },
  { label: "1D", sessions: 2 },
] as const;

export type ChartRangeLabel = (typeof CHART_RANGE_OPTIONS)[number]["label"];

export const DEFAULT_PRICE_CHART_RANGE: ChartRangeLabel = "5Y";
export const DEFAULT_INDICATOR_CHART_RANGE: ChartRangeLabel = "1Y";

export function getChartRange(label: ChartRangeLabel) {
  return CHART_RANGE_OPTIONS.find((option) => option.label === label) ?? CHART_RANGE_OPTIONS[1];
}

export function getChartDateTicks<T extends { date: string }>(points: T[], maxTicks = 4) {
  if (!points.length) {
    return [];
  }

  const tickCount = Math.min(maxTicks, points.length);
  if (tickCount === 1) {
    return [{ date: points[0].date, index: 0 }];
  }

  const seen = new Set<number>();
  return Array.from({ length: tickCount }, (_, tickIndex) =>
    Math.round((tickIndex / (tickCount - 1)) * (points.length - 1)),
  )
    .filter((index) => {
      if (seen.has(index)) {
        return false;
      }
      seen.add(index);
      return true;
    })
    .map((index) => ({ date: points[index].date, index }));
}
