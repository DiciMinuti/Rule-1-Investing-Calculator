#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./env.mjs";
import { generateFactPacketWithOpenAI } from "./openai.mjs";
import { validateFactPacket } from "./schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const factsDir = path.join(rootDir, "src/lib/data/qualitative/facts");
const universePath = path.join(rootDir, "src/lib/data/qualitative/universe/us-large-cap-coverage.json");
const SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions";
const SEC_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_ARCHIVES_URL = "https://www.sec.gov/Archives/edgar/data";

await loadLocalEnv(rootDir);

function parseArgs(argv) {
  const options = {
    force: false,
    symbols: [],
  };

  for (const arg of argv) {
    if (arg === "--force") {
      options.force = true;
    } else {
      options.symbols.push(arg.toUpperCase());
    }
  }

  return options;
}

function secHeaders(accept = "application/json,text/plain,*/*") {
  return {
    "User-Agent": process.env.SEC_USER_AGENT ?? "RuleOnePortfolio/0.1 qualitative fact builder",
    Accept: accept,
  };
}

export async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: secHeaders(accept),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

export async function fetchJson(url) {
  return JSON.parse(await fetchText(url, "application/json"));
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function pathExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function normalizeSymbol(symbol) {
  return symbol.trim().toUpperCase();
}

function normalizeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(html) {
  return normalizeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function truncateMiddle(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  const half = Math.floor(maxLength / 2);
  return `${text.slice(0, half)}\n\n[...truncated...]\n\n${text.slice(-half)}`;
}

function filingUrl(cik, filing) {
  const accession = filing.accessionNumber.replaceAll("-", "");
  return `${SEC_ARCHIVES_URL}/${Number(cik)}/${accession}/${filing.primaryDocument}`;
}

function latestFiling(submissions, forms) {
  const recent = submissions.filings?.recent;
  if (!recent?.form?.length) {
    return undefined;
  }

  for (let index = 0; index < recent.form.length; index += 1) {
    if (forms.includes(recent.form[index])) {
      return {
        form: recent.form[index],
        filingDate: recent.filingDate[index],
        accessionNumber: recent.accessionNumber[index],
        primaryDocument: recent.primaryDocument[index],
      };
    }
  }

  return undefined;
}

function latestUsdConcept(companyFacts, conceptName) {
  const values = companyFacts.facts?.["us-gaap"]?.[conceptName]?.units?.USD ?? [];
  const annualValues = values
    .filter((item) => item.form === "10-K" && item.fy && item.val !== undefined)
    .toSorted((a, b) => Number(b.fy) - Number(a.fy) || String(b.filed).localeCompare(String(a.filed)));

  return annualValues[0];
}

function compactFinancialFacts(companyFacts) {
  const concepts = [
    ["Revenue", ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"]],
    ["Net income", ["NetIncomeLoss"]],
    ["Operating cash flow", ["NetCashProvidedByUsedInOperatingActivities"]],
    ["R&D", ["ResearchAndDevelopmentExpense"]],
    ["Stockholders equity", ["StockholdersEquity"]],
    ["Long-term debt", ["LongTermDebtNoncurrent", "LongTermDebt"]],
    ["Cash and equivalents", ["CashAndCashEquivalentsAtCarryingValue"]],
  ];
  const lines = [];

  for (const [label, conceptNames] of concepts) {
    const candidates = conceptNames
      .map((concept) => ({ concept, value: latestUsdConcept(companyFacts, concept) }))
      .filter((candidate) => candidate.value)
      .toSorted(
        (a, b) =>
          Number(b.value.fy) - Number(a.value.fy) ||
          String(b.value.filed).localeCompare(String(a.value.filed)),
      );
    const { concept, value } = candidates[0] ?? {};
    if (!value) {
      continue;
    }

    lines.push(`${label}: ${value.val} USD for FY${value.fy}, filed ${value.filed}, concept ${concept}.`);
  }

  return lines.join("\n");
}

export async function loadSecCompanyBySymbol() {
  const records = Object.values(await fetchJson(SEC_COMPANY_TICKERS_URL));
  return new Map(records.map((record) => [normalizeSymbol(record.ticker), record]));
}

export async function buildSources({ symbol, companyName, secCompany }) {
  const cik = String(secCompany.cik_str).padStart(10, "0");
  const submissions = await fetchJson(`${SEC_SUBMISSIONS_URL}/CIK${cik}.json`);
  const companyFacts = await fetchJson(`${SEC_COMPANY_FACTS_URL}/CIK${cik}.json`);
  const tenK = latestFiling(submissions, ["10-K", "10-K405"]);
  const proxy = latestFiling(submissions, ["DEF 14A"]);
  const sources = [
    {
      label: "SEC company facts summary",
      url: `${SEC_COMPANY_FACTS_URL}/CIK${cik}.json`,
      text: compactFinancialFacts(companyFacts),
    },
    {
      label: "SEC submissions metadata",
      url: `${SEC_SUBMISSIONS_URL}/CIK${cik}.json`,
      text: JSON.stringify(
        {
          symbol,
          companyName,
          secName: submissions.name,
          sicDescription: submissions.sicDescription,
          exchanges: submissions.exchanges,
          tickers: submissions.tickers,
        },
        null,
        2,
      ),
    },
  ];

  if (tenK) {
    const url = filingUrl(cik, tenK);
    const text = htmlToText(await fetchText(url, "text/html,text/plain,*/*"));
    sources.push({
      label: `${tenK.form} filed ${tenK.filingDate}`,
      url,
      text: truncateMiddle(text, 70_000),
    });
  }

  if (proxy) {
    const url = filingUrl(cik, proxy);
    const text = htmlToText(await fetchText(url, "text/html,text/plain,*/*"));
    sources.push({
      label: `${proxy.form} filed ${proxy.filingDate}`,
      url,
      text: truncateMiddle(text, 45_000),
    });
  }

  return sources.filter((source) => source.text.trim().length > 0);
}

function sanitizeText(value) {
  return value
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-");
}

function sanitizeGeneratedJson(value) {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGeneratedJson(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeGeneratedJson(entry)]),
    );
  }

  return value;
}

