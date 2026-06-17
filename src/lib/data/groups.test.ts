import { describe, expect, it } from "vitest";
import {
  normalizeGroupSymbolForSec,
  parseSp500ConstituentsFromWikitext,
} from "@/lib/data/groups";

describe("business group data", () => {
  it("normalizes dotted share-class symbols for SEC lookup", () => {
    expect(normalizeGroupSymbolForSec("BRK.B")).toBe("BRK-B");
  });

  it("parses S&P 500 wikitext rows into group constituents", () => {
    const rows = parseSp500ConstituentsFromWikitext(`
{| class="wikitable sortable" id="constituents"
|-
![[Ticker symbol|Symbol]]
! Security !! [[Global Industry Classification Standard|GICS]] Sector !! GICS Sub-Industry !! Headquarters Location !! Date added !! [[Central Index Key|CIK]] !! Founded
|-
|{{NyseSymbol|MMM}}
|[[3M]]|| Industrials || Industrial Conglomerates || [[Saint Paul, Minnesota]] || 1957-03-04 || 0000066740 || 1902
|-
|{{NyseSymbol|BRK.B}} <!-- DO NOT CHANGE THIS TICKER TO BRK-B. -->
|[[Berkshire Hathaway]]|| Financials || Multi-Sector Holdings || [[Omaha, Nebraska]] || 2010-02-16 || 0001067983 || 1839
|}
`);

    expect(rows).toEqual([
      {
        displaySymbol: "MMM",
        symbol: "MMM",
        name: "3M",
        sector: "Industrials",
        industry: "Industrial Conglomerates",
        cik: "0000066740",
      },
      {
        displaySymbol: "BRK.B",
        symbol: "BRK-B",
        name: "Berkshire Hathaway",
        sector: "Financials",
        industry: "Multi-Sector Holdings",
        cik: "0001067983",
      },
    ]);
  });
});
