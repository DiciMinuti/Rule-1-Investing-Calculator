import { filingHtmlToText, normalizeFilingText } from "@/lib/data/filing-text";
import { selectManagementDocuments } from "@/lib/data/management-documents";
import { getCompanyFilings } from "@/lib/data/sec";
import type {
  DataSourceRef,
  ManagementBrief,
  ManagementDocument,
  ManagementDocumentKind,
  ManagementSignal,
  ManagementTable,
} from "@/lib/types";

const USER_AGENT =
  process.env.SEC_USER_AGENT ?? "RuleOnePortfolio/0.1 personal research app contact: local@example.com";

type SignalConfig = {
  id: ManagementSignal["id"];
  label: string;
  question: string;
  documentKinds: ManagementDocumentKind[];
  patterns: RegExp[];
  keywords: string[];
  foundSummary: (document: ManagementDocument) => string;
  reviewSummary: (document: ManagementDocument) => string;
  missingSummary: string;
};

type FilingTextResult = {
  document: ManagementDocument;
  text?: string;
  error?: string;
};

type ManagementExtraction = {
  tables?: ManagementTable[];
  excerpts?: string[];
};

const signalConfigs: SignalConfig[] = [
  {
    id: "leaders",
    label: "Leadership",
    question: "Who leads the business, and how long have they been in the business?",
    documentKinds: ["annualReport", "proxy"],
    patterns: [
      /information about (our )?executive officers/i,
      /executive officers/i,
      /directors and executive officers/i,
      /management team/i,
    ],
    keywords: ["chief executive officer", "president", "age", "since", "joined", "appointed", "served"],
    foundSummary: (document) =>
      `Found an executive leadership section in the ${document.form} filed ${document.filingDate}. Use this source to confirm names, roles, background, and tenure.`,
    reviewSummary: (document) =>
      `Open the ${document.form} filed ${document.filingDate} to review executive officers and leadership tenure. The app found the filing but could not isolate the exact leadership section.`,
    missingSummary:
      "No annual report or proxy statement was available from the latest SEC filing list, so leadership details need manual review.",
  },
  {
    id: "compensation",
    label: "Compensation",
    question: "What are the leaders paid, including salary and total compensation?",
    documentKinds: ["proxy"],
    patterns: [
      /summary compensation table/i,
      /compensation discussion and analysis/i,
      /executive compensation/i,
      /named executive officers/i,
    ],
    keywords: ["salary", "bonus", "stock awards", "option awards", "non-equity", "total", "$"],
    foundSummary: (document) =>
      `Found executive compensation evidence in the latest proxy filed ${document.filingDate}. The Summary Compensation Table is the primary source for salary and total compensation.`,
    reviewSummary: (document) =>
      `Open the latest proxy filed ${document.filingDate} and review the executive compensation tables. The proxy is available, but the exact compensation table was not isolated reliably.`,
    missingSummary:
      "No latest DEF 14A proxy statement was available from the SEC filing list. Salary and total compensation usually require that proxy.",
  },
  {
    id: "ownership",
    label: "Ownership",
    question: "How much stock do leaders and directors own?",
    documentKinds: ["proxy"],
    patterns: [
      /security ownership of certain beneficial owners/i,
      /beneficial ownership/i,
      /stock ownership/i,
      /ownership of securities/i,
    ],
    keywords: ["shares", "beneficially", "percent", "%", "directors", "executive officers", "outstanding"],
    foundSummary: (document) =>
      `Found ownership evidence in the latest proxy filed ${document.filingDate}. This is the source to review insider shares and ownership percentages.`,
    reviewSummary: (document) =>
      `Open the latest proxy filed ${document.filingDate} and review the beneficial ownership table. The proxy is available, but the exact ownership section was not isolated reliably.`,
    missingSummary:
      "No latest DEF 14A proxy statement was available from the SEC filing list. Insider ownership usually requires the proxy beneficial ownership table.",
  },
  {
    id: "shareholderLetter",
    label: "CEO Letter",
    question: "What does the latest CEO or shareholder letter say?",
    documentKinds: ["annualReport", "proxy"],
    patterns: [
      /dear (fellow )?(shareholders|stockholders)/i,
      /letter to (our )?(shareholders|stockholders)/i,
      /fellow (shareholders|stockholders)/i,
      /(chairman|ceo|chief executive officer)(?:'s|’s)? letter/i,
    ],
    keywords: ["shareholders", "stockholders", "ceo", "chief executive", "year", "capital", "customers"],
    foundSummary: (document) =>
      `Found shareholder-letter language in the ${document.form} filed ${document.filingDate}. Review the excerpt and source document for management's tone and priorities.`,
    reviewSummary: (document) =>
      `Open the ${document.form} filed ${document.filingDate} to look for shareholder communication. A dedicated CEO letter was not isolated from the SEC document text.`,
    missingSummary:
      "No CEO or shareholder letter was identifiable in the latest SEC documents. Some companies publish letters only in glossy annual reports or investor relations pages.",
  },
];

function signalSource(document: ManagementDocument, confidence: DataSourceRef["confidence"]): DataSourceRef {
  return {
    label: `${document.label} (${document.form}, filed ${document.filingDate})`,
    url: document.viewerUrl,
    period: document.filingDate,
    confidence,
  };
}

function globalRegExp(pattern: RegExp) {
  const flags = new Set(`${pattern.flags}gi`.split(""));
  return new RegExp(pattern.source, Array.from(flags).join(""));
}

function scoreExcerpt(excerpt: string, keywords: string[]) {
  const lowerExcerpt = excerpt.toLowerCase();
  const keywordScore = keywords.reduce(
    (score, keyword) => score + (lowerExcerpt.includes(keyword.toLowerCase()) ? 2 : 0),
    0,
  );
  const tableScore = /salary|shares|\$|%|total|chief executive officer/i.test(excerpt) ? 2 : 0;
  const yearScore = /\b(?:19|20)\d{2}\b/.test(excerpt) ? 1 : 0;
  const tocPenalty = /table of contents/i.test(excerpt) ? -5 : 0;

  return keywordScore + tableScore + yearScore + tocPenalty;
}

function truncateExcerpt(value: string, maxLength = 680) {
  if (value.length <= maxLength) {
    return value;
  }

  const cutIndex = value.lastIndexOf(" ", maxLength - 1);
  return `${value.slice(0, cutIndex > 0 ? cutIndex : maxLength).trim()}...`;
}

function cleanFilingLine(line: string) {
  return line
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[•▪]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNavigationLine(line: string) {
  return (
    /^table of contents$/i.test(line) ||
    /^proxy summary$/i.test(line) ||
    /^corporate$/i.test(line) ||
    /^governance at$/i.test(line) ||
    /^american express$/i.test(line) ||
    /^responsibility and$/i.test(line) ||
    /^sustainability$/i.test(line) ||
    /^audit committee$/i.test(line) ||
    /^matters$/i.test(line) ||
    /^executive$/i.test(line) ||
    /^compensation$/i.test(line) ||
    /^shareholder$/i.test(line) ||
    /^proposals$/i.test(line) ||
    /^stock ownership$/i.test(line) ||
    /^information$/i.test(line) ||
    /^other$/i.test(line) ||
    /^\d{4}\s+proxy statement\s+\d+$/i.test(line) ||
    /^\d+\s+\d{4}\s+proxy statement$/i.test(line) ||
    /^proxy$/i.test(line) ||
    /^summary$/i.test(line)
  );
}

function filingLines(text: string, { keepSymbols = false }: { keepSymbols?: boolean } = {}) {
  return normalizeFilingText(text)
    .split("\n")
    .map(cleanFilingLine)
    .filter((line) => {
      if (!line || line === "$" || isNavigationLine(line)) {
        return false;
      }

      if (!keepSymbols && /^[^\p{L}\p{N}$%]+$/u.test(line)) {
        return false;
      }

      return true;
    });
}

function sectionFromHeading(text: string, startPattern: RegExp, endPatterns: RegExp[]) {
  const normalizedText = normalizeFilingText(text);
  const startMatch = normalizedText.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    return undefined;
  }

  const sectionStart = startMatch.index;
  const afterStart = normalizedText.slice(sectionStart + startMatch[0].length);
  const endIndexes = endPatterns
    .map((pattern) => {
      const match = afterStart.match(pattern);
      return match?.index;
    })
    .filter((index): index is number => index !== undefined);
  const sectionEnd = endIndexes.length ? sectionStart + startMatch[0].length + Math.min(...endIndexes) : undefined;

  return normalizedText.slice(sectionStart, sectionEnd);
}

function nameCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bMc([a-z])/g, (_match, letter: string) => `Mc${letter.toUpperCase()}`);
}

