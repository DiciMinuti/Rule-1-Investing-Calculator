#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFactPacketForSymbol,
  loadQualitativeUniverse,
  loadSecCompanyBySymbol,
} from "./build-fact-packet.mjs";
import { rebuildBriefIndex } from "./index-briefs.mjs";
import { generateBriefForSymbol, pathExists, readJson } from "./generate.mjs";
import { validateFactPacket, validateQualitativeBrief } from "./schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const factsDir = path.join(rootDir, "src/lib/data/qualitative/facts");
const briefsDir = path.join(rootDir, "src/lib/data/qualitative/briefs");
const reportsDir = path.join(rootDir, "src/lib/data/qualitative/reports");

function parseArgs(argv) {
  const options = {
    from: undefined,
    to: undefined,
    symbols: [],
    forceFacts: false,
    forceBriefs: false,
    maxRetries: 2,
  };

  for (const arg of argv) {
    if (arg.startsWith("--from=")) {
      options.from = Number(arg.slice("--from=".length));
    } else if (arg.startsWith("--to=")) {
      options.to = Number(arg.slice("--to=".length));
    } else if (arg.startsWith("--symbols=")) {
      options.symbols = arg
        .slice("--symbols=".length)
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);
    } else if (arg === "--force-facts") {
      options.forceFacts = true;
    } else if (arg === "--force-briefs") {
      options.forceBriefs = true;
    } else if (arg.startsWith("--max-retries=")) {
      options.maxRetries = Number(arg.slice("--max-retries=".length));
    }
  }

  if (options.symbols.length) {
    return options;
  }

  if (!Number.isInteger(options.from) || !Number.isInteger(options.to) || options.from < 1 || options.to < options.from) {
    throw new Error("Use either --symbols=AAPL,MSFT or a valid --from=N --to=M range.");
  }

  return options;
}

function nowIso() {
  return new Date().toISOString();
}

function briefAudit(brief) {
  const errors = validateQualitativeBrief(brief);
  const warnings = [];
  const hasConcreteDetail = (text) =>
    /\d|billion|million|revenue|margin|customer|device|segment|cash|asset|store|cloud|product|service|board|proxy|10-K|Form|risk|compensation|shareholder|platform|architecture|GPU|chip|wafer|semiconductor|network|distribution|fulfillment|optical|connectivity|global|office|data center|installed base|portfolio/i.test(
      text,
    );

  for (const section of brief.management?.sections ?? []) {
    if (
      /\btransparent\b|\bethical\b|\bworld[- ]class\b|\bbest[- ]in[- ]class\b/i.test(section.summary) &&
      !hasConcreteDetail(section.summary)
    ) {
      warnings.push(`${section.title}: summary may contain vague praise.`);
    }
  }

  for (const moat of brief.moat?.types ?? []) {
    if (!hasConcreteDetail(moat.summary)) {
      warnings.push(`${moat.type}: moat summary may lack a concrete fact.`);
    }
  }

  return {
    ok: errors.length === 0 && warnings.length === 0,
    errors,
    warnings,
  };
}

async function retryStep(label, maxRetries, action) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      return await action(attempt);
    } catch (error) {
      lastError = error;
      console.error(`${label}: attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && isProviderCapacityError(error.message)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function isProviderCapacityError(message) {
  return /insufficient_quota|insufficient balance|no resource package/i.test(message);
}

function selectCompanies(universe, options) {
  if (options.symbols.length) {
    return options.symbols.map((symbol) => {
      const company = universe.companies.find((item) => item.symbol === symbol);
      if (!company) {
        throw new Error(`${symbol} was not found in the qualitative universe.`);
      }
      return company;
    });
  }

  return universe.companies.slice(options.from - 1, options.to);
}

async function processCompany(company, context, options) {
  const symbol = company.symbol;
  const factPath = path.join(factsDir, `${symbol}.json`);
  const briefPath = path.join(briefsDir, `${symbol}.json`);
  const startedAt = nowIso();
  const result = {
    coverageRank: company.coverageRank,
    symbol,
    name: company.name,
    startedAt,
    completedAt: undefined,
    factStatus: "pending",
    briefStatus: "pending",
    audit: undefined,
    error: undefined,
  };

  try {
    if (options.forceFacts || !(await pathExists(factPath))) {
      await retryStep(`${symbol} facts`, options.maxRetries, () =>
        buildFactPacketForSymbol(symbol, {
          secBySymbol: context.secBySymbol,
          universe: context.universe,
          force: options.forceFacts,
        }),
      );
      result.factStatus = "generated";
    } else {
      const packet = await readJson(factPath);
      const errors = validateFactPacket(packet);
      if (errors.length) {
        throw new Error(`${symbol} existing fact packet failed validation:\n- ${errors.join("\n- ")}`);
      }
      result.factStatus = "existing";
    }

    if (options.forceBriefs || !(await pathExists(briefPath))) {
      await retryStep(`${symbol} brief`, options.maxRetries, () =>
        generateBriefForSymbol(symbol, {
          force: options.forceBriefs,
        }),
      );
      result.briefStatus = "generated";
    } else {
      result.briefStatus = "existing";
    }

    const brief = await readJson(briefPath);
    result.audit = briefAudit(brief);
    if (!result.audit.ok) {
      throw new Error(
        `${symbol} brief audit failed:\n- ${[...result.audit.errors, ...result.audit.warnings].join("\n- ")}`,
      );
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    result.completedAt = nowIso();
  }

  return result;
}

async function writeReport(report) {
  await mkdir(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `batch-${report.startedAt.replace(/[:.]/g, "-")}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

const options = parseArgs(process.argv.slice(2));
const universe = await loadQualitativeUniverse();
const companies = selectCompanies(universe, options);
const secBySymbol = await loadSecCompanyBySymbol();
const report = {
  startedAt: nowIso(),
  completedAt: undefined,
  options,
  companies: [],
};

for (const company of companies) {
  console.log(`\n${company.coverageRank}. ${company.symbol} ${company.name}`);
  const result = await processCompany(company, { secBySymbol, universe }, options);
  report.companies.push(result);

  if (result.error) {
    console.error(`${company.symbol}: failed\n${result.error}`);
    if (isProviderCapacityError(result.error)) {
      console.error("Stopping batch because the model provider account is out of quota or balance.");
      break;
    }
  } else {
    console.log(`${company.symbol}: ok (${result.factStatus} facts, ${result.briefStatus} brief)`);
  }

  await writeReport({ ...report, completedAt: nowIso() });
}

await rebuildBriefIndex();
report.completedAt = nowIso();
const reportPath = await writeReport(report);
const failed = report.companies.filter((company) => company.error);

console.log(`\nWrote report to ${path.relative(rootDir, reportPath)}`);
console.log(`${report.companies.length - failed.length}/${report.companies.length} passed.`);

if (failed.length) {
  process.exit(1);
}