export async function buildFactPacketForSymbol(symbol, { secBySymbol, universe, force = false }) {
  const filePath = path.join(factsDir, `${symbol}.json`);
  if (!force && (await pathExists(filePath))) {
    console.log(`${symbol}: fact packet exists. Re-run with --force to overwrite.`);
    return { symbol, status: "exists", factPath: filePath };
  }

  const secCompany = secBySymbol.get(symbol);
  if (!secCompany) {
    throw new Error(`${symbol} was not found in SEC company_tickers.json.`);
  }

  const universeCompany = universe.companies.find((company) => company.symbol === symbol);
  const companyName = universeCompany?.name ?? secCompany.title;
  const sources = await buildSources({ symbol, companyName, secCompany });
  const packet = sanitizeGeneratedJson(await generateFactPacketWithOpenAI({ symbol, companyName, sources }));
  const errors = validateFactPacket(packet);

  if (errors.length) {
    throw new Error(`${symbol} fact packet failed validation:\n- ${errors.join("\n- ")}`);
  }

  await mkdir(factsDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(packet, null, 2)}\n`);
  console.log(`${symbol}: wrote ${path.relative(rootDir, filePath)}`);
  return { symbol, status: "generated", factPath: filePath };
}

export async function loadQualitativeUniverse() {
  return readJson(universePath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.symbols.length) {
    console.error("Usage: pnpm qualitative:facts -- NVDA [MSFT ...] [--force]");
    process.exit(1);
  }

  const [secBySymbol, universe] = await Promise.all([loadSecCompanyBySymbol(), loadQualitativeUniverse()]);
  for (const symbol of options.symbols) {
    await buildFactPacketForSymbol(symbol, {
      secBySymbol,
      universe,
      force: options.force,
    });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