function stripFootnotes(value: string) {
  return value.replace(/\s+\((?:\d+|[a-z])\)$/i, "").trim();
}

function moneyCell(value: string | undefined) {
  if (!value) {
    return "—";
  }

  const cleanValue = stripFootnotes(value);
  if (/^(?:n\/a|—|-|\*)$/i.test(cleanValue)) {
    return cleanValue === "*" ? "Less than 1%" : cleanValue.toUpperCase();
  }

  return /^[\d,]+(?:\.\d+)?$/.test(cleanValue) ? `$${cleanValue}` : cleanValue;
}

function percentCell(value: string | undefined) {
  if (!value) {
    return "—";
  }

  const cleanValue = stripFootnotes(value).replace(/\s+%$/, "%");
  if (cleanValue === "*") {
    return "Less than 1%";
  }

  return cleanValue;
}

function isYearLine(value: string) {
  return /^(?:19|20)\d{2}$/.test(value);
}

function isAmountLike(value: string) {
  return /^(?:[\d,]+(?:\.\d+)?(?:\s+\(\d+\))?|N\/A|—|-|\*)$/i.test(value);
}

function isPercentLike(value: string) {
  return /^(?:\*|less than 1%|[\d.]+\s*%)$/i.test(value);
}

function tableRowsCount(tables: ManagementTable[] | undefined) {
  return tables?.reduce((count, table) => count + table.rows.length, 0) ?? 0;
}

