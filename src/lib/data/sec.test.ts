import { describe, expect, it } from "vitest";
import { extractAnnualFacts, extractInterimFacts } from "@/lib/data/sec";

describe("SEC fact normalization", () => {
  it("prefers the most recent usable annual concept over a stale first match", () => {
    const facts = {
      cik: 4962,
      facts: {
        "us-gaap": {
          Revenues: {
            units: {
              USD: [
                { fy: 2010, fp: "FY", form: "10-K", filed: "2011-02-28", val: 27_819_000_000 },
              ],
            },
          },
          RevenuesNetOfInterestExpense: {
            units: {
              USD: [
                {
                  fy: 2025,
                  fp: "FY",
                  form: "10-K",
                  filed: "2026-02-06",
                  start: "2024-01-01",
                  end: "2024-12-31",
                  frame: "CY2024",
                  val: 65_949_000_000,
                },
                {
                  fy: 2025,
                  fp: "FY",
                  form: "10-K",
                  filed: "2026-02-06",
                  start: "2025-01-01",
                  end: "2025-12-31",
                  frame: "CY2025",
                  val: 72_229_000_000,
                },
                {
                  fy: 2025,
                  fp: "FY",
                  form: "10-K",
                  filed: "2026-02-06",
                  start: "2025-01-01",
                  end: "2025-03-31",
                  frame: "CY2025Q1",
                  val: 16_970_000_000,
                },
              ],
            },
          },
        },
      },
    };

    const extracts = extractAnnualFacts(
      facts,
      "0000004962",
      ["Revenues", "RevenuesNetOfInterestExpense"],
      ["USD"],
    );

    expect(extracts.map((extract) => [extract.fiscalYear, extract.value])).toEqual([
      [2024, 65_949_000_000],
      [2025, 72_229_000_000],
    ]);
    expect(extracts[0].source.label).toContain("RevenuesNetOfInterestExpense");
  });

  it("extracts interim YTD EPS facts for TTM valuation", () => {
    const facts = {
      cik: 1336920,
      facts: {
        "us-gaap": {
          EarningsPerShareDiluted: {
            units: {
              "USD/shares": [
                {
                  fy: 2025,
                  fp: "Q1",
                  form: "10-Q",
                  filed: "2025-05-06",
                  start: "2025-01-04",
                  end: "2025-04-04",
                  val: 2.77,
                },
                {
                  fy: 2026,
                  fp: "Q1",
                  form: "10-Q",
                  filed: "2026-05-05",
                  start: "2026-01-03",
                  end: "2026-04-03",
                  val: 2.56,
                },
                {
                  fy: 2026,
                  fp: "Q2",
                  form: "10-Q",
                  filed: "2026-08-04",
                  start: "2026-04-04",
                  end: "2026-07-03",
                  val: 2.7,
                },
              ],
            },
          },
        },
      },
    };

    const extracts = extractInterimFacts(
      facts,
      "0001336920",
      ["EarningsPerShareDiluted"],
      ["USD/shares"],
    );

    expect(extracts.map((extract) => [extract.fiscalYear, extract.fiscalPeriod, extract.value])).toEqual([
      [2025, "Q1", 2.77],
      [2026, "Q1", 2.56],
    ]);
  });
});
