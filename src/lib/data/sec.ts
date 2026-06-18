import type {
  AnnualFinancials,
  CompanyProfile,
  CompanySearchResult,
  DataSourceRef,
  FilingLink,
} from "@/lib/types";
import { calculateFreeCashFlow, calculateRoic, deriveEps, isFiniteNumber } from "@/lib/rule1";

const SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const SEC_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_ARCHIVES_URL = "https://www.sec.gov/Archives/edgar/data";
const USER_AGENT =
  process.env.SEC_USER_AGENT ?? "RuleOnePortfolio/0.1 personal research app contact: local@example.com";

type SecTickerRecord = {
  cik_str: number;
  ticker: string;
  title: string;
};

type SecSubmissions = {
  cik: string;
  name?: string;
  sicDescription?: string;
  tickers?: string[];
  exchanges?: string[];
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
};

type SecFactValue = {
  val?: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  accn?: string;
  start?: string;
  end?: string;
  frame?: string;
};

type SecConcept = {
  label?: string;
  description?: string;
  units?: Record<string, SecFactValue[]>;
};

type SecCompanyFacts = {
  cik: number;
  entityName?: string;
  facts?: {
    "us-gaap"?: Record<string, SecConcept>;
  };
};

type AnnualExtract = {
  fiscalYear: number;
  value: number;
  source: DataSourceRef;
};

const conceptMap = {
  revenue: [
    "Revenues",
    "RevenuesNetOfInterestExpense",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
  ],
  netIncome: ["NetIncomeLoss"],
  epsDiluted: ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
  sharesDiluted: [
    "WeightedAverageNumberOfDilutedSharesOutstanding",
    "WeightedAverageNumberOfSharesOutstandingBasic",
  ],
  stockholdersEquity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  operatingCashFlow: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  longTermDebt: ["LongTermDebt", "LongTermDebtNoncurrent"],
  longTermDebtCurrent: ["LongTermDebtCurrent"],
  shortTermBorrowings: ["ShortTermBorrowings"],
  cashAndEquivalents: ["CashAndCashEquivalentsAtCarryingValue"],
};

const unitPreferences = {
  usd: ["USD"],
  eps: ["USD/shares", "USD/shares"],
  shares: ["shares"],
};

let tickerCache: CompanySearchResult[] | null = null;

function secHeaders() {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
}

async function fetchSecJson<T>(url: string, revalidate: number): Promise<T> {
  const response = await fetch(url, {
    headers: secHeaders(),
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`SEC request failed (${response.status}) for ${url}`);
  }

  return response.json() as Promise<T>;
}

export function padCik(cik: string | number) {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

function unpadCik(cik: string | number) {
  return String(Number(String(cik).replace(/\D/g, "")));
}

export async function getTickerList(): Promise<CompanySearchResult[]> {
  if (tickerCache) {
    return tickerCache;
  }

  const raw = await fetchSecJson<Record<string, SecTickerRecord>>(SEC_COMPANY_TICKERS_URL, 60 * 60 * 24);
  tickerCache = Object.values(raw).map((record) => ({
    symbol: record.ticker.toUpperCase(),
    name: record.title,
    cik: padCik(record.cik_str),
    dataAvailability: "sec",
  }));

  return tickerCache;
}

export async function searchCompanies(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 1) {
    return [];
  }

  const companies = await getTickerList();
  return companies
    .filter((company) => {
      const symbol = company.symbol.toLowerCase();
      const name = company.name.toLowerCase();
      return symbol.includes(normalizedQuery) || name.includes(normalizedQuery);
    })
    .toSorted((a, b) => {
      const aSymbol = a.symbol.toLowerCase();
      const bSymbol = b.symbol.toLowerCase();
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aScore =
        (aSymbol === normalizedQuery ? 0 : aSymbol.startsWith(normalizedQuery) ? 1 : 2) +
        (aName.startsWith(normalizedQuery) ? 0 : 1);
      const bScore =
        (bSymbol === normalizedQuery ? 0 : bSymbol.startsWith(normalizedQuery) ? 1 : 2) +
        (bName.startsWith(normalizedQuery) ? 0 : 1);
      return aScore - bScore || a.symbol.localeCompare(b.symbol);
    })
    .slice(0, 12);
}

