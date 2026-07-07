#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./env.mjs";
import { rebuildBriefIndex } from "./index-briefs.mjs";
import { generateQualitativeBriefWithOpenAI } from "./openai.mjs";
import { validateFactPacket, validateQualitativeBrief } from "./schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const factsDir = path.join(rootDir, "src/lib/data/qualitative/facts");
const briefsDir = path.join(rootDir, "src/lib/data/qualitative/briefs");

await loadLocalEnv(rootDir);

function parseArgs(argv) {
  const options = {
    dryRun: false,
    force: false,
    symbols: [],
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else {
      options.symbols.push(arg.toUpperCase());
    }
  }

  return options;
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

export function sanitizeText(value) {
  return value
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-");
}

export function sanitizeGeneratedJson(value) {
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

export async function generateBriefForSymbol(symbol, options = {}) {
  const mergedOptions = {
    dryRun: false,
    force: false,
    ...options,
  };
  const factPath = path.join(factsDir, `${symbol}.json`);
  const briefPath = path.join(briefsDir, `${symbol}.json`);
  const packet = await readJson(factPath);
  const factErrors = validateFactPacket(packet);

  if (factErrors.length) {
    throw new Error(`${symbol} fact packet failed validation:\n- ${factErrors.join("\n- ")}`);
  }

  if (!mergedOptions.force && !mergedOptions.dryRun && (await pathExists(briefPath))) {
    throw new Error(`${symbol} already has a generated brief. Re-run with --force to overwrite.`);
  }

  if (mergedOptions.dryRun) {
    console.log(`${symbol}: fact packet is valid. Skipping OpenAI call because --dry-run was passed.`);
    return { symbol, status: "dry-run" };
  }

  const brief = sanitizeGeneratedJson(await generateQualitativeBriefWithOpenAI({ packet }));
  const briefErrors = validateQualitativeBrief(brief);
  if (briefErrors.length) {
    throw new Error(`${symbol} generated brief failed validation:\n- ${briefErrors.join("\n- ")}`);
  }

  await mkdir(briefsDir, { recursive: true });
  await writeFile(briefPath, `${JSON.stringify(brief, null, 2)}\n`);
  console.log(`${symbol}: wrote ${path.relative(rootDir, briefPath)}`);
  return { symbol, status: "generated", briefPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.symbols.length) {
    console.error("Usage: pnpm qualitative:generate -- AAPL [MSFT ...] [--dry-run] [--force]");
    process.exit(1);
  }

  for (const symbol of options.symbols) {
    await generateBriefForSymbol(symbol, options);
  }

  if (!options.dryRun) {
    await rebuildBriefIndex();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
