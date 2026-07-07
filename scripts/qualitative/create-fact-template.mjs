#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const factsDir = path.join(rootDir, "src/lib/data/qualitative/facts");

function factTemplate(symbol) {
  return {
    symbol,
    companyName: "",
    updatedAt: new Date().toISOString().slice(0, 10),
    facts: [
      {
        topic: "Business model",
        statement: "",
        source: "",
      },
      {
        topic: "Segments",
        statement: "",
        source: "",
      },
      {
        topic: "Management",
        statement: "",
        source: "",
      },
      {
        topic: "Capital allocation",
        statement: "",
        source: "",
      },
      {
        topic: "Moat evidence",
        statement: "",
        source: "",
      },
    ],
  };
}

const symbols = process.argv.slice(2).map((symbol) => symbol.toUpperCase());
if (!symbols.length) {
  console.error("Usage: pnpm qualitative:template -- AAPL [MSFT ...]");
  process.exit(1);
}

await mkdir(factsDir, { recursive: true });

for (const symbol of symbols) {
  const filePath = path.join(factsDir, `${symbol}.json`);
  await writeFile(filePath, `${JSON.stringify(factTemplate(symbol), null, 2)}\n`, { flag: "wx" });
  console.log(`${symbol}: wrote ${path.relative(rootDir, filePath)}`);
}
