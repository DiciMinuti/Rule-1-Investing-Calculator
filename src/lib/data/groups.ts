import type {
  BusinessGroupConstituent,
  BusinessGroupDetail,
  BusinessGroupKind,
  BusinessGroupSummary,
  DataSourceRef,
} from "@/lib/types";
import { getTickerList, padCik } from "@/lib/data/sec";

const SP500_RAW_URL =
  "https://en.wikipedia.org/w/index.php?title=List_of_S%26P_500_companies&action=raw";
const SP500_PAGE_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const WIKIPEDIA_SOURCE: DataSourceRef = {
  label: "Wikipedia S&P 500 constituents",
  url: SP500_PAGE_URL,
  confidence: "medium",
};
const GROUP_RESULT_LIMIT = 18;

type Sp500RawConstituent = {
  displaySymbol: string;
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  cik?: string;
};

type GroupCatalog = {
  groups: BusinessGroupDetail[];
  updatedAt: string;
};

let catalogCache: GroupCatalog | null = null;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeGroupSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(and|the|services?|companies|businesses|sector|industry|industries)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGroupSymbolForSec(symbol: string) {
  return normalizeWhitespace(symbol).toUpperCase().replaceAll(".", "-");
}

function cleanWikiCell(value: string) {
  let text = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/\{\{(?:NyseSymbol|NasdaqSymbol|NYSEAmericanSymbol)\|([^}|]+)[^}]*\}\}/gi, "$1");

  for (let index = 0; index < 4; index += 1) {
    text = text.replace(/\{\{[^{}|]*\|([^{}]*)\}\}/g, "$1");
  }

  return normalizeWhitespace(
    text
      .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, "$1")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/'''?/g, "")
      .replace(/&amp;/g, "&"),
  );
}

export function parseSp500ConstituentsFromWikitext(wikitext: string): Sp500RawConstituent[] {
  const tableStart = wikitext.indexOf('id="constituents"');
  if (tableStart < 0) {
    return [];
  }

  const tableEnd = wikitext.indexOf("\n|}", tableStart);
  const table = wikitext.slice(tableStart, tableEnd > tableStart ? tableEnd : undefined);
  const rows = table.split(/\n\|-\s*\n/g);

  return rows.flatMap((row) => {
    const trimmed = row.trim();
    if (!trimmed.startsWith("|") || trimmed.startsWith("|}") || trimmed.includes("! Security")) {
      return [];
    }

    const cells = trimmed
      .replace(/^\|\s*/, "")
      .replace(/\n\|/g, "||")
      .split("||")
      .map(cleanWikiCell);
    const [displaySymbol, name, sector, industry, , , cik] = cells;

    if (!displaySymbol || !name || !sector || !industry) {
      return [];
    }

    return [
      {
        displaySymbol,
        symbol: normalizeGroupSymbolForSec(displaySymbol),
        name,
        sector,
        industry,
        cik: cik ? padCik(cik) : undefined,
      },
    ];
  });
}

async function fetchSp500Constituents() {
  const response = await fetch(SP500_RAW_URL, {
    headers: {
      Accept: "text/plain,*/*",
      "User-Agent": "RuleOnePortfolio/0.1 group screener contact: local@example.com",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`S&P 500 constituent request failed (${response.status}).`);
  }

  const wikitext = await response.text();
  const constituents = parseSp500ConstituentsFromWikitext(wikitext);
  if (constituents.length < 400) {
    throw new Error("S&P 500 constituent source returned too few rows.");
  }

  return constituents;
}

function makeSummary({
  id,
  name,
  kind,
  count,
  description,
}: {
  id: string;
  name: string;
  kind: BusinessGroupKind;
  count: number;
  description: string;
}): BusinessGroupSummary {
  return {
    id,
    name,
    kind,
    count,
    description,
    source: WIKIPEDIA_SOURCE,
  };
}

function groupByValue(constituents: BusinessGroupConstituent[], key: "sector" | "industry") {
  const groups = new Map<string, BusinessGroupConstituent[]>();
  constituents.forEach((constituent) => {
    const value = constituent[key];
    if (!value) {
      return;
    }

    groups.set(value, [...(groups.get(value) ?? []), constituent]);
  });
  return groups;
}

async function buildCatalog(): Promise<GroupCatalog> {
  const [rawConstituents, secCompanies] = await Promise.all([fetchSp500Constituents(), getTickerList()]);
  const rankBySymbol = new Map(secCompanies.map((company, index) => [company.symbol, index + 1]));
  const secBySymbol = new Map(secCompanies.map((company) => [company.symbol, company]));
  const updatedAt = new Date().toISOString();
  const constituents: BusinessGroupConstituent[] = rawConstituents
    .map((constituent) => {
      const secCompany = secBySymbol.get(constituent.symbol);
      return {
        ...constituent,
        name: secCompany?.name ?? constituent.name,
        cik: secCompany?.cik ?? constituent.cik,
        rank: rankBySymbol.get(constituent.symbol),
      };
    })
    .toSorted(
      (a, b) =>
        (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
        a.symbol.localeCompare(b.symbol),
    );

  const groups: BusinessGroupDetail[] = [
    {
      ...makeSummary({
        id: "sp500",
        name: "S&P 500",
        kind: "index",
        count: constituents.length,
        description: `${constituents.length} large-cap U.S. index constituents, ordered by app relevance where available.`,
      }),
      constituents,
      updatedAt,
    },
  ];

  groupByValue(constituents, "sector").forEach((items, sector) => {
    groups.push({
      ...makeSummary({
        id: `sector:${slugify(sector)}`,
        name: sector,
        kind: "sector",
        count: items.length,
        description: `${items.length} S&P 500 businesses in ${sector}.`,
      }),
      constituents: items,
      updatedAt,
    });
  });

  groupByValue(constituents, "industry").forEach((items, industry) => {
    groups.push({
      ...makeSummary({
        id: `industry:${slugify(industry)}`,
        name: industry,
        kind: "industry",
        count: items.length,
        description: `${items.length} S&P 500 businesses in ${industry}.`,
      }),
      constituents: items,
      updatedAt,
    });
  });

  return { groups, updatedAt };
}

async function getCatalog() {
  if (!catalogCache) {
    catalogCache = await buildCatalog();
  }

  return catalogCache;
}

const groupSearchAliases: Record<string, string[]> = {
  bank: ["Financials"],
  banks: ["Financials"],
  communication: ["Communication Services"],
  communications: ["Communication Services"],
  consumer: ["Consumer Discretionary", "Consumer Staples"],
  energy: ["Energy"],
  finance: ["Financials"],
  financial: ["Financials"],
  healthcare: ["Health Care"],
  health: ["Health Care"],
  industrial: ["Industrials"],
  insurance: ["Financials"],
  realestate: ["Real Estate"],
  reit: ["Real Estate"],
  software: ["Information Technology"],
  tech: ["Information Technology"],
  technology: ["Information Technology"],
  utilities: ["Utilities"],
};

function groupSearchText(group: BusinessGroupSummary) {
  return normalizeGroupSearchText(`${group.id} ${group.name} ${group.kind} ${group.description}`);
}

function groupSearchScore(group: BusinessGroupSummary, query: string, aliases: string[]) {
  const normalizedName = normalizeGroupSearchText(group.name);
  const normalizedId = normalizeGroupSearchText(group.id);
  const normalizedKind = normalizeGroupSearchText(group.kind);
  const normalizedDescription = normalizeGroupSearchText(group.description);

  if (normalizedId === query || normalizedName === query) {
    return 0;
  }

  if (aliases.some((alias) => normalizeGroupSearchText(alias) === normalizedName)) {
    return 1;
  }

  if (normalizedId.includes(query) || normalizedName.startsWith(query)) {
    return 2;
  }

  if (normalizedName.includes(query)) {
    return 3;
  }

  if (normalizedKind === query) {
    return 4;
  }

  if (normalizedDescription.includes(query)) {
    return 5;
  }

  return Number.POSITIVE_INFINITY;
}

export async function searchBusinessGroups(query: string): Promise<BusinessGroupSummary[]> {
  const normalizedQuery = normalizeGroupSearchText(query);
  const catalog = await getCatalog();
  const summaries = catalog.groups.map((group) => ({
    id: group.id,
    name: group.name,
    kind: group.kind,
    count: group.count,
    description: group.description,
    source: group.source,
  }));

  if (!normalizedQuery) {
    return summaries
      .filter((group) => group.kind !== "industry")
      .toSorted((a, b) => (a.kind === "index" ? -1 : b.kind === "index" ? 1 : b.count - a.count))
      .slice(0, GROUP_RESULT_LIMIT);
  }

  const aliases = groupSearchAliases[normalizedQuery.replace(/\s+/g, "")] ?? groupSearchAliases[normalizedQuery] ?? [];
  return summaries
    .map((group) => ({
      group,
      score: groupSearchScore(group, normalizedQuery, aliases),
    }))
    .filter((result) => result.score < Number.POSITIVE_INFINITY || groupSearchText(result.group).includes(normalizedQuery))
    .toSorted(
      (a, b) =>
        a.score - b.score ||
        b.group.count - a.group.count ||
        a.group.name.localeCompare(b.group.name),
    )
    .map((result) => result.group)
    .slice(0, GROUP_RESULT_LIMIT);
}

export async function getBusinessGroup(groupId: string): Promise<BusinessGroupDetail | undefined> {
  const catalog = await getCatalog();
  return catalog.groups.find((group) => group.id === groupId);
}
