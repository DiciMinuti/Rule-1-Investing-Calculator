export type BusinessGrade = "strong" | "middle" | "dull";
export type PriceVerdict = "pass" | "almost" | "nope";
export type ReviewChoice = "yes" | "unsure" | "no";
export type MetricConfidence = "high" | "medium" | "low" | "manual";
export type MetricStatus = "healthy" | "caution" | "weak" | "missing";

export type DataSourceRef = {
  label: string;
  url?: string;
  period?: string;
  confidence: MetricConfidence;
  note?: string;
};

export type CompanySearchResult = {
  symbol: string;
  name: string;
  cik?: string;
  exchange?: string;
  dataAvailability: "sec" | "limited";
};

export type CompanyProfile = {
  symbol: string;
  name: string;
  cik?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  website?: string;
  employees?: number;
  source: DataSourceRef;
};

export type CompanyNewsItem = {
  title: string;
  url: string;
  publishedAt?: string;
  source?: string;
};

export type FilingLink = {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  url: string;
};

export type AnnualFinancials = {
  fiscalYear: number;
  revenue?: number;
  netIncome?: number;
  epsDiluted?: number;
  sharesDiluted?: number;
  stockholdersEquity?: number;
  operatingCashFlow?: number;
  capex?: number;
  freeCashFlow?: number;
  totalDebt?: number;
  cashAndEquivalents?: number;
  investedCapital?: number;
  roic?: number;
  sourceFacts: Record<string, DataSourceRef>;
};

export type PricePoint = {
  date: string;
  close: number;
};

export type PriceHistory = {
  symbol: string;
  latest?: PricePoint;
  history: PricePoint[];
  source: DataSourceRef;
};

export type GrowthWindow = 10 | 5 | 3 | 1;

export type GrowthResult = {
  window: GrowthWindow;
  value: number | null;
  actualYears: number;
  startYear?: number;
  endYear?: number;
  warning?: string;
};

export type BigFiveMetric = {
  id: "roic" | "salesGrowth" | "epsGrowth" | "equityGrowth" | "cashFlowGrowth";
  label: string;
  values: { fiscalYear: number; value: number | null; source?: DataSourceRef }[];
  windows: Record<GrowthWindow, GrowthResult>;
  status: MetricStatus;
  sourceLabel: string;
  warning?: string;
};

export type BigFiveResult = {
  metrics: BigFiveMetric[];
  healthyCount: number;
  totalCount: number;
  threshold: number;
  businessContribution: BusinessGrade;
  warnings: string[];
};

export type ValuationAssumptions = {
  eps: number;
  growthRate: number;
  futurePe: number;
  requiredReturn: number;
  years: number;
  marginOfSafety: number;
  currentPrice: number;
  almostBand: number;
};

export type ValuationResult = {
  futureEps: number;
  futurePrice: number;
  stickerPrice: number;
  mosPrice: number;
  currentPrice: number;
  gapToMos: number;
  priceVerdict: PriceVerdict;
  businessGrade: BusinessGrade;
  warnings: string[];
};

export type RuleOneEvaluation = {
  profile: CompanyProfile;
  financials: AnnualFinancials[];
  prices: PriceHistory;
  filings: FilingLink[];
  bigFive: BigFiveResult;
  assumptions: ValuationAssumptions;
  valuation: ValuationResult;
  loadedAt: string;
};

export type BusinessGroupKind = "index" | "sector" | "industry";

export type BusinessGroupSummary = {
  id: string;
  name: string;
  kind: BusinessGroupKind;
  description: string;
  count: number;
  source: DataSourceRef;
};

export type BusinessGroupConstituent = {
  symbol: string;
  displaySymbol: string;
  name: string;
  sector?: string;
  industry?: string;
  cik?: string;
  rank?: number;
};

export type BusinessGroupDetail = BusinessGroupSummary & {
  constituents: BusinessGroupConstituent[];
  updatedAt: string;
};

export type CompanyNotes = {
  thesis: string;
  redFlags: string;
  changeMyMind: string;
  sourceNotes: string;
  nextReviewDate?: string;
  meaning: ReviewChoice;
  moat: BusinessGrade;
  management: BusinessGrade;
  moatTypes: string[];
  managementChecklist: Record<string, boolean>;
};

export type MetricOverride = {
  metricId: string;
  fiscalYear?: number;
  value: number;
  reason?: string;
};

export type SavedBusinessItem = {
  id: string;
  workspaceId: string;
  symbol: string;
  cik?: string;
  companyName: string;
  savedAt: string;
  updatedAt: string;
  assumptions: ValuationAssumptions;
  latestResult: ValuationResult;
  notes: CompanyNotes;
  overrides: MetricOverride[];
  currentPrice?: number;
  mosPrice?: number;
  stickerPrice?: number;
  gapToMos?: number;
};

export type ValuationDefaults = {
  requiredReturn: number;
  marginOfSafety: number;
  almostBand: number;
  bigFiveHealthyThreshold: number;
};

export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  defaults: ValuationDefaults;
};

export type WorkspaceExport = {
  exportedAt: string;
  workspace: Workspace;
  saves: SavedBusinessItem[];
};

export type BrowserCacheRecord<T = unknown> = {
  key: string;
  value: T;
  updatedAt: string;
  expiresAt?: string;
};