export async function findCompany(symbol: string) {
  const companies = await getTickerList();
  const normalizedSymbol = symbol.trim().toUpperCase();
  return companies.find((company) => company.symbol === normalizedSymbol);
}

export async function getSubmissionsByCik(cik: string) {
  return fetchSecJson<SecSubmissions>(`${SEC_SUBMISSIONS_URL}/CIK${padCik(cik)}.json`, 60 * 60 * 24);
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const company = await findCompany(symbol);
  if (!company?.cik) {
    throw new Error(`No SEC company found for ${symbol.toUpperCase()}`);
  }

  const submissions = await getSubmissionsByCik(company.cik);
  const tickerIndex =
    submissions.tickers?.findIndex((ticker) => ticker.toUpperCase() === company.symbol) ?? 0;
  const exchange = submissions.exchanges?.[tickerIndex >= 0 ? tickerIndex : 0];
  const industry = submissions.sicDescription;

  return {
    symbol: company.symbol,
    name: submissions.name ?? company.name,
    cik: padCik(company.cik),
    exchange,
    industry,
    description: industry
      ? `SEC filings classify this business under ${industry}. Review the linked annual report for the full business description.`
      : "SEC profile found. Review the linked annual report for the business description.",
    source: {
      label: "SEC submissions",
      url: `${SEC_SUBMISSIONS_URL}/CIK${padCik(company.cik)}.json`,
      confidence: "high",
    },
  };
}

function filingUrl(cik: string, accessionNumber: string, primaryDocument: string) {
  return `${SEC_ARCHIVES_URL}/${unpadCik(cik)}/${accessionNumber.replaceAll("-", "")}/${primaryDocument}`;
}

export async function getCompanyFilings(symbol: string): Promise<FilingLink[]> {
  const company = await findCompany(symbol);
  if (!company?.cik) {
    throw new Error(`No SEC company found for ${symbol.toUpperCase()}`);
  }

  const submissions = await getSubmissionsByCik(company.cik);
  const recent = submissions.filings?.recent;
  if (!recent?.form || !recent.accessionNumber || !recent.filingDate || !recent.primaryDocument) {
    return [];
  }

  const wantedForms = new Set(["10-K", "10-K/A", "10-Q", "10-Q/A", "DEF 14A"]);
  return recent.form
    .map((form, index) => ({
      form,
      filingDate: recent.filingDate?.[index] ?? "",
      accessionNumber: recent.accessionNumber?.[index] ?? "",
      primaryDocument: recent.primaryDocument?.[index] ?? "",
    }))
    .filter((filing) => wantedForms.has(filing.form) && filing.accessionNumber && filing.primaryDocument)
    .map((filing) => ({
      ...filing,
      url: filingUrl(company.cik as string, filing.accessionNumber, filing.primaryDocument),
    }))
    .slice(0, 18);
}

function chooseUnits(concept: SecConcept, preferredUnits: string[]) {
  const units = concept.units ?? {};
  const preferred = preferredUnits.find((unit) => units[unit]?.length);
  const fallback = Object.keys(units).find((unit) => units[unit]?.length);
  const unit = preferred ?? fallback;
  return unit ? { unit, values: units[unit] } : undefined;
}

function annualExtractsForConcept(
  cik: string,
  conceptName: string,
  concept: SecConcept,
  preferredUnits: string[],
  confidence: DataSourceRef["confidence"],
) {
  const selectedUnits = chooseUnits(concept, preferredUnits);
  if (!selectedUnits) {
    return [];
  }

  const byYear = new Map<number, SecFactValue>();
  selectedUnits.values.filter(isAnnualFact).forEach((value) => {
    const fiscalYear = fiscalYearFromFact(value);
    if (!fiscalYear) {
      return;
    }

    const existing = byYear.get(fiscalYear);
    if (!existing) {
      byYear.set(fiscalYear, value);
      return;
    }

    const existingFiled = existing.filed ?? "";
    const valueFiled = value.filed ?? "";
    if (valueFiled > existingFiled) {
      byYear.set(fiscalYear, value);
    }
  });

  return Array.from(byYear.entries())
    .map(([fiscalYear, value]) => ({
      fiscalYear,
      value: value.val as number,
      source: sourceRef(cik, conceptName, fiscalYear, confidence, selectedUnits.unit),
    }))
    .toSorted((a, b) => a.fiscalYear - b.fiscalYear);
}

