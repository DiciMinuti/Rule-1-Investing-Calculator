import { describe, expect, it } from "vitest";
import { extractAnnualFacts } from "@/lib/data/sec";

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
});
