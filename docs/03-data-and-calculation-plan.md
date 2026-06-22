# Data And Calculation Plan

## Architecture

V1 is unauthenticated and browser-stored.

Components:

- Next.js frontend.
- Next.js API routes as thin data proxies/normalizers.
- Browser storage for workspaces, saved businesses, notes, overrides, and cached company data.
- No database.
- No auth.
- No paid APIs.

The API routes are still useful because they can normalize SEC/Stooq responses, avoid CORS issues, control caching, and keep fetch logic out of UI components.

## Free Data Sources

### SEC EDGAR

Use for:

- Company ticker/CIK lookup.
- Company submissions.
- 10-K/10-Q/proxy filing links.
- Extracted XBRL company facts.
- Business/report source documents.

Official SEC developer docs:

- https://www.sec.gov/about/developer-resources
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces

Important:

- Send a compliant User-Agent.
- Respect SEC fair access behavior.
- Cache responses.
- Do not scrape aggressively.

### Stooq Or Free Price Source

Use for:

- Daily historical prices.
- Current-ish end-of-day price.

Stooq historical data:

- https://stooq.com/db/h/

Important:

- Treat prices as delayed/end-of-day unless proven otherwise.
- Show source and date.
- Let user enter a manual price if source fails.

## Browser Storage

Use IndexedDB for structured local data:

- Workspaces.
- Saved business items.
- Company cache.
- Price cache.
- Filing cache.
- User notes.
- Manual overrides.

Use localStorage only for tiny preferences:

- Active workspace id.
- Theme, though V1 is dark only.
- Last selected route.

Local workspace object:

```ts
type Workspace = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  defaults: ValuationDefaults
}
```

Saved business item:

```ts
type SavedBusinessItem = {
  id: string
  workspaceId: string
  symbol: string
  cik?: string
  companyName: string
  savedAt: string
  updatedAt: string
  assumptions: ValuationAssumptions
  latestResult: ValuationResult
  notes: CompanyNotes
  overrides: MetricOverride[]
}
```

## Normalized Company Data

```ts
type CompanyProfile = {
  symbol: string
  name: string
  cik?: string
  exchange?: string
  sector?: string
  industry?: string
  description?: string
  source: DataSourceRef
}
```

```ts
type AnnualFinancials = {
  fiscalYear: number
  revenue?: number
  netIncome?: number
  epsDiluted?: number
  sharesDiluted?: number
  stockholdersEquity?: number
  operatingCashFlow?: number
  capex?: number
  freeCashFlow?: number
  investedCapital?: number
  roic?: number
  sourceFacts: Record<string, DataSourceRef>
}
```

## SEC Concept Mapping

Expected common concepts:

- Revenue:
  - `Revenues`
  - `RevenueFromContractWithCustomerExcludingAssessedTax`
  - `SalesRevenueNet`

- Net income:
  - `NetIncomeLoss`

- EPS:
  - `EarningsPerShareDiluted`
  - `EarningsPerShareBasic` as fallback.

- Shares:
  - `WeightedAverageNumberOfDilutedSharesOutstanding`
  - `WeightedAverageNumberOfSharesOutstandingBasic` as fallback.

- Equity:
  - `StockholdersEquity`
  - `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest`

- Operating cash flow:
  - `NetCashProvidedByUsedInOperatingActivities`
  - `NetCashProvidedByUsedInOperatingActivitiesContinuingOperations`

- Capex:
  - `PaymentsToAcquirePropertyPlantAndEquipment`

- Debt:
  - `LongTermDebt`
  - `LongTermDebtCurrent`
  - `ShortTermBorrowings`

- Cash:
  - `CashAndCashEquivalentsAtCarryingValue`

Because XBRL varies by company, every metric needs a source and confidence flag.

## Big Five Calculations

### ROIC

Preferred:

```text
ROIC = NOPAT / invested_capital
```

Free-data fallback:

```text
ROIC = net_income / (stockholders_equity + total_debt - cash)
```

If debt/cash cannot be normalized, show ROIC as unavailable or use a clearly labeled fallback.

### Sales Growth

Use revenue CAGR:

```text
CAGR = (ending_value / starting_value) ^ (1 / years) - 1
```

### EPS Growth

Use diluted EPS CAGR.

If EPS is missing but net income and diluted shares are available:

```text
eps = net_income / diluted_shares
```

### Equity Growth

Use book value per share:

```text
book_value_per_share = stockholders_equity / diluted_shares
```

If per-share data is unreliable, show total equity growth as a fallback and label it.

### Cash Flow Growth

Preferred:

```text
free_cash_flow = operating_cash_flow - capex
```

Then calculate FCF per share growth when shares are available.

Also show operating cash flow growth because Phil Town's public Big 4 tutorial emphasizes operating cash flow per share.

## Valuation Inputs

```ts
type ValuationAssumptions = {
  eps: number
  historicalGrowthRate?: number
  analystGrowthRate?: number
  growthRate: number
  historicalPe?: number
  futurePe: number
  requiredReturn: number
  years: number
  marginOfSafety: number
  currentPrice: number
}
```

Defaults:

- Required return: `0.15`.
- Years: `10`.
- Margin of safety: `0.5`.
- Growth rate: lower of 10-year EPS growth and analyst growth when an analyst estimate is entered, capped at 15% for automatic defaults.
- Future PE: `min(historicalPeCap, growthRate * 2 * 100)` where percent handling must be explicit in code.

Implementation note:

If growth is `0.12`, then 2x growth as PE means `24`, not `0.24`.

## Valuation Output

```ts
type ValuationResult = {
  futureEps: number
  futurePrice: number
  stickerPrice: number
  mosPrice: number
  currentPrice: number
  gapToMos: number
  priceVerdict: "pass" | "almost" | "nope"
  businessGrade: "strong" | "middle" | "dull"
  warnings: string[]
}
```

Price verdict:

- `pass`: current price <= MOS price.
- `almost`: current price is above MOS price and <= sticker price.
- `nope`: current price is above sticker price.

Business grade:

- `strong`: Big Five and Four M checks are mostly strong.
- `middle`: mixed or partially unresolved quality.
- `dull`: weak, inconsistent, outside circle of competence, or not attractive enough.

Missing data should produce warnings/blockers inside the current evaluation step. It should not introduce a fourth saved status.

## API Routes

Suggested routes:

- `GET /api/search?q=apple`
  - Searches local SEC ticker list and returns matches.

- `GET /api/company/:symbol`
  - Returns normalized profile, CIK, filing availability.

- `GET /api/company/:symbol/facts`
  - Returns normalized annual financials and source mappings.

- `GET /api/company/:symbol/prices`
  - Returns price history and latest available price.

- `GET /api/company/:symbol/filings`
  - Returns 10-K, 10-Q, DEF 14A, and source document links.

## Caching

Server/API route caching:

- SEC ticker list: long cache.
- Company facts: daily or weekly cache.
- Submissions: daily cache.
- Price history: daily cache.

Browser cache:

- Store fetched company data with timestamps.
- Let user refresh manually.
- Keep stale data visible with a stale label.

## Data Quality UX

Every calculated value should have:

- Source.
- Period.
- Formula.
- Confidence.
- Manual override state.

Confidence levels:

- High: direct SEC concept, annual 10-K value, clean years.
- Medium: fallback concept or computed from multiple values.
- Low: missing years, conflicting units, negative base values, or manual workaround.
- Manual: user-entered value.

## Legal/Attribution UX

Footer/settings attribution:

- SEC EDGAR data links.
- Price source attribution.
- Educational disclaimer.
- "Not affiliated with Phil Town, Rule #1 Investing, the SEC, or any data provider."