function isAnnualFact(value: SecFactValue) {
  const form = value.form ?? "";
  if (!isFiniteNumber(value.val) || (!value.fy && !value.end && !value.frame)) {
    return false;
  }

  if (value.frame && /Q\d$/i.test(value.frame)) {
    return false;
  }

  if (value.start && value.end) {
    const startTime = Date.parse(value.start);
    const endTime = Date.parse(value.end);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      return false;
    }

    const days = (endTime - startTime) / 86_400_000;
    return days >= 300 && days <= 400 && (value.fp === "FY" || form.startsWith("10-K"));
  }

  return value.fp === "FY" || form.startsWith("10-K");
}

function fiscalYearFromFact(value: SecFactValue) {
  const calendarYearFrame = value.frame?.match(/^CY(\d{4})$/i)?.[1];
  if (calendarYearFrame) {
    return Number(calendarYearFrame);
  }

  if (value.end) {
    const endYear = Number(value.end.slice(0, 4));
    if (Number.isInteger(endYear)) {
      return endYear;
    }
  }

  return value.fy;
}

function sourceRef(
  cik: string,
  conceptName: string,
  fiscalYear: number,
  confidence: DataSourceRef["confidence"],
  unit?: string,
): DataSourceRef {
  return {
    label: `SEC ${conceptName}${unit ? ` (${unit})` : ""}`,
    url: `${SEC_COMPANY_FACTS_URL}/CIK${padCik(cik)}.json`,
    period: `FY ${fiscalYear}`,
    confidence,
  };
}

export function extractAnnualFacts(
  facts: SecCompanyFacts,
  cik: string,
  conceptNames: string[],
  preferredUnits: string[],
  confidence: DataSourceRef["confidence"] = "high",
): AnnualExtract[] {
  const usGaap = facts.facts?.["us-gaap"];
  if (!usGaap) {
    return [];
  }

  const candidates = conceptNames
    .map((conceptName, index) => {
      const concept = usGaap[conceptName];
      const extracts = concept
        ? annualExtractsForConcept(cik, conceptName, concept, preferredUnits, confidence)
        : [];

      return {
        index,
        extracts,
        latestYear: extracts.at(-1)?.fiscalYear ?? 0,
      };
    })
    .filter((candidate) => candidate.extracts.length > 0)
    .toSorted(
      (a, b) =>
        b.latestYear - a.latestYear ||
        b.extracts.length - a.extracts.length ||
        a.index - b.index,
    );

  return candidates[0]?.extracts ?? [];
}

function setAnnualValue(
  map: Map<number, AnnualFinancials>,
  fiscalYear: number,
  key: keyof Omit<AnnualFinancials, "fiscalYear" | "sourceFacts">,
  extract: AnnualExtract,
  sourceKey = key,
) {
  const row = map.get(fiscalYear) ?? { fiscalYear, sourceFacts: {} };
  map.set(fiscalYear, {
    ...row,
    [key]: extract.value,
    sourceFacts: {
      ...row.sourceFacts,
      [String(sourceKey)]: extract.source,
    },
  });
}

function addExtracts(
  map: Map<number, AnnualFinancials>,
  extracts: AnnualExtract[],
  key: keyof Omit<AnnualFinancials, "fiscalYear" | "sourceFacts">,
) {
  extracts.forEach((extract) => setAnnualValue(map, extract.fiscalYear, key, extract));
}

