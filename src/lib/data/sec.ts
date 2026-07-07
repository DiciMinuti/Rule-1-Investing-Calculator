import type {
  AnnualFinancials,
  CompanyNewsItem,
  CompanyProfile,
  CompanySearchResult,
  DataSourceRef,
  FilingLink,
} from "@/lib/types";
import { calculateFreeCashFlow, calculateRoic, deriveEps, isFiniteNumber } from "@/lib/rule1";
import https from "node:https";

const SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const SEC_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_ARCHIVES_URL = "https://www.sec.gov/Archives/edgar/data";
const USER_AGENT =
  process.env.SEC_USER_AGENT ?? "RuleOnePortfolio/0.1 personal research app contact: local@example.com";
const YAHOO_USER_AGENT = "Mozilla/5.0";

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

type InterimExtract = AnnualExtract & {
  fiscalPeriod: "Q1" | "Q2" | "Q3";
  filed?: string;
  end?: string;
};

type InlineFact = {
  conceptName: string;
  fiscalYear: number;
  value: number;
  source: DataSourceRef;
};

type YahooProfileResponse = {
  quoteSummary?: {
    result?: [
      {
        assetProfile?: {
          longBusinessSummary?: string;
          sector?: string;
          industry?: string;
          website?: string;
          fullTimeEmployees?: number;
        };
      },
    ];
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
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
  capex: [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "PaymentsToAcquirePropertyAndEquipment",
  ],
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

const FINANCIAL_INDUSTRY_PATTERN =
  /bank|banks|credit|finance|financial|insurance|investment|broker|security|securities|mortgage|loan|lending/i;

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

async function fetchSecText(url: string, revalidate: number): Promise<string> {
  const response = await fetch(url, {
    headers: {
      ...secHeaders(),
      Accept: "text/html,text/plain,*/*",
    },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`SEC request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

function getWithHttps(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": YAHOO_USER_AGENT,
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Request failed (${response.statusCode ?? "unknown"}) for ${url}`));
            return;
          }
          resolve(body);
        });
      },
    );

    request.setTimeout(12000, () => {
      request.destroy(new Error("Request timed out."));
    });
    request.on("error", reject);
  });
}

