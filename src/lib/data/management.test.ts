import { describe, expect, it } from "vitest";
import { buildManagementBriefFromTexts } from "@/lib/data/management";
import { selectManagementDocuments } from "@/lib/data/management-documents";
import type { FilingLink } from "@/lib/types";

const filings: FilingLink[] = [
  {
    form: "10-Q",
    filingDate: "2026-04-30",
    accessionNumber: "0000000000-26-000003",
    primaryDocument: "quarterly.htm",
    url: "https://www.sec.gov/Archives/edgar/data/1/000000000026000003/quarterly.htm",
  },
  {
    form: "10-K",
    filingDate: "2026-02-15",
    accessionNumber: "0000000000-26-000002",
    primaryDocument: "annual.htm",
    url: "https://www.sec.gov/Archives/edgar/data/1/000000000026000002/annual.htm",
  },
  {
    form: "DEF 14A",
    filingDate: "2026-01-10",
    accessionNumber: "0000000000-26-000001",
    primaryDocument: "proxy.htm",
    url: "https://www.sec.gov/Archives/edgar/data/1/000000000026000001/proxy.htm",
  },
];

describe("management document selection", () => {
  it("selects latest annual report, proxy, and quarterly filing", () => {
    const documents = selectManagementDocuments(filings);

    expect(documents.map((document) => [document.kind, document.form])).toEqual([
      ["annualReport", "10-K"],
      ["proxy", "DEF 14A"],
      ["quarterly", "10-Q"],
    ]);
    expect(documents[0].viewerUrl).toContain("/filing-viewer?");
  });
});

describe("management extraction", () => {
  it("finds management evidence in annual report and proxy text", () => {
    const documents = selectManagementDocuments(filings);
    const annualReport = documents.find((document) => document.kind === "annualReport");
    const proxy = documents.find((document) => document.kind === "proxy");

    const brief = buildManagementBriefFromTexts({
      symbol: "TST",
      documents,
      documentTexts: {
        annualReport: `
          Information About Our Executive Officers
          JANE DOE — Chief Executive Officer
          Ms. Doe (45) has served as Chief Executive Officer since 2018 and joined the company in 2011.

          Dear Shareholders
          This year we focused on capital allocation, customers, and long-term value.
        `,
        proxy: `
          Summary Compensation Table
          Name and
          Principal Position (1)
          Year
          Salary
          Bonus
          Stock Awards
          Option Awards
          Change in Pension Value
          All Other Compensation
          Total
          Jane Doe
          Chief Executive Officer
          2025
          1000000
          500000
          4000000
          0
          N/A
          100000
          5600000
          (1)
          Name Principal Position Year Salary ($) Stock Awards ($) Total ($)
          Jane Doe Chief Executive Officer 2025 1000000 5000000 6500000

          Stock Ownership Information
          Name
          Number of Shares Owned
          Right to Acquire
          Percent of Class (%)
          Number of SEUs Owned by Director
          Jane Doe
          100,000
          50,000
          *
          —
          All current directors, nominees and executive officers
          (12 individuals) (2)
          500,000
          100,000
          *
          —
          (1)
          Directors and executive officers beneficially owned 4.2% of shares outstanding.
        `,
      },
    });

    expect(annualReport).toBeDefined();
    expect(proxy).toBeDefined();
    expect(brief.signals.map((signal) => signal.status)).toEqual([
      "found",
      "found",
      "found",
      "found",
    ]);
    expect(brief.signals.find((signal) => signal.id === "leaders")?.tables?.[0].rows[0]).toMatchObject({
      name: "Jane Doe",
      role: "Chief Executive Officer",
      age: "45",
    });
    expect(brief.signals.find((signal) => signal.id === "compensation")?.tables?.[0].rows[0]).toMatchObject({
      name: "Jane Doe",
      year: "2025",
      total: "$5600000",
    });
    expect(brief.signals.find((signal) => signal.id === "ownership")?.tables?.[0].rows[0]).toMatchObject({
      holder: "Jane Doe",
      sharesOwned: "100,000",
      percent: "Less than 1%",
    });
    expect(brief.signals.find((signal) => signal.id === "shareholderLetter")?.excerpts[0]).toContain(
      "Dear Shareholders",
    );
  });

  it("does not treat ordinary shareholder references as a CEO letter", () => {
    const documents = selectManagementDocuments(filings);
    const brief = buildManagementBriefFromTexts({
      symbol: "TST",
      documents,
      documentTexts: {
        annualReport:
          "We returned capital to our shareholders through dividends and repurchases while investing in customers.",
      },
    });

    const signal = brief.signals.find((item) => item.id === "shareholderLetter");
    expect(signal?.status).toBe("needs-review");
    expect(signal?.excerpts).toEqual([]);
  });
});