export async function getCompanyFinancials(symbol: string): Promise<AnnualFinancials[]> {
  const company = await findCompany(symbol);
  if (!company?.cik) {
    throw new Error(`No SEC company found for ${symbol.toUpperCase()}`);
  }

  const facts = await fetchSecJson<SecCompanyFacts>(
    `${SEC_COMPANY_FACTS_URL}/CIK${padCik(company.cik)}.json`,
    60 * 60 * 24,
  );
  const map = new Map<number, AnnualFinancials>();

  addExtracts(
    map,
    extractAnnualFacts(facts, company.cik, conceptMap.revenue, unitPreferences.usd),
    "revenue",
  );
  addExtracts(
    map,
    extractAnnualFacts(facts, company.cik, conceptMap.netIncome, unitPreferences.usd),
    "netIncome",
  );
  addExtracts(
    map,
    extractAnnualFacts(facts, company.cik, conceptMap.epsDiluted, unitPreferences.eps),
    "epsDiluted",
  );
  addExtracts(
    map,
    extractAnnualFacts(facts, company.cik, conceptMap.sharesDiluted, unitPreferences.shares),
    "sharesDiluted",
  );
  addExtracts(
    map,
    extractAnnualFacts(facts, company.cik, conceptMap.stockholdersEquity, unitPreferences.usd),
    "stockholdersEquity",
  );
  addExtracts(
    map,
    extractAnnualFacts(facts, company.cik, conceptMap.operatingCashFlow, unitPreferences.usd),
    "operatingCashFlow",
  );
  addExtracts(map, extractAnnualFacts(facts, company.cik, conceptMap.capex, unitPreferences.usd), "capex");
  addExtracts(
    map,
    extractAnnualFacts(facts, company.cik, conceptMap.cashAndEquivalents, unitPreferences.usd, "medium"),
    "cashAndEquivalents",
  );

  const debtPieces = [
    extractAnnualFacts(facts, company.cik, conceptMap.longTermDebt, unitPreferences.usd, "medium"),
    extractAnnualFacts(facts, company.cik, conceptMap.longTermDebtCurrent, unitPreferences.usd, "medium"),
    extractAnnualFacts(facts, company.cik, conceptMap.shortTermBorrowings, unitPreferences.usd, "medium"),
  ];
  debtPieces.flat().forEach((extract) => {
    const row = map.get(extract.fiscalYear) ?? { fiscalYear: extract.fiscalYear, sourceFacts: {} };
    row.totalDebt = (row.totalDebt ?? 0) + extract.value;
    row.sourceFacts.totalDebt = {
      ...extract.source,
      label: "SEC debt concepts",
      confidence: "medium",
    };
    map.set(extract.fiscalYear, row);
  });

  return Array.from(map.values())
    .map((row) => {
      const freeCashFlow = row.freeCashFlow ?? calculateFreeCashFlow(row.operatingCashFlow, row.capex);
      const epsDiluted = row.epsDiluted ?? deriveEps(row.netIncome, row.sharesDiluted);
      const investedCapital =
        isFiniteNumber(row.stockholdersEquity) &&
        isFiniteNumber(row.totalDebt) &&
        isFiniteNumber(row.cashAndEquivalents)
          ? row.stockholdersEquity + row.totalDebt - row.cashAndEquivalents
          : undefined;
      const roic = row.roic ?? calculateRoic(row.netIncome, investedCapital);

      return {
        ...row,
        freeCashFlow,
        epsDiluted,
        investedCapital,
        roic,
        sourceFacts: {
          ...row.sourceFacts,
          ...(freeCashFlow !== undefined
            ? {
                freeCashFlow: {
                  label: "Operating cash flow - capex",
                  period: `FY ${row.fiscalYear}`,
                  confidence: "medium" as const,
                },
              }
            : {}),
          ...(epsDiluted !== undefined && !row.sourceFacts.epsDiluted
            ? {
                epsDiluted: {
                  label: "Net income / diluted shares",
                  period: `FY ${row.fiscalYear}`,
                  confidence: "medium" as const,
                },
              }
            : {}),
          ...(roic !== undefined
            ? {
                roic: {
                  label: "Net income / invested capital",
                  period: `FY ${row.fiscalYear}`,
                  confidence: "medium" as const,
                },
              }
            : {}),
        },
      };
    })
    .filter((row) => row.fiscalYear >= new Date().getFullYear() - 15)
    .toSorted((a, b) => a.fiscalYear - b.fiscalYear);
}