function extractLeadership(document: ManagementDocument, text: string): ManagementExtraction | undefined {
  const section = sectionFromHeading(text, /information about (our )?executive officers/i, [
    /\n\s*competition\s*\n/i,
    /\n\s*item\s+1a/i,
    /\n\s*risk factors/i,
  ]);

  if (!section) {
    return undefined;
  }

  const rows: Record<string, string>[] = [];
  const lines = filingLines(section);

  for (let index = 0; index < lines.length; index += 1) {
    const officerMatch = lines[index].match(/^([A-Z][A-Z .'\-]+?)\s+[—-]\s*(.*)$/);
    if (!officerMatch) {
      continue;
    }

    let role = officerMatch[2].trim();
    const detailLines: string[] = [];
    let cursor = index + 1;

    while (
      cursor < lines.length &&
      !/^(?:Mr|Ms|Mrs|Dr)\./.test(lines[cursor]) &&
      !/^[A-Z][A-Z .'\-]+?\s+[—-]/.test(lines[cursor])
    ) {
      role = [role, lines[cursor]].filter(Boolean).join(" ");
      cursor += 1;
    }

    while (cursor < lines.length && !/^[A-Z][A-Z .'\-]+?\s+[—-]/.test(lines[cursor])) {
      if (/^competition$/i.test(lines[cursor])) {
        break;
      }

      detailLines.push(lines[cursor]);
      cursor += 1;
    }

    const background = detailLines.join(" ").trim();
    if (!role || !background) {
      continue;
    }

    const age = background.match(/\((\d{2})\)/)?.[1] ?? "—";
    rows.push({
      name: nameCase(officerMatch[1]),
      role,
      age,
      background,
    });

    index = cursor - 1;
  }

  if (!rows.length) {
    return undefined;
  }

  return {
    tables: [
      {
        id: "leadership",
        note: `Executive officers from ${document.form} filed ${document.filingDate}.`,
        columns: [
          { key: "name", label: "Name", minWidth: "170px" },
          { key: "role", label: "Role", minWidth: "220px" },
          { key: "age", label: "Age", align: "end", minWidth: "56px" },
          { key: "background", label: "Tenure / Background", minWidth: "420px" },
        ],
        rows,
      },
    ],
  };
}

function findSummaryCompensationStart(lines: string[]) {
  return lines.findIndex(
    (line, index) =>
      /^summary compensation table$/i.test(line) &&
      lines.slice(index, index + 90).some((candidate) => /^name and$/i.test(candidate)) &&
      lines.slice(index, index + 180).some((candidate) => isYearLine(candidate)),
  );
}

function extractCompensation(document: ManagementDocument, text: string): ManagementExtraction | undefined {
  const lines = filingLines(text);
  const tableStart = findSummaryCompensationStart(lines);
  if (tableStart < 0) {
    return undefined;
  }

  const totalHeaderIndex = lines.findIndex((line, index) => index > tableStart && /^total$/i.test(line));
  if (totalHeaderIndex < 0) {
    return undefined;
  }

  const rows: Record<string, string>[] = [];
  let cursor = totalHeaderIndex + 1;

  while (cursor < lines.length && !/^\(\d+\)$/.test(lines[cursor])) {
    const name = lines[cursor];
    if (!name || isYearLine(name) || isAmountLike(name)) {
      cursor += 1;
      continue;
    }

    const roleLines: string[] = [];
    cursor += 1;

    while (cursor < lines.length && !isYearLine(lines[cursor]) && roleLines.length < 4) {
      if (/^\(\d+\)$/.test(lines[cursor])) {
        break;
      }

      roleLines.push(lines[cursor]);
      cursor += 1;
    }

    if (!isYearLine(lines[cursor])) {
      break;
    }

    const latestYear = lines[cursor];
    cursor += 1;

    const values: string[] = [];
    while (cursor < lines.length && values.length < 7) {
      values.push(lines[cursor]);
      cursor += 1;
    }

    if (values.length === 7) {
      rows.push({
        name,
        role: roleLines.join(" "),
        year: latestYear,
        salary: moneyCell(values[0]),
        bonus: moneyCell(values[1]),
        stockAwards: moneyCell(values[2]),
        optionAwards: moneyCell(values[3]),
        pension: moneyCell(values[4]),
        other: moneyCell(values[5]),
        total: moneyCell(values[6]),
      });
    }

    while (isYearLine(lines[cursor])) {
      cursor += 8;
    }
  }

  if (!rows.length) {
    return undefined;
  }

  return {
    tables: [
      {
        id: "compensation",
        note: `Latest year shown for each named executive officer in the Summary Compensation Table from ${document.form} filed ${document.filingDate}.`,
        columns: [
          { key: "name", label: "Executive", minWidth: "150px" },
          { key: "role", label: "Role", minWidth: "210px" },
          { key: "year", label: "Year", align: "end", minWidth: "64px" },
          { key: "salary", label: "Salary", align: "end", minWidth: "104px" },
          { key: "bonus", label: "Bonus / Incentive", align: "end", minWidth: "130px" },
          { key: "stockAwards", label: "Stock Awards", align: "end", minWidth: "126px" },
          { key: "optionAwards", label: "Option Awards", align: "end", minWidth: "126px" },
          { key: "pension", label: "Pension / Deferred", align: "end", minWidth: "138px" },
          { key: "other", label: "Other", align: "end", minWidth: "104px" },
          { key: "total", label: "Total", align: "end", minWidth: "116px" },
        ],
        rows,
      },
    ],
  };
}

function isAddressLine(line: string) {
  return (
    /^\d+\s/.test(line) ||
    (/\d/.test(line) &&
      /\b(?:street|st\.?|blvd|boulevard|avenue|ave\.?|road|rd\.?|drive|dr\.?|ny|ne|ca|ma|pa|il|tx|fl)\b/i.test(line))
  );
}

function cleanHolderName(nameLines: string[]) {
  const name = nameLines
    .filter((line) => !isAddressLine(line))
    .join(" ")
    .replace(/\s+\((\d+)\)$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return stripFootnotes(name);
}

function findOwnershipStart(lines: string[]) {
  return lines.findIndex(
    (line, index) =>
      /^stock ownership information$/i.test(line) &&
      lines.slice(index, index + 40).some((candidate) => /shares owned/i.test(candidate)) &&
      lines.slice(index, index + 60).some((candidate) => /percent of/i.test(candidate)),
  );
}

function extractOwnership(document: ManagementDocument, text: string): ManagementExtraction | undefined {
  const lines = filingLines(text, { keepSymbols: true });
  const tableStart = findOwnershipStart(lines);
  if (tableStart < 0) {
    return undefined;
  }

  const nameHeaderIndex = lines.findIndex((line, index) => index > tableStart && /^name$/i.test(line));
  const headerEnd = lines.findIndex((line, index) => index > nameHeaderIndex && /owned by director/i.test(line));
  if (headerEnd < 0) {
    return undefined;
  }

  const rows: Record<string, string>[] = [];
  let cursor = headerEnd + 1;

  while (cursor < lines.length && !/^\(1\)$/.test(lines[cursor]) && !/^delinquent section/i.test(lines[cursor])) {
    const nameLines: string[] = [];

    while (cursor < lines.length && !isAmountLike(lines[cursor])) {
      if (/^\(\d+\)$/.test(lines[cursor]) || /^less than 1%$/i.test(lines[cursor])) {
        break;
      }

      nameLines.push(lines[cursor]);
      cursor += 1;
    }

    const holder = cleanHolderName(nameLines);
    if (!holder || cursor >= lines.length || !isAmountLike(lines[cursor])) {
      cursor += 1;
      continue;
    }

    const sharesOwned = lines[cursor];
    cursor += 1;
    const betweenCells: string[] = [];

    while (cursor < lines.length && !isPercentLike(lines[cursor]) && betweenCells.length < 4) {
      if (isAmountLike(lines[cursor])) {
        betweenCells.push(lines[cursor]);
      }

      cursor += 1;
    }

    const percent = isPercentLike(lines[cursor]) ? lines[cursor] : undefined;
    if (percent) {
      cursor += 1;
    }

    if (isAmountLike(lines[cursor])) {
      cursor += 1;
    }

    rows.push({
      holder,
      sharesOwned: stripFootnotes(sharesOwned),
      rightToAcquire: stripFootnotes(betweenCells.at(-1) ?? "—"),
      percent: percentCell(percent),
    });
  }

  if (!rows.length) {
    return undefined;
  }

  return {
    tables: [
      {
        id: "ownership",
        note: `Beneficial ownership table from ${document.form} filed ${document.filingDate}.`,
        columns: [
          { key: "holder", label: "Holder / Group", minWidth: "270px" },
          { key: "sharesOwned", label: "Shares Owned", align: "end", minWidth: "130px" },
          { key: "rightToAcquire", label: "Right to Acquire", align: "end", minWidth: "138px" },
          { key: "percent", label: "% Class", align: "end", minWidth: "96px" },
        ],
        rows,
      },
    ],
  };
}

function structuredExtraction(
  config: SignalConfig,
  document: ManagementDocument,
  text: string,
): ManagementExtraction | undefined {
  if (config.id === "leaders") {
    return extractLeadership(document, text);
  }

  if (config.id === "compensation") {
    return extractCompensation(document, text);
  }

  if (config.id === "ownership") {
    return extractOwnership(document, text);
  }

  return undefined;
}

function excerptAround(text: string, index: number) {
  return truncateExcerpt(
    text
      .slice(index, Math.min(text.length, index + 1_400))
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function findBestExcerpt(text: string, config: SignalConfig) {
  const normalizedText = normalizeFilingText(text);
  let best: { index: number; score: number } | undefined;

  for (const pattern of config.patterns) {
    const matcher = globalRegExp(pattern);
    let match: RegExpExecArray | null;
    let matchCount = 0;

    while ((match = matcher.exec(normalizedText)) && matchCount < 80) {
      const index = match.index;
      const window = normalizedText.slice(
        Math.max(0, index - 250),
        Math.min(normalizedText.length, index + 2_200),
      );
      const score = scoreExcerpt(window, config.keywords);

      if (!best || score > best.score) {
        best = { index, score };
      }

      matchCount += 1;
    }
  }

  if (!best || best.score < 1) {
    return undefined;
  }

  return excerptAround(normalizedText, best.index);
}

function signalFromConfig(
  config: SignalConfig,
  documents: ManagementDocument[],
  documentTexts: Partial<Record<ManagementDocumentKind, string>>,
): ManagementSignal {
  const candidateDocuments = config.documentKinds
    .map((kind) => documents.find((document) => document.kind === kind))
    .filter((document): document is ManagementDocument => document !== undefined);

  for (const document of candidateDocuments) {
    const text = documentTexts[document.kind];
    if (!text) {
      continue;
    }

    const extraction = structuredExtraction(config, document, text);
    if (extraction && (tableRowsCount(extraction.tables) > 0 || extraction.excerpts?.length)) {
      return {
        id: config.id,
        label: config.label,
        question: config.question,
        status: "found",
        summary: config.foundSummary(document),
        source: signalSource(document, "high"),
        tables: extraction.tables,
        excerpts: extraction.excerpts ?? [],
      };
    }

    if (config.id !== "shareholderLetter") {
      continue;
    }

    const excerpt = findBestExcerpt(text, config);
    if (excerpt) {
      return {
        id: config.id,
        label: config.label,
        question: config.question,
        status: "found",
        summary: config.foundSummary(document),
        source: signalSource(document, "high"),
        excerpts: [excerpt],
      };
    }
  }

  const reviewDocument = candidateDocuments[0];
  if (reviewDocument) {
    return {
      id: config.id,
      label: config.label,
      question: config.question,
      status: "needs-review",
      summary: config.reviewSummary(reviewDocument),
      source: signalSource(reviewDocument, "medium"),
      excerpts: [],
    };
  }

  return {
    id: config.id,
    label: config.label,
    question: config.question,
    status: "missing",
    summary: config.missingSummary,
    excerpts: [],
  };
}

export function buildManagementBriefFromTexts({
  symbol,
  documents,
  documentTexts,
  warnings = [],
}: {
  symbol: string;
  documents: ManagementDocument[];
  documentTexts: Partial<Record<ManagementDocumentKind, string>>;
  warnings?: string[];
}): ManagementBrief {
  return {
    symbol: symbol.toUpperCase(),
    generatedAt: new Date().toISOString(),
    documents,
    signals: signalConfigs.map((config) => signalFromConfig(config, documents, documentTexts)),
    warnings,
  };
}

async function fetchFilingText(document: ManagementDocument): Promise<FilingTextResult> {
  try {
    const response = await fetch(document.url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,text/plain,*/*",
      },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`SEC document request failed (${response.status})`);
    }

    return {
      document,
      text: filingHtmlToText(await response.text()),
    };
  } catch (error) {
    return {
      document,
      error: error instanceof Error ? error.message : "Filing text extraction failed.",
    };
  }
}

export async function getCompanyManagement(symbol: string): Promise<ManagementBrief> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const filings = await getCompanyFilings(normalizedSymbol);
  const documents = selectManagementDocuments(filings);
  const textResults = await Promise.all(documents.map((document) => fetchFilingText(document)));
  const documentTexts: Partial<Record<ManagementDocumentKind, string>> = {};
  const warnings: string[] = [];

  textResults.forEach((result) => {
    if (result.text) {
      documentTexts[result.document.kind] = result.text;
      return;
    }

    if (result.error) {
      warnings.push(`${result.document.label}: ${result.error}`);
    }
  });

  return buildManagementBriefFromTexts({
    symbol: normalizedSymbol,
    documents,
    documentTexts,
    warnings,
  });
}