async function getYahooProfile(symbol: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    normalizedSymbol,
  )}?modules=assetProfile`;
  const body = await getWithHttps(url);
  const data = JSON.parse(body) as YahooProfileResponse;
  const error = data.quoteSummary?.error;
  if (error) {
    throw new Error(error.description ?? error.code ?? "Yahoo profile request failed.");
  }
  return { profile: data.quoteSummary?.result?.[0]?.assetProfile, url };
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
  const normalizedQuery = normalizeSearchText(query);
  const normalizedSymbolQuery = normalizeSearchSymbol(query);
  if (normalizedQuery.length < 1) {
    return [];
  }

  const companies = await getTickerList();
  const aliases = companySearchAliases[normalizedQuery] ?? [];
  return companies
    .map((company) => ({
      company,
      score: scoreCompanySearchResult(company, normalizedQuery, normalizedSymbolQuery, aliases),
    }))
    .filter((result) => result.score < Number.POSITIVE_INFINITY)
    .toSorted((a, b) => {
      return a.score - b.score || a.company.symbol.localeCompare(b.company.symbol);
    })
    .map((result) => result.company)
    .slice(0, 12);
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['.,/()]/g, " ")
    .replace(/\b(incorporated|inc|corp|corporation|co|company|class|common|stock|plc|ltd|limited|holdings?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const companySearchAliases: Record<string, string[]> = {
  alphabet: ["GOOG", "GOOGL"],
  amazon: ["AMZN"],
  apple: ["AAPL"],
  berkshire: ["BRK-B", "BRK-A"],
  facebook: ["META"],
  google: ["GOOG", "GOOGL"],
  mastercard: ["MA"],
  meta: ["META"],
  microsoft: ["MSFT"],
  netflix: ["NFLX"],
  nvidia: ["NVDA"],
  tesla: ["TSLA"],
  visa: ["V"],
  walmart: ["WMT"],
};

function scoreCompanySearchResult(
  company: CompanySearchResult,
  normalizedQuery: string,
  normalizedSymbolQuery: string,
  aliases: string[],
) {
  const symbol = company.symbol.toUpperCase();
  const compactSymbol = normalizeSearchSymbol(company.symbol);
  const name = normalizeSearchText(company.name);
  const words = name.split(" ");

  if (compactSymbol === normalizedSymbolQuery || symbol === normalizedSymbolQuery) {
    return 0;
  }

  if (aliases.includes(symbol)) {
    return 1;
  }

  if (name === normalizedQuery) {
    return 2;
  }

  if (words.includes(normalizedQuery)) {
    return 3;
  }

  if (name.startsWith(`${normalizedQuery} `) || name.startsWith(normalizedQuery)) {
    return 4;
  }

  if (compactSymbol.startsWith(normalizedSymbolQuery)) {
    return 5;
  }

  if (name.includes(` ${normalizedQuery} `) || name.includes(normalizedQuery)) {
    return 6;
  }

  if (compactSymbol.includes(normalizedSymbolQuery)) {
    return 7;
  }

  return Number.POSITIVE_INFINITY;
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
  const secFallbackDescription = industry
    ? `SEC filings classify this business under ${industry}. Review the linked annual report for the full business description.`
    : "SEC profile found. Review the linked annual report for the business description.";
  let yahooProfile: Awaited<ReturnType<typeof getYahooProfile>> | undefined;

  try {
    yahooProfile = await getYahooProfile(company.symbol);
  } catch {
    yahooProfile = undefined;
  }

  return {
    symbol: company.symbol,
    name: submissions.name ?? company.name,
    cik: padCik(company.cik),
    exchange,
    sector: yahooProfile?.profile?.sector,
    industry: yahooProfile?.profile?.industry ?? industry,
    description: yahooProfile?.profile?.longBusinessSummary ?? secFallbackDescription,
    website: yahooProfile?.profile?.website,
    employees: yahooProfile?.profile?.fullTimeEmployees,
    source: yahooProfile?.profile?.longBusinessSummary
      ? {
          label: "Yahoo Finance company profile",
          url: yahooProfile.url,
          confidence: "medium",
          note: "Business summary from Yahoo Finance public quoteSummary endpoint; SEC classification remains available through CIK and filings.",
        }
      : {
          label: "SEC submissions",
          url: `${SEC_SUBMISSIONS_URL}/CIK${padCik(company.cik)}.json`,
          confidence: "high",
        },
  };
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function tagValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

export async function getCompanyNews(symbol: string): Promise<CompanyNewsItem[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    normalizedSymbol,
  )}&region=US&lang=en-US`;
  const xml = await getWithHttps(url);
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  return items
    .map(([, item]): CompanyNewsItem | undefined => {
      const title = tagValue(item, "title");
      const link = tagValue(item, "link");
      if (!title || !link) {
        return undefined;
      }

      return {
        title: decodeXmlEntities(title),
        url: decodeXmlEntities(link),
        publishedAt: tagValue(item, "pubDate"),
        source: tagValue(item, "source") ? decodeXmlEntities(tagValue(item, "source") as string) : "Yahoo Finance",
      };
    })
    .filter((item): item is CompanyNewsItem => item !== undefined)
    .slice(0, 6);
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
  fiscalPeriod?: string,
): DataSourceRef {
  return {
    label: `SEC ${conceptName}${unit ? ` (${unit})` : ""}`,
    url: `${SEC_COMPANY_FACTS_URL}/CIK${padCik(cik)}.json`,
    period: fiscalPeriod ? `${fiscalPeriod} ${fiscalYear}` : `FY ${fiscalYear}`,
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

function isInterimPeriod(value: SecFactValue): value is SecFactValue & { fp: "Q1" | "Q2" | "Q3" } {
  return value.fp === "Q1" || value.fp === "Q2" || value.fp === "Q3";
}

function expectedYtdDaysForPeriod(period: "Q1" | "Q2" | "Q3") {
  if (period === "Q1") {
    return { min: 60, max: 130 };
  }

  if (period === "Q2") {
    return { min: 150, max: 220 };
  }

  return { min: 240, max: 310 };
}

function isInterimYtdFact(value: SecFactValue) {
  if (!isFiniteNumber(value.val) || !isInterimPeriod(value) || !(value.form ?? "").startsWith("10-Q")) {
    return false;
  }

  if (!value.start || !value.end) {
    return value.fp === "Q1";
  }

  const startTime = Date.parse(value.start);
  const endTime = Date.parse(value.end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return false;
  }

  const days = (endTime - startTime) / 86_400_000;
  const expected = expectedYtdDaysForPeriod(value.fp);
  return days >= expected.min && days <= expected.max;
}

function fiscalYearFromInterimFact(value: SecFactValue) {
  if (value.fy) {
    return value.fy;
  }

  if (value.end) {
    const endYear = Number(value.end.slice(0, 4));
    if (Number.isInteger(endYear)) {
      return endYear;
    }
  }

  return undefined;
}

function interimExtractsForConcept(
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

  const byPeriod = new Map<string, SecFactValue & { fp: "Q1" | "Q2" | "Q3" }>();
  selectedUnits.values.filter(isInterimYtdFact).forEach((value) => {
    if (!isInterimPeriod(value)) {
      return;
    }

    const fiscalYear = fiscalYearFromInterimFact(value);
    if (!fiscalYear) {
      return;
    }

    const key = `${fiscalYear}-${value.fp}`;
    const existing = byPeriod.get(key);
    if (!existing) {
      byPeriod.set(key, value);
      return;
    }

    const existingFiled = existing.filed ?? "";
    const valueFiled = value.filed ?? "";
    if (valueFiled > existingFiled) {
      byPeriod.set(key, value);
    }
  });

  return Array.from(byPeriod.values())
    .map((value): InterimExtract | undefined => {
      const fiscalYear = fiscalYearFromInterimFact(value);
      if (!fiscalYear) {
        return undefined;
      }

      return {
        fiscalYear,
        fiscalPeriod: value.fp,
        filed: value.filed,
        end: value.end,
        value: value.val as number,
        source: sourceRef(cik, conceptName, fiscalYear, confidence, selectedUnits.unit, value.fp),
      };
    })
    .filter((extract): extract is InterimExtract => extract !== undefined)
    .toSorted((a, b) => {
      const periodRank = { Q1: 1, Q2: 2, Q3: 3 };
      return (
        a.fiscalYear - b.fiscalYear ||
        periodRank[a.fiscalPeriod] - periodRank[b.fiscalPeriod] ||
        (a.end ?? "").localeCompare(b.end ?? "")
      );
    });
}

export function extractInterimFacts(
  facts: SecCompanyFacts,
  cik: string,
  conceptNames: string[],
  preferredUnits: string[],
  confidence: DataSourceRef["confidence"] = "high",
): InterimExtract[] {
  const usGaap = facts.facts?.["us-gaap"];
  if (!usGaap) {
    return [];
  }

  const candidates = conceptNames
    .map((conceptName, index) => {
      const concept = usGaap[conceptName];
      const extracts = concept
        ? interimExtractsForConcept(cik, conceptName, concept, preferredUnits, confidence)
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

function calculateTtmEpsFromInterims(
  annualEps: AnnualExtract[],
  interimEps: InterimExtract[],
) {
  const latestInterim = interimEps
    .toSorted((a, b) => {
      const periodRank = { Q1: 1, Q2: 2, Q3: 3 };
      return (
        b.fiscalYear - a.fiscalYear ||
        periodRank[b.fiscalPeriod] - periodRank[a.fiscalPeriod] ||
        (b.filed ?? "").localeCompare(a.filed ?? "")
      );
    })[0];

  if (!latestInterim) {
    return undefined;
  }

  const latestAnnual = annualEps
    .filter((extract) => extract.fiscalYear === latestInterim.fiscalYear - 1)
    .at(-1);
  const priorComparableInterim = interimEps.find(
    (extract) =>
      extract.fiscalYear === latestInterim.fiscalYear - 1 &&
      extract.fiscalPeriod === latestInterim.fiscalPeriod,
  );

  if (!latestAnnual || !priorComparableInterim) {
    return undefined;
  }

  return {
    fiscalYear: latestInterim.fiscalYear,
    value: latestAnnual.value - priorComparableInterim.value + latestInterim.value,
    source: {
      ...latestInterim.source,
      label: "SEC TTM diluted EPS",
      period: `TTM through ${latestInterim.fiscalPeriod} ${latestInterim.fiscalYear}`,
      confidence: "medium" as const,
      note: `Calculated as FY ${latestAnnual.fiscalYear} EPS - ${priorComparableInterim.fiscalPeriod} ${priorComparableInterim.fiscalYear} EPS + ${latestInterim.fiscalPeriod} ${latestInterim.fiscalYear} EPS.`,
    },
  };
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

function decodeInlineValue(value: string) {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, ""))
    .replace(/[\s,$]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
}

function parseAttributes(tag: string) {
  return Object.fromEntries(
    Array.from(tag.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)).map(([, key, value]) => [key, value]),
  );
}

function parseInlineContexts(html: string) {
  const contexts = new Map<string, { fiscalYear: number; annual: boolean }>();
  for (const match of html.matchAll(/<xbrli:context\b[^>]*>[\s\S]*?<\/xbrli:context>/gi)) {
    const tag = match[0].match(/<xbrli:context\b[^>]*>/i)?.[0] ?? "";
    const attrs = parseAttributes(tag);
    const id = attrs.id;
    const start = match[0].match(/<xbrli:startDate>([^<]+)<\/xbrli:startDate>/i)?.[1];
    const end = match[0].match(/<xbrli:endDate>([^<]+)<\/xbrli:endDate>/i)?.[1];

    if (!id || !start || !end) {
      continue;
    }

    const startTime = Date.parse(start);
    const endTime = Date.parse(end);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      continue;
    }

    const days = (endTime - startTime) / 86_400_000;
    const fiscalYear = Number(end.slice(0, 4));
    if (Number.isInteger(fiscalYear)) {
      contexts.set(id, { fiscalYear, annual: days >= 300 && days <= 400 });
    }
  }

  return contexts;
}

function parseInlineAnnualFacts(
  html: string,
  filing: FilingLink,
  conceptNames: string[],
): InlineFact[] {
  const contexts = parseInlineContexts(html);
  const wanted = new Set(conceptNames);
  const facts: InlineFact[] = [];

  for (const match of html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi)) {
    const attrs = parseAttributes(match[1]);
    const rawName = attrs.name ?? "";
    const conceptName = rawName.split(":").at(-1) ?? rawName;
    if (!wanted.has(conceptName)) {
      continue;
    }

    const context = contexts.get(attrs.contextRef ?? "");
    if (!context?.annual) {
      continue;
    }

    const rawNumber = Number(decodeInlineValue(match[2]));
    const scale = Number(attrs.scale ?? 0);
    const value = Number.isFinite(rawNumber) ? rawNumber * 10 ** (Number.isFinite(scale) ? scale : 0) : NaN;
    if (!Number.isFinite(value)) {
      continue;
    }

    facts.push({
      conceptName,
      fiscalYear: context.fiscalYear,
      value,
      source: {
        label: `SEC inline ${conceptName}`,
        url: filing.url,
        period: `FY ${context.fiscalYear}`,
        confidence: "medium",
      },
    });
  }

  return facts;
}

async function getInlineAnnualFactFallbacks(
  filings: FilingLink[],
  conceptNames: string[],
) {
  const facts: InlineFact[] = [];
  const annualFilings = filings.filter((filing) => filing.form === "10-K").slice(0, 8);

  for (const filing of annualFilings) {
    try {
      const html = await fetchSecText(filing.url, 60 * 60 * 24);
      facts.push(...parseInlineAnnualFacts(html, filing, conceptNames));
    } catch {
      // Company facts remain the primary path; inline filings are best-effort fallbacks.
    }
  }

  return facts;
}

function addInlineFallbacks(
  map: Map<number, AnnualFinancials>,
  facts: InlineFact[],
  conceptNames: string[],
  key: keyof Omit<AnnualFinancials, "fiscalYear" | "sourceFacts">,
) {
  facts
    .filter((fact) => conceptNames.includes(fact.conceptName))
    .forEach((fact) => {
      const row = map.get(fact.fiscalYear);
      if (row && row[key] !== undefined) {
        return;
      }

      setAnnualValue(
        map,
        fact.fiscalYear,
        key,
        { fiscalYear: fact.fiscalYear, value: fact.value, source: fact.source },
      );
    });
}

export async function getCompanyFinancials(symbol: string): Promise<AnnualFinancials[]> {
  const company = await findCompany(symbol);
  if (!company?.cik) {
    throw new Error(`No SEC company found for ${symbol.toUpperCase()}`);
  }

  const submissions = await getSubmissionsByCik(company.cik);
  const isFinancialBusiness = FINANCIAL_INDUSTRY_PATTERN.test(submissions.sicDescription ?? "");

  const facts = await fetchSecJson<SecCompanyFacts>(
    `${SEC_COMPANY_FACTS_URL}/CIK${padCik(company.cik)}.json`,
    60 * 60 * 24,
  );
  const map = new Map<number, AnnualFinancials>();
  const annualEpsExtracts = extractAnnualFacts(facts, company.cik, conceptMap.epsDiluted, unitPreferences.eps);
  const ttmEps = calculateTtmEpsFromInterims(
    annualEpsExtracts,
    extractInterimFacts(facts, company.cik, conceptMap.epsDiluted, unitPreferences.eps),
  );

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
    annualEpsExtracts,
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

  const filings = await getCompanyFilings(symbol);
  const inlineFacts = await getInlineAnnualFactFallbacks(filings, [
    ...conceptMap.epsDiluted,
    ...conceptMap.sharesDiluted,
    ...conceptMap.capex,
  ]);
  addInlineFallbacks(map, inlineFacts, conceptMap.epsDiluted, "epsDiluted");
  addInlineFallbacks(map, inlineFacts, conceptMap.sharesDiluted, "sharesDiluted");
  addInlineFallbacks(map, inlineFacts, conceptMap.capex, "capex");

  if (ttmEps) {
    const row = map.get(ttmEps.fiscalYear) ?? { fiscalYear: ttmEps.fiscalYear, sourceFacts: {} };
    row.ttmEpsDiluted = ttmEps.value;
    row.sourceFacts.ttmEpsDiluted = ttmEps.source;
    map.set(ttmEps.fiscalYear, row);
  }

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
      const financialReturnOnEquity =
        isFinancialBusiness && isFiniteNumber(row.stockholdersEquity)
          ? calculateRoic(row.netIncome, row.stockholdersEquity)
          : undefined;
      const roic = row.roic ?? financialReturnOnEquity ?? calculateRoic(row.netIncome, investedCapital);
      const roicSourceLabel =
        financialReturnOnEquity !== undefined
          ? "Net income / equity (financial business proxy)"
          : "Net income / invested capital";

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
                  label: roicSourceLabel,
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
